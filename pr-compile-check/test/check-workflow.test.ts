import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { afterAll, describe, expect, it } from 'vitest'
import { CHECKER, CONTROLS, plant, TEMPLATE } from './controls.ts'

const created: string[] = []

afterAll(() => {
  for (const directory of created) rmSync(directory, { recursive: true, force: true })
  created.length = 0
})

function temporaryFile(name: string, content: string): string {
  const directory = mkdtempSync(path.join(tmpdir(), 'ci-devex-workflow-'))
  created.push(directory)
  const file = path.join(directory, name)
  writeFileSync(file, content)
  return file
}

type Run = { readonly status: number; readonly stdout: string; readonly stderr: string }

/** Runs the checker the way `pnpm workflow:check` does: node, an argument array, no shell. */
function check(...files: string[]): Run {
  try {
    const stdout = execFileSync(process.execPath, [CHECKER, ...files], {
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

function rulesIn(stdout: string): Map<string, string> {
  const results = new Map<string, string>()
  for (const line of stdout.split('\n')) {
    const match = /^(R[1-9]) (ok|FAIL .*)$/.exec(line)
    if (match !== null) results.set(match[1] as string, match[2] as string)
  }
  return results
}

const template = readFileSync(TEMPLATE, 'utf8')

describe('the template keeps every rule', () => {
  const result = check(TEMPLATE)

  it('prints R1 to R9 ok and exits 0', () => {
    expect(result.status).toBe(0)
    expect([...rulesIn(result.stdout)]).toEqual([
      ['R1', 'ok'],
      ['R2', 'ok'],
      ['R3', 'ok'],
      ['R4', 'ok'],
      ['R5', 'ok'],
      ['R6', 'ok'],
      ['R7', 'ok'],
      ['R8', 'ok'],
      ['R9', 'ok'],
    ])
  })

  it('checks several files in one run', () => {
    const second = temporaryFile('copy.yml', template)
    const both = check(TEMPLATE, second)
    expect(both.status).toBe(0)
    expect(both.stdout.split('\n').filter((line) => line === 'R1 ok')).toHaveLength(2)
  })
})

describe('controls: each rule broken in its own copy', () => {
  for (const control of CONTROLS) {
    it(`${control.rule} fails, and only ${control.rule}, when ${control.what}`, () => {
      const planted = temporaryFile(`${control.rule}.yml`, plant(template, control))
      const result = check(planted)
      expect(result.status).toBe(1)
      const rules = rulesIn(result.stdout)
      expect(rules.size).toBe(9)
      const failing = [...rules].filter(([, verdict]) => verdict !== 'ok').map(([id]) => id)
      expect(failing).toEqual([control.rule])
      expect(rules.get(control.rule)).toMatch(/^FAIL \S/)
    })
  }

  it('plants all nine, so no control is silently a no-op', () => {
    expect(CONTROLS.map((control) => control.rule)).toEqual([
      'R1',
      'R2',
      'R3',
      'R4',
      'R5',
      'R6',
      'R7',
      'R8',
      'R9',
    ])
    for (const control of CONTROLS) {
      expect(plant(template, control)).not.toBe(template)
    }
  })
})

describe('what each rule actually says', () => {
  it('R2 refuses a job that widens the permission', () => {
    const widened = template.replace(
      '    timeout-minutes: 45\n',
      '    timeout-minutes: 45\n    permissions:\n      packages: write\n',
    )
    const result = check(temporaryFile('widened.yml', widened))
    expect(rulesIn(result.stdout).get('R2')).toContain('widens permissions with "packages: write"')
  })

  it('R3 refuses the pull_request_target trigger', () => {
    const target = template.replace(
      '  pull_request:\n',
      '  pull_request:\n  pull_request_target:\n',
    )
    const result = check(temporaryFile('target.yml', target))
    expect(rulesIn(result.stdout).get('R3')).toContain('pull_request_target')
  })

  it('R6 accepts a group keyed on github.ref alone', () => {
    const byRef = template.replace(
      // biome-ignore-start lint/suspicious/noTemplateCurlyInString: GitHub Actions expressions, not JS templates
      'group: pr-compile-check-${{ github.event.pull_request.number || github.ref }}',
      'group: pr-compile-check-${{ github.ref }}',
      // biome-ignore-end lint/suspicious/noTemplateCurlyInString: GitHub Actions expressions, not JS templates
    )
    const result = check(temporaryFile('ref.yml', byRef))
    expect(rulesIn(result.stdout).get('R6')).toBe('ok')
  })

  it('R9 refuses a SHA with no version comment', () => {
    const bare = template.replace(
      'actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0',
      'actions/setup-node@820762786026740c76f36085b0efc47a31fe5020',
    )
    const result = check(temporaryFile('bare.yml', bare))
    expect(rulesIn(result.stdout).get('R9')).toContain('no version comment')
  })
})

describe('exit code 3: a file that cannot be read or is not YAML', () => {
  it('refuses a file that is not YAML', () => {
    const notYaml = temporaryFile('not.yml', 'name: a\n  - this: is not\n\tvalid yaml\n')
    const result = check(notYaml)
    expect(result.status).toBe(3)
    expect(result.stderr).toContain('cannot parse the workflow as YAML')
  })

  it('refuses a YAML file that is not a mapping, and one that does not exist', () => {
    const list = temporaryFile('list.yml', '- one\n- two\n')
    expect(check(list).status).toBe(3)
    expect(check(list).stderr).toContain('must be a YAML mapping')
    const absent = check(path.join(tmpdir(), 'ci-devex-absent.yml'))
    expect(absent.status).toBe(3)
    expect(absent.stderr).toContain('cannot read the workflow')
  })

  it('refuses a run with no file at all', () => {
    const result = check()
    expect(result.status).toBe(3)
    expect(result.stderr).toContain('usage: pnpm workflow:check')
  })
})
