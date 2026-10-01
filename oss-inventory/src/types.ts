/** The three ecosystems the tool reads. SCOPE.md, "Inputs". */
export type Ecosystem = 'gradle' | 'pnpm' | 'sbt'

/** One license exactly as a report declared it: a name, a URL, or both. */
export type DeclaredLicense = {
  readonly name: string | null
  readonly url: string | null
}

/** One dependency as a report declared it, before normalisation. */
export type Declared = {
  readonly ecosystem: Ecosystem
  /** The package name (pnpm) or `<group>:<artifact>` (sbt, Gradle). */
  readonly name: string
  readonly version: string
  readonly licenses: readonly DeclaredLicense[]
  /** pnpm only: the report's `license` string, kept exactly as declared (SCOPE.md, step 2). */
  readonly expression: string | null
  readonly homepage: string | null
  /** Directories whose files are copied into `notices/`; empty when the input provides none. */
  readonly noticeDirs: readonly string[]
}

/** Where a dependency's licenses came from. SCOPE.md, `inventory.csv`, column `source`. */
export type LicenseSource = 'alias' | 'declared' | 'override' | 'unknown'

export type Resolved = Declared & {
  /** Sorted and de-duplicated SPDX ids (or `LicenseRef-*`); empty exactly when UNKNOWN. */
  readonly ids: readonly string[]
  readonly source: LicenseSource
  /** The entries that could not be mapped. Empty with `source` `unknown` means: no entry at all. */
  readonly unresolved: readonly DeclaredLicense[]
}

/** `<ecosystem>:<name>@<version>` — the identity SCOPE.md gives a dependency. */
export function identityOf(dependency: {
  ecosystem: Ecosystem
  name: string
  version: string
}): string {
  return `${dependency.ecosystem}:${dependency.name}@${dependency.version}`
}

/** How a declared entry is printed in a message and in the `declared` column. */
export function describeLicense(license: DeclaredLicense): string {
  const name = license.name === null ? '' : license.name.trim()
  const url = license.url === null ? '' : license.url.trim()
  if (name !== '' && url !== '') return `${name} (${url})`
  if (name !== '') return name
  if (url !== '') return `(${url})`
  return '(no name, no URL)'
}
