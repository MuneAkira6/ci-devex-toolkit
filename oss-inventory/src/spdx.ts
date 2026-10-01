import spdxFull from 'spdx-license-list/full.js'

// The one place that knows spdx-license-list. F9: 727 ids, each with its full text, no network.
const CANONICAL_BY_LOWER = new Map<string, string>(
  Object.keys(spdxFull).map((id) => [id.toLowerCase(), id]),
)

const LICENSE_REF = /^LicenseRef-[0-9A-Za-z.-]+$/

/** How many ids spdx-license-list knows; quoted by the tests against F9. */
export function spdxIdCount(): number {
  return CANONICAL_BY_LOWER.size
}

/**
 * Step 1 of the normalisation: the name written in its canonical SPDX case, or null when
 * spdx-license-list does not know it. The comparison is case-insensitive and nothing else —
 * no punctuation is stripped, no word is dropped.
 */
export function canonicalSpdxId(name: string): string | null {
  return CANONICAL_BY_LOWER.get(name.trim().toLowerCase()) ?? null
}

/** A `LicenseRef-*` id: a license SPDX has no id for, whose text must be given with `--texts`. */
export function isLicenseRef(id: string): boolean {
  return LICENSE_REF.test(id)
}

/** The full text spdx-license-list ships for an id, or null when it has none. */
export function spdxLicenseText(id: string): string | null {
  return Object.hasOwn(spdxFull, id) ? spdxFull[id].licenseText : null
}
