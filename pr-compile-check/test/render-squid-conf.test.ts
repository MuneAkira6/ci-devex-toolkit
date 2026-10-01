import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { afterAll, describe, expect, it } from 'vitest'
import { TOOL_DIR } from './controls.ts'

const SCRIPT = path.join(TOOL_DIR, 'relay', 'render-squid-conf.sh')
const TEMPLATE = path.join(TOOL_DIR, 'relay', 'squid.conf.template')

const created: string[] = []

afterAll(() => {
  for (const directory of created) rmSync(directory, { recursive: true, force: true })
  created.length = 0
})

const GOOD: Record<string, string> = {
  UPSTREAM_HOST: 'proxy.example.invalid',
  UPSTREAM_PORT: '8080',
  UPSTREAM_USER: 'dummy-user',
  UPSTREAM_PASSWORD: 'dummy-password',
}

type Render = {
  readonly status: number
  readonly stdout: string
  readonly stderr: string
  readonly out: string
}

function render(overrides: Record<string, string | undefined>): Render {
  const directory = mkdtempSync(path.join(tmpdir(), 'ci-devex-render-'))
  created.push(directory)
  const out = path.join(directory, 'squid.conf')
  const env: Record<string, string> = { PATH: process.env.PATH ?? '/usr/bin:/bin' }
  for (const [name, value] of Object.entries({ ...GOOD, ...overrides })) {
    if (value !== undefined) env[name] = value
  }
  const result = spawnSync('bash', [SCRIPT, TEMPLATE, out], { encoding: 'utf8', env })
  return { status: result.status ?? -1, stdout: result.stdout, stderr: result.stderr, out }
}

describe('the render script fills the template in', () => {
  it('leaves no placeholder behind and writes the file 0600', () => {
    const result = render({})
    expect(result.status).toBe(0)
    const rendered = readFileSync(result.out, 'utf8')
    expect(rendered).not.toMatch(/@UPSTREAM_[A-Z]+@/)
    expect(rendered).toContain(
      'cache_peer proxy.example.invalid parent 8080 0 no-query default login=dummy-user:dummy-password',
    )
    expect(rendered).toContain('never_direct allow all')
    // eslint-disable-next-line no-bitwise -- the permission bits are what the test is about
    expect((statSync(result.out).mode & 0o777).toString(8)).toBe('600')
  })

  it('never prints the rendered file or any value', () => {
    const result = render({ UPSTREAM_PASSWORD: 'p4ssw0rd-that-must-not-appear' })
    expect(result.status).toBe(0)
    expect(result.stdout).not.toContain('p4ssw0rd-that-must-not-appear')
    expect(result.stderr).not.toContain('p4ssw0rd-that-must-not-appear')
    expect(result.stdout).not.toContain('cache_peer')
    expect(result.stdout).toMatch(/^render-squid-conf: wrote \S+ \(\d+ lines, mode 0600\)\n$/)
  })

  it('takes a password with shell and sed metacharacters literally', () => {
    const awkward = 'a&b$c/d\\e*f`g|h'
    const result = render({ UPSTREAM_PASSWORD: awkward })
    expect(result.status).toBe(0)
    expect(readFileSync(result.out, 'utf8')).toContain(`login=dummy-user:${awkward}`)
  })
})

describe('controls: the render script refuses what it cannot render safely', () => {
  it('refuses an empty value', () => {
    const result = render({ UPSTREAM_PASSWORD: '' })
    expect(result.status).toBe(1)
    expect(result.stderr).toBe('render-squid-conf: UPSTREAM_PASSWORD is empty\n')
  })

  it('refuses a value holding whitespace', () => {
    const result = render({ UPSTREAM_USER: 'two words' })
    expect(result.status).toBe(1)
    expect(result.stderr).toBe('render-squid-conf: UPSTREAM_USER holds whitespace\n')
  })

  it('refuses a variable that is not set at all', () => {
    const result = render({ UPSTREAM_HOST: undefined })
    expect(result.status).toBe(1)
    expect(result.stderr).toBe('render-squid-conf: UPSTREAM_HOST is not set\n')
  })

  it('refuses a port that is not a number, and a template that does not exist', () => {
    expect(render({ UPSTREAM_PORT: 'eighty' }).stderr).toContain('UPSTREAM_PORT must be a number')
    const missing = spawnSync(
      'bash',
      [SCRIPT, path.join(tmpdir(), 'ci-devex-absent.template'), '/dev/null'],
      {
        encoding: 'utf8',
        env: { PATH: process.env.PATH ?? '/usr/bin:/bin', ...GOOD },
      },
    )
    expect(missing.status).toBe(1)
    expect(missing.stderr).toContain('does not exist')
  })

  it('refuses the wrong number of arguments', () => {
    const result = spawnSync('bash', [SCRIPT, TEMPLATE], {
      encoding: 'utf8',
      env: { ...GOOD, PATH: process.env.PATH ?? '' },
    })
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('usage: render-squid-conf.sh <template> <output>')
  })
})

describe('.env.example holds dummies only', () => {
  it('names the four upstream settings and the relay port, with example values', () => {
    const example = readFileSync(path.join(TOOL_DIR, 'relay', '.env.example'), 'utf8')
    expect(example).toContain('UPSTREAM_HOST=proxy.example.invalid')
    expect(example).toContain('UPSTREAM_USER=dummy-user')
    expect(example).toContain('UPSTREAM_PASSWORD=dummy-password')
    expect(example).toContain('RELAY_PORT=3128')
    // nothing that looks like a real host or a real secret
    expect(example).not.toMatch(/\.(com|net|org|co\.jp)\b/)
  })
})
