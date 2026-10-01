import { readFileSync } from 'node:fs'
import path from 'node:path'
import { InputError } from './errors.ts'
import type { Declared } from './types.ts'

type PnpmEntry = {
  readonly name: string
  readonly versions: readonly string[]
  readonly paths: readonly string[]
  readonly license: string
  readonly homepage: string | null
}

function readEntry(raw: unknown, file: string, where: string): PnpmEntry {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new InputError(`${file}: ${where} must be an object`)
  }
  const entry = raw as Record<string, unknown>
  const name = entry.name
  if (typeof name !== 'string' || name === '') {
    throw new InputError(`${file}: ${where}.name must be a non-empty string`)
  }
  const versions = entry.versions
  if (!Array.isArray(versions) || versions.length === 0) {
    throw new InputError(`${file}: ${where}.versions must be a non-empty array`)
  }
  for (const version of versions) {
    if (typeof version !== 'string' || version === '') {
      throw new InputError(`${file}: ${where}.versions holds a value that is not a version string`)
    }
  }
  const paths = entry.paths === undefined ? [] : entry.paths
  if (!Array.isArray(paths)) throw new InputError(`${file}: ${where}.paths must be an array`)
  for (const entryPath of paths) {
    if (typeof entryPath !== 'string') {
      throw new InputError(`${file}: ${where}.paths holds a value that is not a path`)
    }
  }
  const license = entry.license
  if (typeof license !== 'string') {
    throw new InputError(`${file}: ${where}.license must be a string`)
  }
  const homepage = entry.homepage
  return {
    name,
    versions: versions as readonly string[],
    paths: paths as readonly string[],
    license,
    homepage: typeof homepage === 'string' && homepage !== '' ? homepage : null,
  }
}

/** The version a package directory declares, or null when it cannot be read. */
function installedVersion(directory: string): string | null {
  try {
    const manifest: unknown = JSON.parse(readFileSync(path.join(directory, 'package.json'), 'utf8'))
    if (manifest === null || typeof manifest !== 'object') return null
    const version = (manifest as Record<string, unknown>).version
    return typeof version === 'string' ? version : null
  } catch {
    return null
  }
}

/**
 * Reads `pnpm --filter <pkg> licenses list --json --prod`: an object keyed by the license string,
 * each value a list of packages (F8). One dependency row per name × version.
 *
 * `paths` may be relative; it is resolved against `pnpmRoot`, which is how the committed fixture
 * can hold repository-relative paths instead of this machine's home directory. When an entry lists
 * several versions, each path is assigned to the version its own `package.json` declares — the
 * report does not say which path belongs to which version, and guessing is not allowed.
 */
export function parsePnpmReport(file: string, pnpmRoot: string): Declared[] {
  let document: unknown
  try {
    document = JSON.parse(readFileSync(file, 'utf8'))
  } catch (cause) {
    throw new InputError(`${file}: cannot read or parse the pnpm report (${String(cause)})`)
  }
  if (document === null || typeof document !== 'object' || Array.isArray(document)) {
    throw new InputError(
      `${file}: the pnpm report must be an object keyed by license string. ` +
        'At a workspace root the command needs --filter <package> (F8).',
    )
  }

  const parsed: Declared[] = []
  for (const [licenseKey, rawList] of Object.entries(document as Record<string, unknown>)) {
    if (!Array.isArray(rawList)) {
      throw new InputError(`${file}: the value of "${licenseKey}" must be an array of packages`)
    }
    for (const [index, raw] of rawList.entries()) {
      const entry = readEntry(raw, file, `["${licenseKey}"][${index}]`)
      const resolvedPaths = entry.paths.map((entryPath) => path.resolve(pnpmRoot, entryPath))
      for (const version of entry.versions) {
        const noticeDirs =
          entry.versions.length === 1
            ? resolvedPaths
            : resolvedPaths.filter((directory) => installedVersion(directory) === version)
        parsed.push({
          ecosystem: 'pnpm',
          name: entry.name,
          version,
          licenses: [{ name: entry.license === '' ? null : entry.license, url: null }],
          expression: entry.license,
          homepage: entry.homepage,
          noticeDirs,
        })
      }
    }
  }
  return parsed
}
