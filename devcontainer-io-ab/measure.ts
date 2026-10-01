import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import process from 'node:process'
import type { Machine } from './machine.ts'
import { machineLine, platformTag, readMachine } from './machine.ts'
import type { Summary } from './stats.ts'
import { ratio, summarise } from './stats.ts'

/**
 * `pnpm ioab -- [--runs <n>] [--modules <m>] [--out <dir>] [--keep]`
 *
 * Measures the same project twice over: with its build outputs and dependency caches on the bind
 * mount, and with them on named volumes. It is a Node program that builds its own paths and spawns
 * `docker` with an argument array, because a shell script handing POSIX paths to Windows programs
 * is one of the traps F14 records.
 *
 * Nothing it starts reaches the network: the image is built with `--network none`, both arms run
 * `network_mode: none`, and the only step allowed online — `pnpm install --lockfile-only` and
 * `pnpm fetch` in the sample — is done by hand before the harness runs, or by the harness itself
 * when the lockfile and the fetched store are missing.
 */

const HERE = import.meta.dirname
const SAMPLE = path.join(HERE, 'sample')
const IMAGE = 'ci-devex-ioab:local'
const ALPINE = 'alpine@sha256:28bd5fe8b56d1bd048e5babf5b10710ebe0bae67db86916198a6eec434943f8b'
const PNPM_PACKAGE = path.join(HERE, '..', 'node_modules', 'pnpm')

const ARMS = ['bind', 'volume'] as const
type Arm = (typeof ARMS)[number]

const COMPOSE: Record<Arm, string> = {
  bind: path.join(HERE, 'compose.bind.yml'),
  volume: path.join(HERE, 'compose.volume.yml'),
}
const PROJECT: Record<Arm, string> = {
  bind: 'ci-devex-ioab-bind',
  volume: 'ci-devex-ioab-volume',
}
/** The two volumes emptied before every run of the volume arm; the store and the cache survive. */
const PER_RUN_VOLUMES = ['ci-devex-ioab-node-modules', 'ci-devex-ioab-dist']

const PHASES = ['install', 'build', 'first-request'] as const
type Phase = (typeof PHASES)[number]

type PhaseResult = {
  readonly phase: string
  readonly ms: number
  readonly files?: number
  readonly body?: string
}
type RunResult = { readonly index: number; readonly arm: Arm; readonly phases: PhaseResult[] }

type Options = {
  readonly runs: number
  readonly modules: number
  readonly out: string
  readonly keep: boolean
}

// --- the command line -----------------------------------------------------------------------

function parseArgs(argv: readonly string[]): Options {
  let runs = 5
  let modules = 1000
  let out = path.join(HERE, 'results')
  let keep = false
  const value = (index: number, flag: string): string => {
    const next = argv[index]
    if (next === undefined) throw new Error(`${flag} needs a value`)
    return next
  }
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i]
    switch (flag) {
      case '--':
        break
      case '--runs':
        i += 1
        runs = Number(value(i, flag))
        break
      case '--modules':
        i += 1
        modules = Number(value(i, flag))
        break
      case '--out':
        i += 1
        out = path.resolve(process.cwd(), value(i, flag))
        break
      case '--keep':
        keep = true
        break
      default:
        throw new Error(`unknown argument ${JSON.stringify(flag)}`)
    }
  }
  if (!Number.isInteger(runs) || runs < 1) throw new Error('--runs must be a positive integer')
  if (!Number.isInteger(modules) || modules < 1)
    throw new Error('--modules must be a positive integer')
  return { runs, modules, out, keep }
}

// --- running things -------------------------------------------------------------------------

function run(
  command: string,
  args: readonly string[],
  where = HERE,
  extraEnv: Record<string, string> = {},
): { status: number; stdout: string; stderr: string } {
  const result = spawnSync(command, args, {
    cwd: where,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, ...extraEnv },
  })
  if (result.error !== undefined) throw result.error
  return { status: result.status ?? -1, stdout: result.stdout ?? '', stderr: result.stderr ?? '' }
}

