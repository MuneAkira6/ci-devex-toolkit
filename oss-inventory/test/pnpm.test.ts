import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { InputError } from '../src/errors.ts'
import { parsePnpmReport } from '../src/pnpm.ts'
import { PNPM_REPORT, REPO_ROOT } from './paths.ts'

type RawReport = Record<
  string,
  { name: string; versions: string[]; paths: string[]; license: string }[]
>

describe('the committed pnpm fixture', () => {
  const raw = readFileSync(PNPM_REPORT, 'utf8')
  const report = JSON.parse(raw) as RawReport

  it('holds no absolute path, so the machine it was taken on cannot be read off it', () => {
    const absolute = Object.values(report)
      .flat()
      .flatMap((entry) => entry.paths)
      .filter((entryPath) => entryPath.startsWith('/') || /^[A-Za-z]:[\\/]/.test(entryPath))
    expect(absolute).toEqual([])
  })

  it('is shaped the way F8 records: keyed by license string, entries with name and versions', () => {
    expect(Object.keys(report).sort()).toEqual(['0BSD', 'Apache-2.0', 'BSD-3-Clause', 'ISC', 'MIT'])
    expect(raw.endsWith('\n')).toBe(true)
  })
})

describe('the pnpm parser', () => {
  const dependencies = parsePnpmReport(PNPM_REPORT, REPO_ROOT)
  const report = JSON.parse(readFileSync(PNPM_REPORT, 'utf8')) as RawReport

  it('writes one row per name and version, and counts what the report counts', () => {
    expect(dependencies).toHaveLength(25)
    const counts = new Map<string, number>()
    for (const dependency of dependencies) {
      const key = dependency.expression ?? ''
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    const fromReport = new Map(
      Object.entries(report).map(([license, entries]) => [
        license,
        entries.reduce((total, entry) => total + entry.versions.length, 0),
      ]),
    )
    expect([...counts].sort()).toEqual([...fromReport].sort())
  })

  it('keeps the license string as declared and resolves the paths against --pnpm-root', () => {
    const react = dependencies.find((dependency) => dependency.name === 'react')
    expect(react?.version).toBe('19.3.0')
    expect(react?.expression).toBe('MIT')
    expect(react?.licenses).toEqual([{ name: 'MIT', url: null }])
    expect(react?.homepage).toBe('https://react.dev/')
    expect(react?.noticeDirs).toEqual([
      path.join(REPO_ROOT, 'node_modules', '.pnpm', 'react@19.3.0', 'node_modules', 'react'),
    ])
  })

  it('refuses the shape the command prints without --filter at a workspace root (F8)', () => {
    expect(() => parsePnpmReport(path.join(REPO_ROOT, 'package.json'), REPO_ROOT)).toThrow(
      InputError,
    )
  })
})
