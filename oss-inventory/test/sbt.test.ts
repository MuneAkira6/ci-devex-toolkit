import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { InputError } from '../src/errors.ts'
import { parseSbtReport, SBT_HEADER } from '../src/sbt.ts'
import type { Declared } from '../src/types.ts'
import { SBT_REPORT } from './paths.ts'
import { temporaryFile } from './tmp.ts'

function byName(dependencies: readonly Declared[], name: string): Declared {
  const found = dependencies.find((dependency) => dependency.name === name)
  if (found === undefined) throw new Error(`no ${name} in the parsed report`)
  return found
}

function writeTemporary(name: string, content: string): string {
  return temporaryFile('sbt', name, content)
}

describe('the sbt parser on the real report (F11)', () => {
  const dependencies = parseSbtReport(SBT_REPORT)

  it('reads the 16 dependencies of the fixture', () => {
    expect(dependencies).toHaveLength(16)
    expect(dependencies.every((dependency) => dependency.ecosystem === 'sbt')).toBe(true)
    expect(SBT_HEADER.join(',')).toBe('Category,License,Dependency,Notes')
  })

  it('splits group, artifact, version, license name, license URL and home page', () => {
    expect(byName(dependencies, 'com.typesafe:config')).toEqual({
      ecosystem: 'sbt',
      name: 'com.typesafe:config',
      version: '1.4.9',
      licenses: [{ name: 'Apache-2.0', url: 'https://www.apache.org/licenses/LICENSE-2.0' }],
      expression: null,
      homepage: 'https://github.com/lightbend/config',
      noticeDirs: [],
    })
  })

  it('reads a dependency with no home page: the cell carries no trailing URL', () => {
    expect(byName(dependencies, 'ch.qos.logback:logback-classic')).toEqual({
      ecosystem: 'sbt',
      name: 'ch.qos.logback:logback-classic',
      version: '1.6.5',
      licenses: [
        {
          name: 'LGPL-2.1-only',
          url: 'https://www.gnu.org/licenses/old-licenses/lgpl-2.1.html',
        },
      ],
      expression: null,
      homepage: null,
      noticeDirs: [],
    })
  })

  it('reads a license name that is not an SPDX id', () => {
    expect(byName(dependencies, 'org.checkerframework:checker-qual').licenses).toEqual([
      { name: 'The MIT License', url: 'https://opensource.org/licenses/MIT' },
    ])
  })

  it('shows the plugin keeping one license per dependency, logback included', () => {
    const multi = dependencies.filter((dependency) => dependency.licenses.length !== 1)
    expect(multi).toEqual([])
  })
})

describe('the sbt parser refuses what it cannot read', () => {
  it('refuses a different header, naming the line', () => {
    const file = writeTemporary('wrong.csv', 'License,Dependency\nMIT,a # b # 1\n')
    expect(() => parseSbtReport(file)).toThrow(/:1: expected the header "Category,License/)
  })

  it('refuses a dependency cell that is not <group> # <artifact> # <version>', () => {
    const file = writeTemporary(
      'bad.csv',
      'Category,License,Dependency,Notes\nMIT,MIT (https://x/),com.example:thing:1.0,\n',
    )
    expect(() => parseSbtReport(file)).toThrow(/:2: expected "<group> # <artifact> # <version>"/)
  })

  it('refuses a row with the wrong number of fields', () => {
    const file = writeTemporary(
      'short.csv',
      'Category,License,Dependency,Notes\nMIT,MIT,a # b # 1\n',
    )
    expect(() => parseSbtReport(file)).toThrow(/:2: expected 4 fields, found 3/)
  })

  it('refuses a file it cannot read', () => {
    expect(() => parseSbtReport(path.join(tmpdir(), 'ci-devex-absent.csv'))).toThrow(InputError)
  })

  it('merges two rows that name the same dependency, so no license is lost', () => {
    const file = writeTemporary(
      'two.csv',
      'Category,License,Dependency,Notes\n' +
        'EPL,EPL-2.0 (https://e/),ch.qos.logback # logback-classic # 1.6.5,\n' +
        'LGPL,LGPL-2.1-only (https://l/),ch.qos.logback # logback-classic # 1.6.5,\n',
    )
    const dependencies = parseSbtReport(file)
    expect(dependencies).toHaveLength(1)
    expect(dependencies[0]?.licenses).toEqual([
      { name: 'EPL-2.0', url: 'https://e/' },
      { name: 'LGPL-2.1-only', url: 'https://l/' },
    ])
  })
})
