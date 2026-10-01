import { readFileSync } from 'node:fs'
import { parse as parseYaml } from 'yaml'
import { InputError } from './errors.ts'
import { canonicalSpdxId, isLicenseRef } from './spdx.ts'

export type AliasTable = {
  /** Declared name (trimmed, compared exactly) → SPDX id. */
  readonly names: ReadonlyMap<string, string>
  /** URL comparison key (see `urlKey`) → SPDX id. */
  readonly urls: ReadonlyMap<string, string>
}

export const EMPTY_ALIASES: AliasTable = { names: new Map(), urls: new Map() }

/**
 * The comparison key of a URL. SCOPE.md strips the scheme, a leading `www.` and one trailing `/`,
 * and nothing else: `…/licenses/LICENSE-2.0` and `…/licenses/LICENSE-2.0.txt` stay two different
 * keys. Widening this would be guessing.
 */
export function urlKey(url: string): string {
  let key = url.trim().replace(/^[A-Za-z][A-Za-z0-9+.-]*:\/\//, '')
  if (key.startsWith('www.')) key = key.slice(4)
  if (key.endsWith('/')) key = key.slice(0, -1)
  return key
}

function requireId(value: unknown, where: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new InputError(`${where}: the alias target must be a non-empty string`)
  }
  const target = value.trim()
  if (isLicenseRef(target)) return target
  const canonical = canonicalSpdxId(target)
  if (canonical === null) {
    throw new InputError(
      `${where}: "${target}" is neither an SPDX id spdx-license-list knows nor a LicenseRef-*`,
    )
  }
  if (canonical !== target) {
    throw new InputError(`${where}: write the SPDX id in its canonical case, "${canonical}"`)
  }
  return target
}

function section(raw: unknown, file: string, key: 'names' | 'urls'): Map<string, unknown> {
  if (raw === undefined || raw === null) return new Map()
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    throw new InputError(`${file}: "${key}" must be a mapping of strings to SPDX ids`)
  }
  return new Map(Object.entries(raw as Record<string, unknown>))
}

/** Reads `aliases.yml`. Every target is checked, so a typo in the table is an input error. */
export function loadAliases(file: string): AliasTable {
  let document: unknown
  try {
    document = parseYaml(readFileSync(file, 'utf8'))
  } catch (cause) {
    throw new InputError(`${file}: cannot read or parse the alias table (${String(cause)})`)
  }
  if (document === null || typeof document !== 'object' || Array.isArray(document)) {
    throw new InputError(`${file}: the alias table must be a mapping with "names" and "urls"`)
  }
  const record = document as Record<string, unknown>
  for (const key of Object.keys(record)) {
    if (key !== 'names' && key !== 'urls') {
      throw new InputError(`${file}: unknown section "${key}"; only "names" and "urls" are read`)
    }
  }

  const names = new Map<string, string>()
  for (const [rawName, target] of section(record.names, file, 'names')) {
    const name = rawName.trim()
    if (name === '') throw new InputError(`${file}: names holds an empty key`)
    if (names.has(name)) throw new InputError(`${file}: names lists "${name}" twice`)
    names.set(name, requireId(target, `${file}: names["${name}"]`))
  }

  const urls = new Map<string, string>()
  for (const [rawUrl, target] of section(record.urls, file, 'urls')) {
    const key = urlKey(rawUrl)
    if (key === '') throw new InputError(`${file}: urls holds an empty key`)
    if (urls.has(key)) {
      throw new InputError(`${file}: urls lists "${rawUrl}" twice (compared as "${key}")`)
    }
    urls.set(key, requireId(target, `${file}: urls["${rawUrl}"]`))
  }

  return { names, urls }
}
