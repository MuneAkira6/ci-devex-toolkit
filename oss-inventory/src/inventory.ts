import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import type { AliasTable } from './aliases.ts'
import { loadAliases } from './aliases.ts'
import { InputError } from './errors.ts'
import { parseGradleReport } from './gradle.ts'
import { copyNotices } from './notices.ts'
import type { Override } from './overrides.ts'
import { loadOverrides } from './overrides.ts'
import { parsePnpmReport } from './pnpm.ts'
import { compareDependencies, renderCsv, renderMarkdown, unknownFailure } from './report.ts'
import { resolveDependency } from './resolve.ts'
import { parseSbtReport } from './sbt.ts'
import { licenseText } from './texts.ts'
import type { Declared, DeclaredLicense, Resolved } from './types.ts'
import { identityOf } from './types.ts'

export type InventoryOptions = {
  readonly pnpm: readonly string[]
  readonly pnpmRoot: string
  readonly sbt: readonly string[]
  readonly gradle: readonly string[]
  readonly overrides: string | null
  readonly texts: string | null
  readonly out: string
  readonly aliases: string
}

export type InventoryResult = {
  readonly dependencies: readonly Resolved[]
  readonly failures: readonly string[]
  readonly unusedOverrides: readonly string[]
  /** The license ids whose text was written, in the order of the files. */
  readonly licenseIds: readonly string[]
  /** The notice files written, as paths relative to the output directory. */
  readonly notices: readonly string[]
  readonly exitCode: 0 | 1
}

function compareStrings(a: string, b: string): number {
  if (a < b) return -1
  if (a > b) return 1
  return 0
}

function licenseKey(entry: DeclaredLicense): string {
  return `${entry.name ?? ''} ${entry.url ?? ''}`
}

/** Two reports may name the same dependency; its declared entries are merged, never duplicated. */
function mergeByIdentity(all: readonly Declared[]): Declared[] {
  const byIdentity = new Map<string, Declared>()
  const order: string[] = []
  for (const dependency of all) {
    const identity = identityOf(dependency)
    const existing = byIdentity.get(identity)
    if (existing === undefined) {
      order.push(identity)
      byIdentity.set(identity, dependency)
      continue
    }
    const seen = new Set(existing.licenses.map(licenseKey))
    byIdentity.set(identity, {
      ...existing,
      licenses: [
        ...existing.licenses,
        ...dependency.licenses.filter((entry) => !seen.has(licenseKey(entry))),
      ],
      expression: existing.expression ?? dependency.expression,
      homepage: existing.homepage ?? dependency.homepage,
      noticeDirs: [...new Set([...existing.noticeDirs, ...dependency.noticeDirs])],
    })
  }
  return order.map((identity) => {
    const dependency = byIdentity.get(identity)
    if (dependency === undefined) throw new Error(`lost ${identity} while merging the reports`)
    return dependency
  })
}

function readReports(options: InventoryOptions): Declared[] {
  const all: Declared[] = []
  for (const file of options.pnpm) all.push(...parsePnpmReport(file, options.pnpmRoot))
  for (const file of options.sbt) all.push(...parseSbtReport(file))
  for (const file of options.gradle) all.push(...parseGradleReport(file))
  return all
}

function applyOverride(dependency: Resolved, override: Override): Resolved {
  // The ruling's ids are sorted like every other row's, so that two rows never show two orderings.
  return {
    ...dependency,
    ids: [...new Set(override.licenses)].sort(compareStrings),
    source: 'override',
    unresolved: [],
  }
}

/**
 * The whole run: read every report, normalise, apply the human rulings, write the outputs. It
 * throws `InputError` for exit code 3 and returns `exitCode` 1 when something failed, 0 when
 * nothing did. The outputs are written for both 0 and 1 (SCOPE.md, "Exit codes").
 */
export function runInventory(options: InventoryOptions): InventoryResult {
  if (options.pnpm.length + options.sbt.length + options.gradle.length === 0) {
    throw new InputError('no input: give at least one of --pnpm, --sbt or --gradle')
  }
  const aliases: AliasTable = loadAliases(options.aliases)
  const overrides = options.overrides === null ? [] : loadOverrides(options.overrides)
  const overrideById = new Map(overrides.map((override) => [override.id, override]))

  const used = new Set<string>()
  const dependencies = mergeByIdentity(readReports(options))
    .map((dependency) => {
      const resolved = resolveDependency(dependency, aliases)
      const override = overrideById.get(identityOf(dependency))
      if (override === undefined) return resolved
      used.add(override.id)
      return applyOverride(resolved, override)
    })
    .sort(compareDependencies)

  const failures: string[] = []
  for (const dependency of dependencies) {
    if (dependency.source === 'unknown') failures.push(unknownFailure(dependency))
  }

  const texts = new Map<string, string>()
  for (const id of [...new Set(dependencies.flatMap((d) => d.ids))].sort(compareStrings)) {
    const lookup = licenseText(id, options.texts)
    if (lookup.found) texts.set(id, lookup.text)
    else failures.push(`MISSING TEXT ${lookup.reason}`)
  }

  const unusedOverrides = overrides
    .filter((override) => !used.has(override.id))
    .map((override) => `${override.id} (reviewed ${override.reviewed}) matched no dependency`)

  // Only the files SCOPE.md lists are written. The two directories are rebuilt, so that a second
  // run on different inputs cannot leave a stale license text or notice behind.
  mkdirSync(options.out, { recursive: true })
  for (const directory of ['licenses', 'notices']) {
    rmSync(path.join(options.out, directory), { recursive: true, force: true })
  }
  writeFileSync(path.join(options.out, 'inventory.csv'), renderCsv(dependencies))
  writeFileSync(
    path.join(options.out, 'inventory.md'),
    renderMarkdown(dependencies, failures, unusedOverrides),
  )
  if (texts.size > 0) mkdirSync(path.join(options.out, 'licenses'), { recursive: true })
  for (const [id, text] of texts) {
    writeFileSync(path.join(options.out, 'licenses', `${id}.txt`), text)
  }
  const notices: string[] = []
  for (const dependency of dependencies) {
    notices.push(...copyNotices(dependency, options.out))
  }

  return {
    dependencies,
    failures,
    unusedOverrides,
    licenseIds: [...texts.keys()],
    notices: notices.sort(compareStrings),
    exitCode: failures.length > 0 ? 1 : 0,
  }
}
