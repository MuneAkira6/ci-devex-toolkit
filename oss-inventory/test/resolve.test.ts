import { describe, expect, it } from 'vitest'
import type { AliasTable } from '../src/aliases.ts'
import { EMPTY_ALIASES, loadAliases } from '../src/aliases.ts'
import { resolveDependency } from '../src/resolve.ts'
import { spdxIdCount } from '../src/spdx.ts'
import type { Declared, DeclaredLicense, Ecosystem } from '../src/types.ts'
import { ALIASES } from './paths.ts'

const table: AliasTable = loadAliases(ALIASES)

function dependency(
  ecosystem: Ecosystem,
  licenses: readonly DeclaredLicense[],
  expression: string | null = null,
): Declared {
  return {
    ecosystem,
    name: 'example',
    version: '1.0.0',
    licenses,
    expression,
    homepage: null,
    noticeDirs: [],
  }
}

describe('spdx-license-list is the only source of ids (F9)', () => {
  it('knows 727 licenses', () => {
    expect(spdxIdCount()).toBe(727)
  })
})

describe('step 1: a name that is an SPDX id, compared case-insensitively', () => {
  it('writes the id in its canonical case', () => {
    const resolved = resolveDependency(
      dependency('gradle', [{ name: 'epl-2.0', url: null }]),
      EMPTY_ALIASES,
    )
    expect(resolved.ids).toEqual(['EPL-2.0'])
    expect(resolved.source).toBe('declared')
  })
})

describe('step 2: a pnpm license string that parses as an SPDX expression', () => {
  it('takes every id of the expression', () => {
    const resolved = resolveDependency(
      dependency('pnpm', [{ name: '(MIT OR Apache-2.0)', url: null }], '(MIT OR Apache-2.0)'),
      EMPTY_ALIASES,
    )
    expect(resolved.ids).toEqual(['Apache-2.0', 'MIT'])
    expect(resolved.source).toBe('declared')
  })

  it('accepts a LicenseRef inside an expression', () => {
    const resolved = resolveDependency(
      dependency(
        'pnpm',
        [{ name: 'MIT AND LicenseRef-Acme', url: null }],
        'MIT AND LicenseRef-Acme',
      ),
      EMPTY_ALIASES,
    )
    expect(resolved.ids).toEqual(['LicenseRef-Acme', 'MIT'])
  })

  it('leaves a string that is not an expression UNKNOWN', () => {
    const resolved = resolveDependency(
      dependency('pnpm', [{ name: 'SEE LICENSE IN LICENSE', url: null }], 'SEE LICENSE IN LICENSE'),
      EMPTY_ALIASES,
    )
    expect(resolved.source).toBe('unknown')
    expect(resolved.ids).toEqual([])
    expect(resolved.unresolved).toEqual([{ name: 'SEE LICENSE IN LICENSE', url: null }])
  })

  it('leaves an expression whose id spdx-license-list does not know UNKNOWN', () => {
    expect(
      resolveDependency(
        dependency(
          'pnpm',
          [{ name: 'MIT OR Nonexistent-1.0', url: null }],
          'MIT OR Nonexistent-1.0',
        ),
        EMPTY_ALIASES,
      ).source,
    ).toBe('unknown')
  })

  it('is not applied to sbt or Gradle: an expression there is not a license name', () => {
    expect(
      resolveDependency(dependency('gradle', [{ name: 'MIT OR Apache-2.0', url: null }]), table)
        .source,
    ).toBe('unknown')
  })
})

describe('step 3: the alias table maps a name', () => {
  it('maps the five Apache spellings of the Gradle fixture to Apache-2.0 (F10)', () => {
    for (const name of [
      'Apache License, Version 2.0',
      'The Apache Software License, Version 2.0',
      'Apache 2.0',
      'The Apache License, Version 2.0',
    ]) {
      const resolved = resolveDependency(dependency('gradle', [{ name, url: null }]), table)
      expect(resolved.ids).toEqual(['Apache-2.0'])
      expect(resolved.source).toBe('alias')
    }
  })

  it('maps the two MIT spellings of the sbt fixture (F11)', () => {
    for (const name of ['MIT License', 'The MIT License']) {
      expect(resolveDependency(dependency('sbt', [{ name, url: null }]), table).ids).toEqual([
        'MIT',
      ])
    }
  })
})

describe('step 4: a URL, only when the name is empty or null', () => {
  it('maps the fifth Apache spelling, a null name with an Apache URL', () => {
    const resolved = resolveDependency(
      dependency('gradle', [{ name: null, url: 'https://www.apache.org/licenses/LICENSE-2.0' }]),
      table,
    )
    expect(resolved.ids).toEqual(['Apache-2.0'])
    expect(resolved.source).toBe('alias')
  })

  it('does not consult the URL when the name is present but unmapped', () => {
    expect(
      resolveDependency(
        dependency('gradle', [
          { name: 'Some House Licence', url: 'https://www.apache.org/licenses/LICENSE-2.0' },
        ]),
        table,
      ).source,
    ).toBe('unknown')
  })

  it('does not map .../LICENSE-2.0.txt, which is a different key from .../LICENSE-2.0', () => {
    expect(
      resolveDependency(
        dependency('gradle', [
          { name: null, url: 'http://www.apache.org/licenses/LICENSE-2.0.txt' },
        ]),
        table,
      ).source,
    ).toBe('unknown')
  })
})

describe('step 5: UNKNOWN, and the rule H2 proves', () => {
  it('leaves "Public Domain" with no URL UNKNOWN: aopalliance needs a human ruling', () => {
    const resolved = resolveDependency(
      dependency('gradle', [{ name: 'Public Domain', url: null }]),
      table,
    )
    expect(resolved.source).toBe('unknown')
    expect(resolved.unresolved).toEqual([{ name: 'Public Domain', url: null }])
  })

  it('one UNKNOWN entry makes the dependency UNKNOWN although the others mapped (the H2 case)', () => {
    const resolved = resolveDependency(
      dependency('gradle', [
        { name: null, url: 'https://h2database.com/html/license.html' },
        { name: 'EPL 1.0', url: 'https://opensource.org/licenses/eclipse-1.0.php' },
        { name: 'MPL 2.0', url: 'https://www.mozilla.org/en-US/MPL/2.0/' },
      ]),
      table,
    )
    expect(resolved.source).toBe('unknown')
    expect(resolved.ids).toEqual([])
    expect(resolved.unresolved).toEqual([
      { name: null, url: 'https://h2database.com/html/license.html' },
    ])
  })

  it('a dependency with no license entry at all is UNKNOWN', () => {
    const resolved = resolveDependency(dependency('sbt', []), table)
    expect(resolved.source).toBe('unknown')
    expect(resolved.unresolved).toEqual([])
  })

  it('sorts and de-duplicates the ids of a dependency that mapped', () => {
    const resolved = resolveDependency(
      dependency('gradle', [
        { name: 'MPL 2.0', url: null },
        { name: 'EPL 1.0', url: null },
        { name: 'MPL-2.0', url: null },
      ]),
      table,
    )
    expect(resolved.ids).toEqual(['EPL-1.0', 'MPL-2.0'])
  })
})
