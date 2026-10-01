import { readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadAliases, urlKey } from '../src/aliases.ts'
import { InputError } from '../src/errors.ts'
import { ALIASES } from './paths.ts'
import { temporaryFile } from './tmp.ts'

function writeAliases(content: string): string {
  return temporaryFile('alias', 'aliases.yml', content)
}

describe('urlKey strips the scheme, a leading www. and one trailing slash — and nothing else', () => {
  it('normalises the three things SCOPE.md names', () => {
    expect(urlKey('https://www.apache.org/licenses/LICENSE-2.0')).toBe(
      'apache.org/licenses/LICENSE-2.0',
    )
    expect(urlKey('http://apache.org/licenses/LICENSE-2.0/')).toBe(
      'apache.org/licenses/LICENSE-2.0',
    )
    expect(urlKey('  https://typelevel.org/cats  ')).toBe('typelevel.org/cats')
  })

  it('keeps .../LICENSE-2.0 and .../LICENSE-2.0.txt apart', () => {
    expect(urlKey('https://www.apache.org/licenses/LICENSE-2.0')).not.toBe(
      urlKey('https://www.apache.org/licenses/LICENSE-2.0.txt'),
    )
  })

  it('strips only one trailing slash and only a leading www.', () => {
    expect(urlKey('https://example.org/a//')).toBe('example.org/a/')
    expect(urlKey('https://wwwx.example.org/a')).toBe('wwwx.example.org/a')
  })
})

describe('the shipped aliases.yml', () => {
  const table = loadAliases(ALIASES)

  it('states the "one license, one version" rule in its header', () => {
    const header = readFileSync(ALIASES, 'utf8').split('\n').slice(0, 12).join('\n')
    expect(header).toContain('ONE LICENSE, ONE VERSION')
    expect(header).toContain('"BSD", "GPL", "LGPL", "Apache License" with no version')
  })

  it('maps exactly the names the fixtures force, and nothing more', () => {
    expect([...table.names].sort()).toEqual([
      ['Apache 2.0', 'Apache-2.0'],
      ['Apache License, Version 2.0', 'Apache-2.0'],
      ['EPL 1.0', 'EPL-1.0'],
      ['MIT License', 'MIT'],
      ['MPL 2.0', 'MPL-2.0'],
      ['The Apache License, Version 2.0', 'Apache-2.0'],
      ['The Apache Software License, Version 2.0', 'Apache-2.0'],
      ['The MIT License', 'MIT'],
    ])
  })

  it('maps exactly one URL: the null-name Apache entry of jspecify', () => {
    expect([...table.urls]).toEqual([['apache.org/licenses/LICENSE-2.0', 'Apache-2.0']])
  })

  it('does not alias what makes the two UNKNOWN dependencies real', () => {
    expect(table.names.has('Public Domain')).toBe(false)
    expect(table.urls.has(urlKey('https://h2database.com/html/license.html'))).toBe(false)
  })

  it('aliases no ambiguous name', () => {
    for (const ambiguous of ['BSD', 'GPL', 'LGPL', 'Apache License', 'Apache', 'MIT-like']) {
      expect(table.names.has(ambiguous)).toBe(false)
    }
  })
})

describe('the alias table refuses a target it cannot check', () => {
  it('refuses an id spdx-license-list does not know', () => {
    expect(() => loadAliases(writeAliases("names:\n  'Apache 2.0': Apache-2\n"))).toThrow(
      /neither an SPDX id/,
    )
  })

  it('refuses an id written in the wrong case', () => {
    expect(() => loadAliases(writeAliases("names:\n  'Apache 2.0': apache-2.0\n"))).toThrow(
      /canonical case, "Apache-2.0"/,
    )
  })

  it('accepts a LicenseRef target', () => {
    const table = loadAliases(writeAliases("names:\n  'Public Domain': LicenseRef-Public-Domain\n"))
    expect(table.names.get('Public Domain')).toBe('LicenseRef-Public-Domain')
  })

  it('refuses an unknown section and a file it cannot read', () => {
    expect(() => loadAliases(writeAliases('aliases: {}\n'))).toThrow(/unknown section "aliases"/)
    expect(() => loadAliases(path.join(tmpdir(), 'ci-devex-absent.yml'))).toThrow(InputError)
  })

  it('refuses two URLs that compare equal', () => {
    expect(() =>
      loadAliases(
        writeAliases(
          "urls:\n  'https://www.apache.org/licenses/LICENSE-2.0': Apache-2.0\n" +
            "  'http://apache.org/licenses/LICENSE-2.0/': Apache-2.0\n",
        ),
      ),
    ).toThrow(/twice \(compared as "apache.org\/licenses\/LICENSE-2.0"\)/)
  })
})