function mustRun(
  command: string,
  args: readonly string[],
  what: string,
  where = HERE,
  extraEnv: Record<string, string> = {},
): string {
  const result = run(command, args, where, extraEnv)
  if (result.status !== 0) {
    throw new Error(`${what} failed (exit ${result.status})\n${result.stdout}\n${result.stderr}`)
  }
  return result.stdout
}

function compose(
  arm: Arm,
  args: readonly string[],
): { status: number; stdout: string; stderr: string } {
  return run('docker', ['compose', '-p', PROJECT[arm], '-f', COMPOSE[arm], ...args])
}

function mustCompose(arm: Arm, args: readonly string[], what: string): string {
  const result = compose(arm, args)
  if (result.status !== 0) {
    throw new Error(`${what} failed (exit ${result.status})\n${result.stdout}\n${result.stderr}`)
  }
  return result.stdout
}

function log(message: string): void {
  process.stdout.write(`${message}\n`)
}

// --- preparation (not timed) -------------------------------------------------------------------

function generateModules(count: number): void {
  mustRun(
    process.execPath,
    [path.join(SAMPLE, 'generate-modules.ts'), String(count)],
    'the generator',
    SAMPLE,
  )
}

/** The body the server must answer, computed here and not read from the sample's own code. */
function expectedBody(count: number): string {
  let total = 0
  for (let index = 1; index <= count; index += 1) total += (index * 7919) % 10007
  return `modules=${count} total=${total}\n`
}

function buildImage(context: string): void {
  // The context is built here: the Dockerfile, pnpm from this repository's node_modules, and the
  // phase runner. Nothing else is sent to the daemon, and nothing is downloaded.
  cpSync(path.join(HERE, 'Dockerfile'), path.join(context, 'Dockerfile'))
  cpSync(path.join(HERE, 'phases.ts'), path.join(context, 'phases.ts'))
  cpSync(PNPM_PACKAGE, path.join(context, 'pnpm'), { recursive: true, dereference: true })
  mustRun('docker', ['build', '--network', 'none', '-t', IMAGE, context], 'docker build')
}

/** Fills a directory, a named volume or a bind-mounted path from `source`, through a container. */
function fillThroughContainer(
  source: string,
  target: { volume?: string; hostPath?: string },
): void {
  const mount =
    target.volume !== undefined ? `${target.volume}:/dst` : `${target.hostPath ?? ''}:/dst`
  mustRun(
    'docker',
    [
      'run',
      '--rm',
      '--network',
      'none',
      '--volume',
      `${source}:/src:ro`,
      '--volume',
      mount,
      ALPINE,
      'cp',
      '-a',
      '/src/.',
      '/dst/',
    ],
    `filling ${mount}`,
  )
}

/** Removes paths inside the bind-mounted sample through a container: the files belong to root. */
function removeThroughContainer(relative: readonly string[]): void {
  if (relative.length === 0) return
  mustRun(
    'docker',
    [
      'run',
      '--rm',
      '--network',
      'none',
      '--volume',
      `${SAMPLE}:/w`,
      ALPINE,
      'rm',
      '-rf',
      ...relative.map((name) => `/w/${name}`),
    ],
    'removing the bind arm’s files',
  )
}

// --- one run ----------------------------------------------------------------------------------

function phaseLine(output: string, phase: Phase): PhaseResult {
  for (const line of output.split('\n')) {
    if (!line.startsWith('{')) continue
    const parsed = JSON.parse(line) as PhaseResult
    if (parsed.phase === phase) return parsed
  }
  throw new Error(`no JSON line for the phase ${phase} in:\n${output}`)
}

function emptyBindOutputs(): void {
  removeThroughContainer(['node_modules', 'dist'])
}

