import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { describe, expect, it } from 'vitest'
import {
  CLI,
  FIXTURES,
  GRADLE_REPORT,
  GRADLE_SINGLE_REPORT,
  PNPM_REPORT,
  REPO_ROOT,
  SAMPLES,
  SBT_REPORT,
} from './paths.ts'
import { temporaryDirectory } from './tmp.ts'

type Run = { readonly status: number; readonly stdout: string; readonly stderr: string }

/** Runs the CLI the way `pnpm inventory` does: node, with an argument array, never a shell. */
function run(args: readonly string[]): Run {
  try {
    const stdout = execFileSync(process.execPath, [CLI, ...args], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return { status: 0, stdout, stderr: '' }
  } catch (error) {
    const failure = error as { status?: number; stdout?: string; stderr?: string }
    return {
      status: failure.status ?? -1,
      stdout: failure.stdout ?? '',
      stderr: failure.stderr ?? '',
    }
  }
}

function temporary(prefix: string): string {
  return temporaryDirectory(prefix)
}

function digestTree(root: string): string[] {
  const walk = (directory: string, prefix: string): string[] => {
    const lines: string[] = []
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const relative = prefix === '' ? entry.name : `${prefix}/${entry.name}`
      if (entry.isDirectory()) lines.push(...walk(path.join(directory, entry.name), relative))
      else {
        const hash = createHash('sha256')
          .update(readFileSync(path.join(directory, entry.name)))
          .digest('hex')
        lines.push(`${hash}  ${relative}`)
      }
    }
    return lines
  }
  return walk(root, '').sort()
}

const FIXTURE_INPUTS: readonly string[] = [
  '--pnpm',
  PNPM_REPORT,
  '--pnpm-root',
  REPO_ROOT,
  '--sbt',
  SBT_REPORT,
  '--gradle',
  GRADLE_REPORT,
]

describe('exit code 0: the full sample run', () => {
  const out = temporary('ok')
  const result = run([
    ...FIXTURE_INPUTS,
    '--overrides',
    path.join(SAMPLES, 'overrides.yml'),
    '--texts',
    path.join(SAMPLES, 'texts'),
    '--out',
    out,
  ])

  it('exits 0 and reports every dependency of the three reports', () => {
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('56 dependencies')
    expect(result.stdout).toContain('LicenseRef-Public-Domain: 1')
  })

  it('writes one license text per id in the result, the LicenseRef from --texts', () => {
    const ids = readdirSync(path.join(out, 'licenses')).sort()
    expect(ids).toEqual([
      '0BSD.txt',
      'Apache-2.0.txt',
      'BSD-2-Clause.txt',
      'BSD-3-Clause.txt',
      'EPL-1.0.txt',
      'EPL-2.0.txt',
      'ISC.txt',
      'LGPL-2.1-only.txt',
      'LicenseRef-Public-Domain.txt',
      'MIT.txt',
      'MPL-2.0.txt',
    ])
    expect(readFileSync(path.join(out, 'licenses', 'LicenseRef-Public-Domain.txt'), 'utf8')).toBe(
      readFileSync(path.join(SAMPLES, 'texts', 'LicenseRef-Public-Domain.txt'), 'utf8'),
    )
  })

  it('applies both human rulings and marks the rows as overridden', () => {
    const csv = readFileSync(path.join(out, 'inventory.csv'), 'utf8')
    expect(csv).toContain('gradle,aopalliance:aopalliance,1.0,LicenseRef-Public-Domain,override,')
    expect(csv).toContain('gradle,com.h2database:h2,2.5.252,EPL-1.0;MPL-2.0,override,')
    expect(readFileSync(path.join(out, 'inventory.md'), 'utf8')).toContain('## Failures\n\nNone')
  })

  it('copies the 9 Gradle META-INF files byte for byte, CRLF included (F10)', () => {
    const source = path.join(FIXTURES, 'gradle', 'slf4j-api-2.0.20.jar', 'META-INF', 'LICENSE.txt')
    const copy = path.join(out, 'notices', 'gradle', 'org.slf4j__slf4j-api@2.0.20', 'LICENSE.txt')
    const bytes = readFileSync(source)
    expect(readFileSync(copy).equals(bytes)).toBe(true)
    expect(bytes.includes('\r\n')).toBe(true)
    const gradleNotices = readdirSync(path.join(out, 'notices', 'gradle'))
      .flatMap((directory) =>
        readdirSync(path.join(out, 'notices', 'gradle', directory)).map(
          (file) => `${directory}/${file}`,
        ),
      )
      .sort()
    expect(gradleNotices).toHaveLength(9)
    expect(gradleNotices).toContain('com.google.guava__guava@33.7.2-jre/LICENSE')
  })

  it('copies the pnpm packages’ own license files', () => {
    const copy = path.join(out, 'notices', 'pnpm', 'react@19.3.0', 'LICENSE')
    const source = path.join(
      REPO_ROOT,
      'node_modules/.pnpm/react@19.3.0/node_modules/react/LICENSE',
    )
    expect(readFileSync(copy).equals(readFileSync(source))).toBe(true)
  })

  it('writes only the files SCOPE.md lists', () => {
    const top = readdirSync(out).sort()
    expect(top).toEqual(['inventory.csv', 'inventory.md', 'licenses', 'notices'])
  })
})

