import { readFileSync } from 'node:fs'
import { parseCsv } from './csv.ts'
import { InputError } from './errors.ts'
import type { Declared, DeclaredLicense } from './types.ts'

/** The header sbt-license-report 1.10.0 writes (F11). A different one is an input error. */
export const SBT_HEADER = ['Category', 'License', 'Dependency', 'Notes'] as const

/**
 * Splits a trailing ` (<url>)` off a cell. sbt-license-report writes both the license and the
 * dependency that way: `<name> (<url>)` and `<group> # <artifact> # <version> (<url>)` (F11).
 */
function splitTrailingUrl(cell: string): { readonly head: string; readonly url: string | null } {
  const text = cell.trim()
  if (!text.endsWith(')')) return { head: text, url: null }
  const open = text.lastIndexOf(' (')
  if (open < 0) return { head: text, url: null }
  const url = text.slice(open + 2, -1).trim()
  if (url === '') return { head: text, url: null }
  return { head: text.slice(0, open).trim(), url }
}

/**
 * Reads a `sbt dumpLicenseReport` CSV. The plugin keeps one license per dependency and cannot say
 * what it dropped (F11); the tool reads what the CSV says and the README states the limit. Two rows
 * for the same dependency are merged, so nothing is lost if a future plugin writes several.
 */
export function parseSbtReport(file: string): Declared[] {
  let text: string
  try {
    text = readFileSync(file, 'utf8')
  } catch (cause) {
    throw new InputError(`${file}: cannot read the sbt report (${String(cause)})`)
  }

  const rows = parseCsv(text)
  const header = rows[0]
  if (header === undefined) throw new InputError(`${file}: the sbt report is empty`)
  if (header.fields.join(',') !== SBT_HEADER.join(',')) {
    throw new InputError(
      `${file}:1: expected the header "${SBT_HEADER.join(',')}", found ` +
        `"${header.fields.join(',')}"`,
    )
  }

  const byIdentity = new Map<string, Declared>()
  const order: string[] = []
  for (const row of rows.slice(1)) {
    if (row.fields.length !== SBT_HEADER.length) {
      throw new InputError(
        `${file}:${row.line}: expected ${SBT_HEADER.length} fields, found ${row.fields.length}`,
      )
    }
    const [, licenseCell, dependencyCell] = row.fields as [string, string, string, string]

    const dependency = splitTrailingUrl(dependencyCell)
    const coordinates = dependency.head.split(' # ')
    if (coordinates.length !== 3 || coordinates.some((part) => part.trim() === '')) {
      throw new InputError(
        `${file}:${row.line}: expected "<group> # <artifact> # <version>", found ` +
          `"${dependency.head}"`,
      )
    }
    const [group, artifact, version] = coordinates as [string, string, string]
    const name = `${group.trim()}:${artifact.trim()}`

    const license = splitTrailingUrl(licenseCell)
    const entry: DeclaredLicense = {
      name: license.head === '' ? null : license.head,
      url: license.url,
    }

    const identity = `${name}@${version.trim()}`
    const existing = byIdentity.get(identity)
    if (existing === undefined) {
      order.push(identity)
      byIdentity.set(identity, {
        ecosystem: 'sbt',
        name,
        version: version.trim(),
        licenses: [entry],
        expression: null,
        homepage: dependency.url,
        noticeDirs: [], // sbt-license-report provides no license files (SCOPE.md)
      })
    } else {
      byIdentity.set(identity, { ...existing, licenses: [...existing.licenses, entry] })
    }
  }

  return order.map((identity) => {
    const dependency = byIdentity.get(identity)
    if (dependency === undefined) throw new Error(`lost ${identity} while reading ${file}`)
    return dependency
  })
}