function recreateVolumes(): void {
  for (const volume of PER_RUN_VOLUMES) {
    const result = run('docker', ['volume', 'rm', volume])
    if (result.status !== 0 && !result.stderr.includes('no such volume')) {
      throw new Error(`docker volume rm ${volume} failed: ${result.stderr}`)
    }
  }
}

function oneRun(arm: Arm, index: number, modules: number): RunResult {
  if (arm === 'volume') recreateVolumes()
  mustCompose(arm, ['up', '-d'], `${arm}: compose up`)
  if (arm === 'bind') emptyBindOutputs()
  const phases: PhaseResult[] = []
  try {
    for (const phase of PHASES) {
      const args = ['exec', '-T', 'app', 'node', '/opt/ioab/phases.ts', phase]
      if (phase === 'first-request') args.push(expectedBody(modules))
      const output = mustCompose(arm, args, `${arm}: the ${phase} phase`)
      phases.push(phaseLine(output, phase))
    }
  } finally {
    compose(arm, ['down', '--remove-orphans', '--timeout', '5'])
  }
  const line = phases.map((p) => JSON.stringify(p)).join(' ')
  log(`-- run ${index} ${arm.padEnd(6)} ${line}`)
  return { index, arm, phases }
}

// --- the results --------------------------------------------------------------------------------

type Table = Record<Phase, Record<Arm, Summary>>

function table(results: readonly RunResult[]): Table {
  const built = {} as Table
  for (const phase of PHASES) {
    const perArm = {} as Record<Arm, Summary>
    for (const arm of ARMS) {
      perArm[arm] = summarise(
        results
          .filter((result) => result.arm === arm)
          .map((result) => {
            const found = result.phases.find((p) => p.phase === phase)
            if (found === undefined) throw new Error(`run ${result.index} has no ${phase}`)
            return found.ms
          }),
      )
    }
    built[phase] = perArm
  }
  return built
}

function markdown(
  machine: Machine,
  options: Options,
  results: readonly RunResult[],
  summary: Table,
  fileCounts: { nodeModules: number; dist: number },
): string {
  const lines: string[] = [
    '# devcontainer I/O A/B — results',
    '',
    `Arms: \`bind\` (node_modules, dist, the pnpm store and the metadata cache inside the`,
    `bind-mounted project) and \`volume\` (the same four on named volumes). ${options.runs} run(s)`,
    `per arm, ${options.modules} generated modules, the arms alternating.`,
    '',
    '| Phase | Arm | median (ms) | min | max | runs |',
    '| --- | --- | ---: | ---: | ---: | ---: |',
  ]
  for (const phase of PHASES) {
    for (const arm of ARMS) {
      const s = summary[phase][arm]
      lines.push(`| ${phase} | ${arm} | ${s.median} | ${s.min} | ${s.max} | ${s.count} |`)
    }
  }
  lines.push('', '| Phase | bind ÷ volume (medians) |', '| --- | ---: |')
  for (const phase of PHASES) {
    lines.push(`| ${phase} | ${ratio(summary[phase].bind.median, summary[phase].volume.median)} |`)
  }
  lines.push(
    '',
    '## The order of the runs',
    '',
    `\`${results.map((result) => result.arm).join(' → ')}\``,
    '',
    '## The machine',
    '',
    machineLine(machine),
    '',
    `Installed files: ${fileCounts.nodeModules} under node_modules, ${fileCounts.dist} under dist.`,
    '',
  )
  return lines.join('\n')
}

// --- clean-up -------------------------------------------------------------------------------

function cleanUp(keep: boolean): void {
  for (const arm of ARMS) compose(arm, ['down', '--volumes', '--remove-orphans', '--timeout', '5'])
  removeThroughContainer(['node_modules', 'dist', '.store', '.cache'])
  if (!keep) run('docker', ['image', 'rm', IMAGE])
}

// --- main -----------------------------------------------------------------------------------

