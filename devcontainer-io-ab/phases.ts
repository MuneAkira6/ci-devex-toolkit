import { spawn, spawnSync } from 'node:child_process'
import type { Dirent } from 'node:fs'
import { readdirSync } from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import process from 'node:process'

/**
 * The three timed phases, run **inside** the container: `node /opt/ioab/phases.ts <phase>`.
 *
 * It prints one JSON line per phase, which is what the harness on the host reads. It is copied
 * into the image on its own and imports nothing but Node's own modules, so the image needs no
 * install of its own.
 *
 * The clock is here rather than on the host because what is being measured is the work inside the
 * container; `docker exec`'s own cost is not part of the answer.
 */

const PNPM = '/opt/pnpm/bin/pnpm.cjs'
const PROJECT = '/w'
const PORT = 3000

function countFiles(directory: string): number {
  let total = 0
  let entries: Dirent[]
  try {
    entries = readdirSync(directory, { withFileTypes: true })
  } catch {
    return 0
  }
  for (const entry of entries) {
    if (entry.isDirectory()) total += countFiles(path.join(directory, entry.name))
    else total += 1
  }
  return total
}

function emit(phase: string, ms: number, extra: Record<string, unknown> = {}): void {
  process.stdout.write(`${JSON.stringify({ phase, ms, ...extra })}\n`)
}

function fail(message: string): never {
  process.stderr.write(`phases: ${message}\n`)
  process.exit(1)
}

function install(): void {
  const store = process.env.IOAB_STORE ?? fail('IOAB_STORE is not set')
  const cache = process.env.IOAB_CACHE ?? fail('IOAB_CACHE is not set')
  const started = performance.now()
  // CI=true, the store and the metadata cache: all three are needed for an offline install here
  // (goal-pack/facts.md, F13). The image's environment already carries CI=true.
  const result = spawnSync(
    process.execPath,
    [PNPM, 'install', '--offline', '--frozen-lockfile', '--store-dir', store, '--cache-dir', cache],
    { cwd: PROJECT, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' },
  )
  const ms = Math.round(performance.now() - started)
  if (result.status !== 0) {
    process.stderr.write(result.stdout ?? '')
    process.stderr.write(result.stderr ?? '')
    fail(`install exited ${String(result.status)}`)
  }
  emit('install', ms, { files: countFiles(path.join(PROJECT, 'node_modules')) })
}

function build(): void {
  const started = performance.now()
  const result = spawnSync(
    process.execPath,
    [path.join(PROJECT, 'node_modules', 'typescript', 'bin', 'tsc'), '-p', '.'],
    { cwd: PROJECT, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' },
  )
  const ms = Math.round(performance.now() - started)
  if (result.status !== 0) {
    process.stderr.write(result.stdout ?? '')
    process.stderr.write(result.stderr ?? '')
    fail(`build exited ${String(result.status)}`)
  }
  emit('build', ms, { files: countFiles(path.join(PROJECT, 'dist')) })
}

function get(): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const request = http.request(
      { host: '127.0.0.1', port: PORT, path: '/', method: 'GET' },
      (response) => {
        let body = ''
        response.setEncoding('utf8')
        response.on('data', (chunk: string) => {
          body += chunk
        })
        response.on('end', () => resolve({ status: response.statusCode ?? 0, body }))
      },
    )
    request.setTimeout(5000, () => request.destroy(new Error('timed out')))
    request.on('error', reject)
    request.end()
  })
}

async function firstRequest(expected: string): Promise<void> {
  const started = performance.now()
  const server = spawn(process.execPath, [path.join(PROJECT, 'dist', 'server.js')], {
    cwd: PROJECT,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PORT: String(PORT) },
  })
  let serverOutput = ''
  server.stdout.on('data', (chunk: Buffer) => {
    serverOutput += chunk.toString('utf8')
  })
  server.stderr.on('data', (chunk: Buffer) => {
    serverOutput += chunk.toString('utf8')
  })
  try {
    const deadline = Date.now() + 120_000
    for (;;) {
      if (server.exitCode !== null) fail(`the server exited ${server.exitCode}: ${serverOutput}`)
      try {
        const response = await get()
        if (response.status === 200) {
          const ms = Math.round(performance.now() - started)
          if (response.body !== expected) {
            fail(
              `the body was ${JSON.stringify(response.body)}, expected ${JSON.stringify(expected)}`,
            )
          }
          emit('first-request', ms, { body: response.body.trim() })
          return
        }
      } catch {
        // not listening yet
      }
      if (Date.now() > deadline) fail(`the server never answered 200: ${serverOutput}`)
      await new Promise((resolve) => setTimeout(resolve, 20))
    }
  } finally {
    server.kill('SIGKILL')
  }
}

const phase = process.argv[2] ?? ''
if (phase === 'install') install()
else if (phase === 'build') build()
else if (phase === 'first-request') await firstRequest(process.argv[3] ?? '')
else fail(`unknown phase ${JSON.stringify(phase)}; use install, build or first-request`)
