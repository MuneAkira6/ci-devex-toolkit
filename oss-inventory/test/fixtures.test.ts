import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

// G0's first test. The given Gradle and sbt fixtures are real tool output kept byte for byte, and the
// parsers of G1 are written against these bytes: this test holds them to what facts F10 and F11 record,
// so that a change in a fixture shows up as a failure here rather than as a changed inventory later.

const FIXTURES = path.join(import.meta.dirname, '..', 'fixtures')

function readFixture(...parts: string[]): string {
  return readFileSync(path.join(FIXTURES, ...parts), 'utf8')
}

type GradleEntry = { moduleLicense: string | null; moduleLicenseUrl: string }

type GradleReport = {
  dependencies: {
    moduleName: string
    moduleVersion: string
    moduleLicenses?: GradleEntry[]
    moduleLicense?: string | null
  }[]
  importedModules: unknown[]
}

function readGradleReport(dir: string): GradleReport {
  return JSON.parse(readFixture(dir, 'index.json')) as GradleReport
}

function licensesOf(report: GradleReport, moduleName: string): GradleEntry[] {
  const found = report.dependencies.find((d) => d.moduleName === moduleName)
  if (found === undefined) throw new Error(`no dependency ${moduleName} in the report`)
  return found.moduleLicenses ?? []
}

describe('the sbt fixture (F11)', () => {
  const csv = readFixture('sbt', 'acme-tasks-api-licenses.csv')
  const lines = csv.split('\n')

  it('has the header sbt-license-report 1.10.0 writes', () => {
    expect(lines[0]).toBe('Category,License,Dependency,Notes')
  })

  it('has 16 data lines and ends with a single newline', () => {
    expect(lines.filter((line) => line !== '')).toHaveLength(17)
    expect(csv.endsWith('\n')).toBe(true)
    expect(csv).not.toContain('\r')
  })

  it('keeps one license per dependency, so logback shows LGPL-2.1-only alone', () => {
    const logback = lines.filter((line) => line.includes('ch.qos.logback # logback-classic'))
    expect(logback).toEqual([
      'LGPL,LGPL-2.1-only (https://www.gnu.org/licenses/old-licenses/lgpl-2.1.html),' +
        'ch.qos.logback # logback-classic # 1.6.5,',
    ])
  })
})

describe('the Gradle fixtures (F10)', () => {
  it('both reports describe the same 15 modules', () => {
    expect(readGradleReport('gradle').dependencies).toHaveLength(15)
    expect(readGradleReport('gradle-single').dependencies).toHaveLength(15)
  })

  it('the committed report keeps every license of a multi-licensed module', () => {
    expect(licensesOf(readGradleReport('gradle'), 'ch.qos.logback:logback-classic')).toEqual([
      { moduleLicense: 'EPL-2.0', moduleLicenseUrl: 'https://www.eclipse.org/legal/epl-v20.html' },
      {
        moduleLicense: 'LGPL-2.1-only',
        moduleLicenseUrl: 'https://www.gnu.org/licenses/old-licenses/lgpl-2.1.html',
      },
    ])
  })

  it('a license entry can carry a null name and only a URL', () => {
    const h2 = licensesOf(readGradleReport('gradle'), 'com.h2database:h2')
    expect(h2.map((entry) => entry.moduleLicense)).toEqual([null, 'EPL 1.0', 'MPL 2.0'])
    expect(h2[0]?.moduleLicenseUrl).toBe('https://h2database.com/html/license.html')
  })

  it('the default renderer wrote the single-license shape the tool must refuse', () => {
    const single = readGradleReport('gradle-single')
    const logback = single.dependencies.find(
      (d) => d.moduleName === 'ch.qos.logback:logback-classic',
    )
    expect(logback?.moduleLicense).toBe('LGPL-2.1-only')
    expect(logback?.moduleLicenses).toBeUndefined()
  })
})
