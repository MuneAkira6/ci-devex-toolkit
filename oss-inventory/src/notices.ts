import type { Dirent } from 'node:fs'
import { copyFileSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import type { Resolved } from './types.ts'

// SCOPE.md: for pnpm, the LICENSE*, LICENCE*, COPYING* and NOTICE* files at the root of a package
// path. The prefixes are matched as written, so a lower-case `license` file is not picked up.
const PNPM_PREFIXES: readonly string[] = ['LICENSE', 'LICENCE', 'COPYING', 'NOTICE']

/** The directory a dependency's notices go to: `:` in a Gradle module name becomes `__`. */
export function noticeDirectory(dependency: Resolved): string {
  return path.join(
    'notices',
    dependency.ecosystem,
    `${dependency.name.replaceAll(':', '__')}@${dependency.version}`,
  )
}

function listFiles(directory: string, prefix: string): string[] {
  let entries: Dirent[]
  try {
    entries = readdirSync(directory, { withFileTypes: true })
  } catch {
    return [] // a package path the report lists but this machine does not have
  }
  const files: string[] = []
  for (const entry of entries) {
    const relative = prefix === '' ? entry.name : path.posix.join(prefix, entry.name)
    if (entry.isDirectory()) {
      files.push(...listFiles(path.join(directory, entry.name), relative))
    } else if (entry.isFile()) {
      files.push(relative)
    }
  }
  return files.sort()
}

/**
 * Copies the files an input provides, byte for byte: `copyFileSync` never touches the bytes, so the
 * one license file that ships with CRLF line ends keeps them (F10).
 *
 * For pnpm, the matching files at the root of each package path that exists; for Gradle, everything
 * under `<artifact>-<version>.jar/META-INF/`. sbt provides none.
 */
export function copyNotices(dependency: Resolved, outDir: string): string[] {
  const written: string[] = []
  const target = path.join(outDir, noticeDirectory(dependency))
  for (const source of dependency.noticeDirs) {
    const candidates =
      dependency.ecosystem === 'pnpm'
        ? listFiles(source, '').filter(
            (file) =>
              !file.includes('/') && PNPM_PREFIXES.some((prefix) => file.startsWith(prefix)),
          )
        : listFiles(source, '')
    for (const file of candidates) {
      const from = path.join(source, file)
      if (!statSync(from).isFile()) continue
      const to = path.join(target, file)
      mkdirSync(path.dirname(to), { recursive: true })
      copyFileSync(from, to)
      written.push(path.posix.join(noticeDirectory(dependency).replaceAll(path.sep, '/'), file))
    }
  }
  return written.sort()
}
