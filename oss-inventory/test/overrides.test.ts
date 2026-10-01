import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { InputError } from '../src/errors.ts'
import { loadOverrides } from '../src/overrides.ts'
import { SAMPLES } from './paths.ts'
import { temporaryFile } from './tmp.ts'

const VALID = `- id: gradle:aopalliance:aopalliance@1.0
  licenses: [LicenseRef-Public-Domain]
  reason: The POM declares a single license named "Public Domain", with no URL.
  source: https://repo1.maven.org/maven2/aopalliance/aopalliance/1.0/aopalliance-1.0.pom
  reviewed: 2026-10-01
`

function writeOverrides(content: string): string {
  return temporaryFile('ovr', 'overrides.yml', content)
}

/** The given file with one field replaced, so each control differs from a valid entry by one line. */
function withLine(from: string, to: string): string {
  return writeOverrides(VALID.replace(from, to))
}

describe('the given sample overrides (F17)', () => {
  const overrides = loadOverrides(path.join(SAMPLES, 'overrides.yml'))

  it('holds the two human rulings, split into ecosystem, name and version', () => {
    expect(
      overrides.map((override) => [
        override.ecosystem,
        override.name,
        override.version,
        [...override.licenses],
      ]),
    ).toEqual([
      ['gradle', 'aopalliance:aopalliance', '1.0', ['LicenseRef-Public-Domain']],
      ['gradle', 'com.h2database:h2', '2.5.252', ['MPL-2.0', 'EPL-1.0']],
    ])
  })

  it('carries a reason, a source and a review date for each', () => {
    for (const override of overrides) {
      expect(override.reason.length).toBeGreaterThan(20)
      expect(override.source).toMatch(/^https:\/\//)
      expect(override.reviewed).toBe('2026-10-01')
    }
  })
})

describe('an invalid overrides entry is an input error that names the entry', () => {
  it('accepts the control fixture these cases are derived from', () => {
    expect(loadOverrides(writeOverrides(VALID))).toHaveLength(1)
  })

  it('refuses a missing reason', () => {
    expect(() =>
      loadOverrides(withLine('  reason: The POM declares', '  xreason: The POM declares')),
    ).toThrow(/entry 1 \(gradle:aopalliance:aopalliance@1.0\): unknown field "xreason"/)
    const dropped = VALID.split('\n')
      .filter((line) => !line.startsWith('  reason:'))
      .join('\n')
    expect(() => loadOverrides(writeOverrides(dropped))).toThrow(
      /entry 1 \(gradle:aopalliance:aopalliance@1.0\): "reason" is missing/,
    )
  })

  it('refuses an empty reason, an empty source and a missing reviewed date', () => {
    expect(() =>
      loadOverrides(
        withLine(
          'reason: The POM declares a single license named "Public Domain", with no URL.',
          "reason: ''",
        ),
      ),
    ).toThrow(/"reason" must be a non-empty string/)
    expect(() =>
      loadOverrides(
        writeOverrides(
          VALID.split('\n')
            .filter((l) => !l.startsWith('  reviewed:'))
            .join('\n'),
        ),
      ),
    ).toThrow(/"reviewed" is missing/)
  })

  it('refuses a review date that is not YYYY-MM-DD', () => {
    expect(() => loadOverrides(withLine('reviewed: 2026-10-01', 'reviewed: last week'))).toThrow(
      /"reviewed" must be a date, YYYY-MM-DD, not "last week"/,
    )
  })

  it('refuses an unknown ecosystem', () => {
    expect(() => loadOverrides(withLine('id: gradle:', 'id: maven:'))).toThrow(
      /"maven" is not an ecosystem; use one of gradle, pnpm, sbt/,
    )
  })

  it('refuses a malformed id', () => {
    expect(() =>
      loadOverrides(withLine('id: gradle:aopalliance:aopalliance@1.0', 'id: gradle:aopalliance')),
    ).toThrow(/is not <ecosystem>:<name>@<version>/)
  })

  it('refuses an empty licenses list and a license that is not an id', () => {
    expect(() =>
      loadOverrides(withLine('licenses: [LicenseRef-Public-Domain]', 'licenses: []')),
    ).toThrow(/"licenses" must be a non-empty list of SPDX ids/)
    expect(() =>
      loadOverrides(withLine('licenses: [LicenseRef-Public-Domain]', 'licenses: [Public Domain]')),
    ).toThrow(/"Public Domain" is neither an SPDX id/)
  })

  it('refuses a duplicate id, naming both entries', () => {
    expect(() => loadOverrides(writeOverrides(VALID + VALID))).toThrow(
      /entry 2 \(gradle:aopalliance:aopalliance@1.0\).*is already overridden by entry 1/,
    )
  })

  it('refuses a file that is not a YAML list, and one it cannot read', () => {
    expect(() => loadOverrides(writeOverrides('id: gradle:a:b@1\n'))).toThrow(
      /must be a YAML list of entries/,
    )
    expect(() => loadOverrides(path.join(tmpdir(), 'ci-devex-absent.yml'))).toThrow(InputError)
  })

  it('writes an SPDX id of the ruling in its canonical case', () => {
    const overrides = loadOverrides(
      withLine('licenses: [LicenseRef-Public-Domain]', 'licenses: [mit]'),
    )
    expect(overrides[0]?.licenses).toEqual(['MIT'])
  })
})
