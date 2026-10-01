import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { InputError } from '../src/errors.ts'
import { parseGradleReport } from '../src/gradle.ts'
import type { Declared } from '../src/types.ts'
import { FIXTURES, GRADLE_REPORT, GRADLE_SINGLE_REPORT } from './paths.ts'

function byName(dependencies: readonly Declared[], name: string): Declared {
  const found = dependencies.find((dependency) => dependency.name === name)
  if (found === undefined) throw new Error(`no ${name} in the parsed report`)
  return found
}

describe('the Gradle parser on the real report (F10)', () => {
  const dependencies = parseGradleReport(GRADLE_REPORT)

  it('reads the 15 modules of the fixture', () => {
    expect(dependencies).toHaveLength(15)
    expect(dependencies.every((dependency) => dependency.ecosystem === 'gradle')).toBe(true)
  })

  it('reads aopalliance: one entry named "Public Domain" with no URL', () => {
    expect(byName(dependencies, 'aopalliance:aopalliance')).toEqual({
      ecosystem: 'gradle',
      name: 'aopalliance:aopalliance',
      version: '1.0',
      licenses: [{ name: 'Public Domain', url: null }],
      expression: null,
      homepage: 'http://aopalliance.sourceforge.net',
      noticeDirs: [path.join(FIXTURES, 'gradle', 'aopalliance-1.0.jar', 'META-INF')],
    })
  })

  it('reads logback-classic: both licenses, which the default renderer would have dropped', () => {
    expect(byName(dependencies, 'ch.qos.logback:logback-classic').licenses).toEqual([
      { name: 'EPL-2.0', url: 'https://www.eclipse.org/legal/epl-v20.html' },
      { name: 'LGPL-2.1-only', url: 'https://www.gnu.org/licenses/old-licenses/lgpl-2.1.html' },
    ])
  })

  it('reads h2: three entries, the first with a null name and only a URL', () => {
    const h2 = byName(dependencies, 'com.h2database:h2')
    expect(h2.version).toBe('2.5.252')
    expect(h2.licenses).toEqual([
      { name: null, url: 'https://h2database.com/html/license.html' },
      { name: 'EPL 1.0', url: 'https://opensource.org/licenses/eclipse-1.0.php' },
      { name: 'MPL 2.0', url: 'https://www.mozilla.org/en-US/MPL/2.0/' },
    ])
  })

  it('reads jspecify: a null-name entry beside a named one, and the first moduleUrl', () => {
    const jspecify = byName(dependencies, 'org.jspecify:jspecify')
    expect(jspecify.licenses).toEqual([
      { name: null, url: 'https://www.apache.org/licenses/LICENSE-2.0' },
      {
        name: 'The Apache License, Version 2.0',
        url: 'http://www.apache.org/licenses/LICENSE-2.0.txt',
      },
    ])
    expect(jspecify.homepage).toBe('https://jspecify.dev/')
  })

  it('points a module with no moduleUrls at no home page', () => {
    expect(byName(dependencies, 'com.google.guava:listenablefuture').homepage).toBeNull()
  })

  it('builds the notice directory the plugin writes next to index.json', () => {
    expect(byName(dependencies, 'org.slf4j:slf4j-api').noticeDirs).toEqual([
      path.join(FIXTURES, 'gradle', 'slf4j-api-2.0.20.jar', 'META-INF'),
    ])
  })
})

describe('the Gradle parser refuses the default renderer (F10)', () => {
  it('names the renderer setting instead of reading a report that has dropped licenses', () => {
    let thrown: unknown
    try {
      parseGradleReport(GRADLE_SINGLE_REPORT)
    } catch (error) {
      thrown = error
    }
    expect(thrown).toBeInstanceOf(InputError)
    const message = thrown instanceof Error ? thrown.message : ''
    expect(message).toContain('JsonReportRenderer("index.json", false)')
    expect(message).toContain('aopalliance:aopalliance')
    expect(message).toContain('single "moduleLicense"')
  })

  it('refuses a file that is not JSON, and one with no dependencies array', () => {
    expect(() => parseGradleReport(path.join(FIXTURES, 'PROVENANCE.md'))).toThrow(InputError)
    expect(() => parseGradleReport(path.join(FIXTURES, 'nope.json'))).toThrow(InputError)
  })
})
