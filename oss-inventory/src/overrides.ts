import { readFileSync } from 'node:fs'
import { parse as parseYaml } from 'yaml'
import { InputError } from './errors.ts'
import { canonicalSpdxId, isLicenseRef } from './spdx.ts'
import type { Ecosystem } from './types.ts'

const ECOSYSTEMS: readonly string[] = ['gradle', 'pnpm', 'sbt']
const REVIEWED = /^[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]$/

/** A human ruling: the licenses of one dependency, with the reason and the source behind it. */
export type Override = {
  readonly id: string
  readonly ecosystem: Ecosystem
  readonly name: string
  readonly version: string
  readonly licenses: readonly string[]
  readonly reason: string
  readonly source: string
  readonly reviewed: string
}

function requireText(entry: Record<string, unknown>, field: string, where: string): string {
  const value = entry[field]
  if (value === undefined || value === null) {
    throw new InputError(`${where}: "${field}" is missing`)
  }
  if (typeof value !== 'string' || value.trim() === '') {
    throw new InputError(`${where}: "${field}" must be a non-empty string`)
  }
  return value.trim()
}

/** Splits `<ecosystem>:<name>@<version>`; the version is everything after the last `@`. */
function splitIdentity(
  id: string,
  where: string,
): Omit<Override, 'licenses' | 'reason' | 'source' | 'reviewed'> {
  const colon = id.indexOf(':')
  if (colon <= 0) {
    throw new InputError(`${where}: "${id}" is not <ecosystem>:<name>@<version>`)
  }
  const ecosystem = id.slice(0, colon)
  if (!ECOSYSTEMS.includes(ecosystem)) {
    throw new InputError(
      `${where}: "${ecosystem}" is not an ecosystem; use one of ${ECOSYSTEMS.join(', ')}`,
    )
  }
  const rest = id.slice(colon + 1)
  const at = rest.lastIndexOf('@')
  if (at <= 0 || at === rest.length - 1) {
    throw new InputError(`${where}: "${id}" is not <ecosystem>:<name>@<version>`)
  }
  return {
    id,
    ecosystem: ecosystem as Ecosystem,
    name: rest.slice(0, at),
    version: rest.slice(at + 1),
  }
}

function requireLicenses(entry: Record<string, unknown>, where: string): string[] {
  const value = entry.licenses
  if (value === undefined || value === null) {
    throw new InputError(`${where}: "licenses" is missing`)
  }
  if (!Array.isArray(value) || value.length === 0) {
    throw new InputError(`${where}: "licenses" must be a non-empty list of SPDX ids`)
  }
  const licenses: string[] = []
  for (const raw of value) {
    if (typeof raw !== 'string' || raw.trim() === '') {
      throw new InputError(`${where}: "licenses" holds an entry that is not a license id`)
    }
    const license = raw.trim()
    if (isLicenseRef(license)) {
      licenses.push(license)
      continue
    }
    const canonical = canonicalSpdxId(license)
    if (canonical === null) {
      throw new InputError(
        `${where}: "${license}" is neither an SPDX id spdx-license-list knows nor a LicenseRef-*`,
      )
    }
    licenses.push(canonical)
  }
  return licenses
}

/**
 * Reads an overrides file. Every ruling must carry its reason, its source and the date it was
 * reviewed; a missing field, an unknown ecosystem, a malformed id or a duplicate id is an input
 * error that names the entry (SCOPE.md, "Overrides").
 */
export function loadOverrides(file: string): Override[] {
  let document: unknown
  try {
    document = parseYaml(readFileSync(file, 'utf8'))
  } catch (cause) {
    throw new InputError(`${file}: cannot read or parse the overrides (${String(cause)})`)
  }
  if (!Array.isArray(document)) {
    throw new InputError(`${file}: the overrides must be a YAML list of entries`)
  }

  const overrides: Override[] = []
  const seen = new Map<string, number>()
  for (const [index, raw] of document.entries()) {
    const position = `${file}: entry ${index + 1}`
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
      throw new InputError(`${position}: each entry must be a mapping`)
    }
    const entry = raw as Record<string, unknown>
    const id = requireText(entry, 'id', position)
    const where = `${file}: entry ${index + 1} (${id})`
    for (const key of Object.keys(entry)) {
      if (!['id', 'licenses', 'reason', 'source', 'reviewed'].includes(key)) {
        throw new InputError(`${where}: unknown field "${key}"`)
      }
    }
    const identity = splitIdentity(id, where)
    const previous = seen.get(id)
    if (previous !== undefined) {
      throw new InputError(`${where}: "${id}" is already overridden by entry ${previous}`)
    }
    seen.set(id, index + 1)

    const reviewed = requireText(entry, 'reviewed', where)
    if (!REVIEWED.test(reviewed)) {
      throw new InputError(`${where}: "reviewed" must be a date, YYYY-MM-DD, not "${reviewed}"`)
    }
    overrides.push({
      ...identity,
      licenses: requireLicenses(entry, where),
      reason: requireText(entry, 'reason', where),
      source: requireText(entry, 'source', where),
      reviewed,
    })
  }
  return overrides
}