async function main(argv: readonly string[]): Promise<number> {
  const options = parseArgs(argv)
  const machine = readMachine()
  const fetched = mkdtempSync(path.join(tmpdir(), 'ci-devex-ioab-prep-'))
  const context = mkdtempSync(path.join(tmpdir(), 'ci-devex-ioab-ctx-'))
  const store = path.join(fetched, 'store')
  const cache = path.join(fetched, 'cache')

  try {
    log(`machine: ${machineLine(machine)}`)
    log(`preparing: ${options.modules} modules, ${options.runs} run(s) per arm`)
    generateModules(options.modules)

    // The only step that uses the network, and only inside the sample.
    mustRun(
      process.execPath,
      [pnpmBin(), 'install', '--lockfile-only'],
      'pnpm install --lockfile-only',
      SAMPLE,
      // CI=true here too: pnpm asks before purging node_modules and aborts with no TTY (F13).
      { CI: 'true' },
    )
    mustRun(
      process.execPath,
      [pnpmBin(), 'fetch', '--store-dir', store, '--cache-dir', cache],
      'pnpm fetch',
      SAMPLE,
      { CI: 'true' },
    )

    buildImage(context)
    log(`built ${IMAGE} with --network none`)

    // Both arms start from the same fetched store and metadata cache, filled through a container.
    removeThroughContainer(['node_modules', 'dist', '.store', '.cache'])
    mkdirSync(path.join(SAMPLE, '.store'), { recursive: true })
    mkdirSync(path.join(SAMPLE, '.cache'), { recursive: true })
    fillThroughContainer(store, { hostPath: path.join(SAMPLE, '.store') })
    fillThroughContainer(cache, { hostPath: path.join(SAMPLE, '.cache') })
    mustCompose('volume', ['up', '-d'], 'volume: creating the volumes')
    compose('volume', ['down', '--remove-orphans', '--timeout', '5'])
    fillThroughContainer(store, { volume: 'ci-devex-ioab-store' })
    fillThroughContainer(cache, { volume: 'ci-devex-ioab-cache' })
    log('filled both arms’ store and metadata cache through a container with no network')

    const results: RunResult[] = []
    for (let index = 1; index <= options.runs; index += 1) {
      for (const arm of ARMS) results.push(oneRun(arm, index, options.modules))
    }

    const summary = table(results)
    const last = results[results.length - 1]
    const fileCounts = {
      nodeModules: last?.phases.find((p) => p.phase === 'install')?.files ?? 0,
      dist: last?.phases.find((p) => p.phase === 'build')?.files ?? 0,
    }
    const stamp = new Date().toISOString().slice(0, 10)
    const base = `${stamp}-${platformTag(machine)}`
    mkdirSync(options.out, { recursive: true })
    const json = path.join(options.out, `${base}.json`)
    const md = path.join(options.out, `${base}.md`)
    for (const file of [json, md]) {
      if (existsSync(file)) {
        log(`${file} already exists; it is not overwritten. Remove it first to measure again.`)
        return 1
      }
    }
    writeFileSync(
      json,
      `${JSON.stringify(
        {
          date: stamp,
          runsPerArm: options.runs,
          modules: options.modules,
          machine,
          runs: results,
          summary,
          ratios: Object.fromEntries(
            PHASES.map((phase) => [
              phase,
              ratio(summary[phase].bind.median, summary[phase].volume.median),
            ]),
          ),
        },
        null,
        2,
      )}\n`,
    )
    writeFileSync(md, markdown(machine, options, results, summary, fileCounts))
    log(`wrote ${json}`)
    log(`wrote ${md}`)
    process.stdout.write(`\n${markdown(machine, options, results, summary, fileCounts)}`)
    return 0
  } finally {
    cleanUp(options.keep)
    rmSync(fetched, { recursive: true, force: true })
    rmSync(context, { recursive: true, force: true })
  }
}

function pnpmBin(): string {
  return path.join(PNPM_PACKAGE, 'bin', 'pnpm.cjs')
}

try {
  process.exitCode = await main(process.argv.slice(2))
} catch (error) {
  process.stderr.write(`ioab: ${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
}
