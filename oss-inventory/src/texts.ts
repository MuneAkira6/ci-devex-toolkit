import { readFileSync } from 'node:fs'
import path from 'node:path'
import { isLicenseRef, spdxLicenseText } from './spdx.ts'

export type TextLookup =
  | { readonly found: false; readonly reason: string }
  | { readonly found: true; readonly text: string }

/**
 * The full text of one license id. An id spdx-license-list knows comes from there (F9); a
 * `LicenseRef-*` comes from `<texts dir>/<id>.txt` and from nowhere else. An id with no text is a
 * failure, never an omission (SCOPE.md, "Texts and notices").
 */
export function licenseText(id: string, textsDir: string | null): TextLookup {
  if (isLicenseRef(id)) {
    if (textsDir === null) {
      return { found: false, reason: `${id} needs --texts <dir> with ${id}.txt` }
    }
    const file = path.join(textsDir, `${id}.txt`)
    try {
      return { found: true, text: readFileSync(file, 'utf8') }
    } catch {
      return { found: false, reason: `${id} has no text: ${file} cannot be read` }
    }
  }
  const text = spdxLicenseText(id)
  if (text === null) {
    return { found: false, reason: `${id} has no text: spdx-license-list does not know this id` }
  }
  return { found: true, text }
}
