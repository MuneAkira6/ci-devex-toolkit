import { describe, expect, it } from 'vitest'
import { csvField, parseCsv } from '../src/csv.ts'
import {
  CSV_HEADER,
  compareDependencies,
  declaredCell,
  licensesCell,
  renderCsv,
  renderMarkdown,
  summarise,
  unknownFailure,
} from '../src/report.ts'
import type { Ecosystem, Resolved } from '../src/types.ts'

function resolved(partial: Partial<Resolved> & { ecosystem: Ecosystem; name: string }): Resolved {
  return {
    version: '1.0.0',
    licenses: [],
    expression: null,
    homepage: null,
    noticeDirs: [],
    ids: [],
    source: 'declared',
    unresolved: [],
    ...partial,
  }
}

describe('the CSV helper', () => {
  it('quotes a field only when RFC 4180 requires it', () => {
    expect(csvField('Apache-2.0')).toBe('Apache-2.0')
    expect(csvField('Apache License, Version 2.0')).toBe('"Apache License, Version 2.0"')
    expect(csvField('a "b" c')).toBe('"a ""b"" c"')
    expect(csvField('one\ntwo')).toBe('"one\ntwo"')
  })

  it('reads back a quoted field, and counts the line a record starts on', () => {
    expect(parseCsv('a,b\n"x,y",z\n')).toEqual([
      { line: 1, fields: ['a', 'b'] },
      { line: 2, fields: ['x,y', 'z'] },
    ])
    expect(parseCsv('a\r\nb\r\n')).toEqual([
      { line: 1, fields: ['a'] },
      { line: 2, fields: ['b'] },
    ])
  })
})

describe('inventory.csv', () => {
  it('has the header SCOPE.md gives, in that order', () => {
    expect(CSV_HEADER.join(',')).toBe('ecosystem,name,version,licenses,source,declared,homepage')
    expect(renderCsv([]).split('\n')[0]).toBe(
      'ecosystem,name,version,licenses,source,declared,homepage',
    )
  })

  it('joins the ids with ";" and the declared names and URLs with " | "', () => {
    const dependency = resolved({
      ecosystem: 'gradle',
      name: 'ch.qos.logback:logback-classic',
      version: '1.6.5',
      ids: ['EPL-2.0', 'LGPL-2.1-only'],
      licenses: [
        { name: 'EPL-2.0', url: 'https://www.eclipse.org/legal/epl-v20.html' },
        { name: 'LGPL-2.1-only', url: 'https://x/' },
      ],
    })
    expect(licensesCell(dependency)).toBe('EPL-2.0;LGPL-2.1-only')
    expect(declaredCell(dependency)).toBe(
      'EPL-2.0 (https://www.eclipse.org/legal/epl-v20.html) | LGPL-2.1-only (https://x/)',
    )
  })

  it('writes the pnpm expression as declared, and UNKNOWN for a dependency that failed', () => {
    expect(
      licensesCell(
        resolved({
          ecosystem: 'pnpm',
          name: 'x',
          expression: '(MIT OR Apache-2.0)',
          ids: ['Apache-2.0', 'MIT'],
        }),
      ),
    ).toBe('(MIT OR Apache-2.0)')
    expect(licensesCell(resolved({ ecosystem: 'pnpm', name: 'x', source: 'unknown' }))).toBe(
      'UNKNOWN',
    )
  })

  it('writes an override as ids, not as the expression it replaces', () => {
    expect(
      licensesCell(
        resolved({
          ecosystem: 'pnpm',
          name: 'x',
          expression: 'SEE LICENSE IN LICENSE',
          ids: ['MIT'],
          source: 'override',
        }),
      ),
    ).toBe('MIT')
  })

  it('ends every line with LF and no CR', () => {
    const csv = renderCsv([resolved({ ecosystem: 'sbt', name: 'a:b', ids: ['MIT'] })])
    expect(csv.includes('\r')).toBe(false)
    expect(csv.endsWith('\n')).toBe(true)
  })
})

describe('the row order', () => {
  it('sorts by ecosystem, then name, then version, by plain string order', () => {
    const rows = [
      resolved({ ecosystem: 'sbt', name: 'a:b', version: '2.0.0' }),
      resolved({ ecosystem: 'pnpm', name: 'zz' }),
      resolved({ ecosystem: 'gradle', name: 'g:h' }),
      resolved({ ecosystem: 'sbt', name: 'a:b', version: '1.0.0' }),
      resolved({ ecosystem: 'pnpm', name: 'aa' }),
    ]
    expect(
      [...rows]
        .sort(compareDependencies)
        .map((row) => `${row.ecosystem}:${row.name}@${row.version}`),
    ).toEqual([
      'gradle:g:h@1.0.0',
      'pnpm:aa@1.0.0',
      'pnpm:zz@1.0.0',
      'sbt:a:b@1.0.0',
      'sbt:a:b@2.0.0',
    ])
  })
})

describe('inventory.md', () => {
  const rows = [
    resolved({ ecosystem: 'gradle', name: 'a:b', ids: ['MIT'] }),
    resolved({ ecosystem: 'pnpm', name: 'c', ids: ['MIT', 'Apache-2.0'] }),
    resolved({ ecosystem: 'sbt', name: 'd:e', source: 'unknown' }),
  ]

  it('counts the dependencies per license, UNKNOWN included', () => {
    expect([...summarise(rows)]).toEqual([
      ['Apache-2.0', 1],
      ['MIT', 2],
      ['UNKNOWN', 1],
    ])
  })

  it('has the summary, the table and the two sections, in that order', () => {
    const headings = renderMarkdown(rows, [], [])
      .split('\n')
      .filter((line) => line.startsWith('## '))
    expect(headings).toEqual([
      '## Summary',
      '## Dependencies',
      '## Failures',
      '## Unused overrides',
    ])
  })

  it('says "None" under each section when there is nothing to say', () => {
    const markdown = renderMarkdown(rows, [], [])
    expect(markdown).toContain('## Failures\n\nNone\n')
    expect(markdown).toContain('## Unused overrides\n\nNone\n')
  })

  it('lists the failures and the unused overrides when there are some', () => {
    const markdown = renderMarkdown(rows, ['UNKNOWN sbt:d:e@1.0.0: no SPDX id for "x"'], ['y'])
    expect(markdown).toContain('- UNKNOWN sbt:d:e@1.0.0: no SPDX id for "x"')
    expect(markdown).toContain('- y')
  })

  it('escapes a pipe so the declared column cannot break the table', () => {
    const markdown = renderMarkdown(
      [
        resolved({
          ecosystem: 'gradle',
          name: 'a:b',
          ids: ['MIT'],
          licenses: [
            { name: 'MIT', url: null },
            { name: 'ISC', url: null },
          ],
        }),
      ],
      [],
      [],
    )
    expect(markdown).toContain('MIT \\| ISC')
  })
})

describe('a failure line names the entry that failed', () => {
  it('quotes the name, or the URL when there is no name', () => {
    expect(
      unknownFailure(
        resolved({
          ecosystem: 'gradle',
          name: 'aopalliance:aopalliance',
          version: '1.0',
          source: 'unknown',
          unresolved: [{ name: 'Public Domain', url: null }],
        }),
      ),
    ).toBe('UNKNOWN gradle:aopalliance:aopalliance@1.0: no SPDX id for "Public Domain"')
    expect(
      unknownFailure(
        resolved({
          ecosystem: 'sbt',
          name: 'a:b',
          source: 'unknown',
          unresolved: [],
        }),
      ),
    ).toBe('UNKNOWN sbt:a:b@1.0.0: the report declares no license entry at all')
  })
})
