import parseExpression from 'spdx-expression-parse'
import type { AliasTable } from './aliases.ts'
import { urlKey } from './aliases.ts'
import { canonicalSpdxId, isLicenseRef } from './spdx.ts'
import type { Declared, DeclaredLicense, LicenseSource, Resolved } from './types.ts'

type EntryResult =
  | { readonly kind: 'alias'; readonly id: string }
  | { readonly kind: 'declared'; readonly ids: readonly string[] }
  | { readonly kind: 'unknown' }

const UNKNOWN: EntryResult = { kind: 'unknown' }

function collectExpressionIds(info: parseExpression.Info, into: string[]): void {
  if ('license' in info) {
    into.push(info.license)
    return
  }
  collectExpressionIds(info.left, into)
  collectExpressionIds(info.right, into)
}

/**
 * Step 2, pnpm only: the `license` string parses as an SPDX expression (F9) and every id in it is
 * either one spdx-license-list knows or a `LicenseRef-*`. Returns null when the string is not an
 * expression, so that steps 3 to 5 still run.
 */
function resolveExpression(expression: string): readonly string[] | null {
  let info: parseExpression.Info
  try {
    info = parseExpression(expression)
  } catch {
    return null
  }
  const ids: string[] = []
  collectExpressionIds(info, ids)
  if (ids.length === 0) return null
  const checked: string[] = []
  for (const id of ids) {
    if (isLicenseRef(id)) {
      checked.push(id)
      continue
    }
    const canonical = canonicalSpdxId(id)
    if (canonical === null) return null
    checked.push(canonical)
  }
  return checked
}

/** Steps 1, 3 and 4 for one declared entry; step 5 is the `unknown` result. */
function resolveEntry(entry: DeclaredLicense, aliases: AliasTable): EntryResult {
  const name = entry.name === null ? '' : entry.name.trim()
  if (name !== '') {
    const canonical = canonicalSpdxId(name) // step 1
    if (canonical !== null) return { kind: 'declared', ids: [canonical] }
    const aliased = aliases.names.get(name) // step 3
    if (aliased !== undefined) return { kind: 'alias', id: aliased }
    return UNKNOWN // step 5: a name that is neither an id nor an alias is never guessed at
  }
  const url = entry.url === null ? '' : entry.url.trim()
  if (url !== '') {
    const aliased = aliases.urls.get(urlKey(url)) // step 4: only when the name is empty or null
    if (aliased !== undefined) return { kind: 'alias', id: aliased }
  }
  return UNKNOWN
}

function sortedUnique(ids: readonly string[]): string[] {
  return [...new Set(ids)].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
}

/**
 * Normalisation, in the order SCOPE.md gives. One UNKNOWN entry makes the whole dependency UNKNOWN
 * even when its other entries mapped — the H2 case of F10 — and a dependency with no license entry
 * at all is UNKNOWN too.
 */
export function resolveDependency(declared: Declared, aliases: AliasTable): Resolved {
  if (declared.expression !== null) {
    const expression = declared.expression.trim()
    const canonical = expression === '' ? null : canonicalSpdxId(expression) // step 1
    if (canonical !== null) {
      return { ...declared, ids: [canonical], source: 'declared', unresolved: [] }
    }
    const fromExpression = expression === '' ? null : resolveExpression(expression) // step 2
    if (fromExpression !== null) {
      return { ...declared, ids: sortedUnique(fromExpression), source: 'declared', unresolved: [] }
    }
    const aliased = expression === '' ? undefined : aliases.names.get(expression) // step 3
    if (aliased !== undefined) {
      return { ...declared, ids: [aliased], source: 'alias', unresolved: [] }
    }
    return {
      ...declared,
      ids: [],
      source: 'unknown',
      unresolved: declared.licenses.length > 0 ? declared.licenses : [{ name: null, url: null }],
    }
  }

  const ids: string[] = []
  const unresolved: DeclaredLicense[] = []
  let usedAlias = false
  for (const entry of declared.licenses) {
    const result = resolveEntry(entry, aliases)
    if (result.kind === 'unknown') {
      unresolved.push(entry)
    } else if (result.kind === 'alias') {
      usedAlias = true
      ids.push(result.id)
    } else {
      ids.push(...result.ids)
    }
  }

  const unknown = unresolved.length > 0 || ids.length === 0
  const source: LicenseSource = unknown ? 'unknown' : usedAlias ? 'alias' : 'declared'
  return {
    ...declared,
    ids: unknown ? [] : sortedUnique(ids),
    source,
    unresolved,
  }
}