describe('two runs on the same inputs are byte-identical', () => {
  it('gives every output file the same sha256 twice', () => {
    const args = (out: string): string[] => [
      ...FIXTURE_INPUTS,
      '--overrides',
      path.join(SAMPLES, 'overrides.yml'),
      '--texts',
      path.join(SAMPLES, 'texts'),
      '--out',
      out,
    ]
    const first = temporary('det-a')
    const second = temporary('det-b')
    expect(run(args(first)).status).toBe(0)
    expect(run(args(second)).status).toBe(0)
    const a = digestTree(first)
    const b = digestTree(second)
    expect(a).toHaveLength(47)
    expect(a).toEqual(b)
  })
})

describe('exit code 1: something failed', () => {
  it('lists exactly the two UNKNOWN dependencies of the fixtures when no ruling applies', () => {
    const out = temporary('unknown')
    const result = run(['--gradle', GRADLE_REPORT, '--sbt', SBT_REPORT, '--out', out])
    expect(result.status).toBe(1)
    const failures = result.stdout.split('\n').filter((line) => line.startsWith('UNKNOWN '))
    expect(failures).toEqual([
      'UNKNOWN gradle:aopalliance:aopalliance@1.0: no SPDX id for "Public Domain"',
      'UNKNOWN gradle:com.h2database:h2@2.5.252: no SPDX id for "(https://h2database.com/html/license.html)"',
    ])
    expect(readFileSync(path.join(out, 'inventory.md'), 'utf8')).toContain(
      '- UNKNOWN gradle:aopalliance:aopalliance@1.0',
    )
  })

  it('control: an id whose text is missing fails the run and is named', () => {
    const out = temporary('notext')
    const result = run([
      '--gradle',
      GRADLE_REPORT,
      '--overrides',
      path.join(SAMPLES, 'overrides.yml'),
      '--out',
      out,
    ])
    expect(result.status).toBe(1)
    expect(result.stdout).toContain(
      'MISSING TEXT LicenseRef-Public-Domain needs --texts <dir> with LicenseRef-Public-Domain.txt',
    )
  })

  it('writes the outputs for exit 1 as well as for exit 0', () => {
    const out = temporary('written')
    expect(run(['--gradle', GRADLE_REPORT, '--out', out]).status).toBe(1)
    expect(readdirSync(out).sort()).toEqual([
      'inventory.csv',
      'inventory.md',
      'licenses',
      'notices',
    ])
  })
})

describe('exit code 3: an input error', () => {
  it('control: the single-license Gradle shape, naming the renderer setting', () => {
    const result = run(['--gradle', GRADLE_SINGLE_REPORT, '--out', temporary('single')])
    expect(result.status).toBe(3)
    expect(result.stderr).toContain('JsonReportRenderer("index.json", false)')
  })

  it('control: an overrides entry without a reason, and a duplicate id', () => {
    const directory = temporary('ovr')
    const noReason = path.join(directory, 'no-reason.yml')
    writeFileSync(
      noReason,
      '- id: gradle:aopalliance:aopalliance@1.0\n  licenses: [MIT]\n  source: https://x/\n  reviewed: 2026-10-01\n',
    )
    const duplicate = path.join(directory, 'duplicate.yml')
    const entry =
      '- id: gradle:aopalliance:aopalliance@1.0\n  licenses: [MIT]\n  reason: planted control\n  source: https://x/\n  reviewed: 2026-10-01\n'
    writeFileSync(duplicate, entry + entry)

    const first = run(['--gradle', GRADLE_REPORT, '--overrides', noReason, '--out', temporary('a')])
    expect(first.status).toBe(3)
    expect(first.stderr).toContain(
      'entry 1 (gradle:aopalliance:aopalliance@1.0): "reason" is missing',
    )

    const second = run([
      '--gradle',
      GRADLE_REPORT,
      '--overrides',
      duplicate,
      '--out',
      temporary('b'),
    ])
    expect(second.status).toBe(3)
    expect(second.stderr).toContain('is already overridden by entry 1')
  })

  it('refuses a run with no input at all, and an unknown argument', () => {
    expect(run(['--out', temporary('empty')]).status).toBe(3)
    expect(
      run(['--gradle', GRADLE_REPORT, '--maven', 'x', '--out', temporary('m')]).stderr,
    ).toContain('unknown argument "--maven"')
    expect(run(['--gradle', GRADLE_REPORT]).stderr).toContain('--out <dir> is required')
    expect(run(['--gradle', '--out', temporary('v')]).status).toBe(3)
  })

  it('writes nothing for an input error', () => {
    const out = temporary('nothing')
    expect(run(['--gradle', GRADLE_SINGLE_REPORT, '--out', out]).status).toBe(3)
    expect(readdirSync(out)).toEqual([])
  })
})

describe('an override that matches no dependency', () => {
  it('is listed as unused and does not change the exit code', () => {
    const directory = temporary('unused')
    const overrides = path.join(directory, 'overrides.yml')
    writeFileSync(
      overrides,
      `${readFileSync(path.join(SAMPLES, 'overrides.yml'), 'utf8')}
- id: pnpm:no-such-package@9.9.9
  licenses: [MIT]
  reason: planted control, so that an unused ruling is seen to be reported
  source: https://example.invalid/
  reviewed: 2026-10-01
`,
    )
    const out = temporary('unused-out')
    const result = run([
      ...FIXTURE_INPUTS,
      '--overrides',
      overrides,
      '--texts',
      path.join(SAMPLES, 'texts'),
      '--out',
      out,
    ])
    expect(result.status).toBe(0)
    expect(result.stdout).toContain(
      'unused override: pnpm:no-such-package@9.9.9 (reviewed 2026-10-01) matched no dependency',
    )
    expect(readFileSync(path.join(out, 'inventory.md'), 'utf8')).toContain(
      '## Unused overrides\n\n- pnpm:no-such-package@9.9.9',
    )
  })
})
