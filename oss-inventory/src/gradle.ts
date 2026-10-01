import { readFileSync } from 'node:fs'
import path from 'node:path'
import { InputError } from './errors.ts'
import type { Declared, DeclaredLicense } from './types.ts'

// The renderer setting the sample uses, named in the error message for the default shape (F10).
const MULTI_RENDERER = 'JsonReportRenderer("index.json", false)'

function readJson(file: string): unknown {
  let text: string
  try {
    text = readFileSync(file, 'utf8')
  } catch (cause) {
    throw new InputError(`${file}: cannot read the Gradle report (${String(cause)})`)
  }
  try {
    return JSON.parse(text)
  } catch (cause) {
    throw new InputError(`${file}: cannot parse the Gradle report as JSON (${String(cause)})`)
  }
}

function requireString(value: unknown, file: string, where: string): string {
  if (typeof value !== 'string' || value === '') {
    throw new InputError(`${file}: ${where} must be a non-empty string`)
  }
  return value
}

function firstUrl(value: unknown): string | null {
  if (!Array.isArray(value)) return null
  for (const url of value) {
    if (typeof url === 'string' && url.trim() !== '') return url.trim()
  }
  return null
}

function licenseEntries(value: unknown, file: string, where: string): DeclaredLicense[] {
  if (!Array.isArray(value)) {
    throw new InputError(`${file}: ${where}.moduleLicenses must be an array`)
  }
  const entries: DeclaredLicense[] = []
  for (const [index, raw] of value.entries()) {
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
      throw new InputError(`${file}: ${where}.moduleLicenses[${index}] must be an object`)
    }
    const entry = raw as Record<string, unknown>
    const name = entry.moduleLicense
    const url = entry.moduleLicenseUrl
    if (name !== null && typeof name !== 'string') {
      throw new InputError(
        `${file}: ${where}.moduleLicenses[${index}].moduleLicense must be a string or null`,
      )
    }
    // F10: an entry of the multi-license shape may carry a null name and only a URL.
    entries.push({
      name: name === null || name === '' ? null : name,
      url: typeof url === 'string' && url !== '' ? url : null,
    })
  }
  return entries
}

/**
 * Reads a jk1 dependency-license-report `index.json` written with the multi-license renderer.
 * The default renderer's shape (one `moduleLicense` per module) is refused rather than read: it has
 * already dropped licenses, silently (F10).
 */
export function parseGradleReport(file: string): Declared[] {
  const document = readJson(file)
  if (document === null || typeof document !== 'object' || Array.isArray(document)) {
    throw new InputError(`${file}: the Gradle report must be a JSON object`)
  }
  const dependencies = (document as Record<string, unknown>).dependencies
  if (!Array.isArray(dependencies)) {
    throw new InputError(`${file}: the Gradle report has no "dependencies" array`)
  }

  const reportDir = path.dirname(file)
  const parsed: Declared[] = []
  for (const [index, raw] of dependencies.entries()) {
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
      throw new InputError(`${file}: dependencies[${index}] must be an object`)
    }
    const dependency = raw as Record<string, unknown>
    const name = requireString(dependency.moduleName, file, `dependencies[${index}].moduleName`)
    const version = requireString(
      dependency.moduleVersion,
      file,
      `dependencies[${index}].moduleVersion`,
    )

    if (!Object.hasOwn(dependency, 'moduleLicenses')) {
      if (Object.hasOwn(dependency, 'moduleLicense')) {
        throw new InputError(
          `${file}: dependencies[${index}] (${name}) carries a single "moduleLicense" instead of ` +
            '"moduleLicenses". That is the jk1 renderer\'s default shape, which has already dropped ' +
            `every license after the first. Re-run the report with ${MULTI_RENDERER}.`,
        )
      }
      throw new InputError(`${file}: dependencies[${index}] (${name}) has no "moduleLicenses"`)
    }

    // The plugin copies the license files a jar ships into `<artifact>-<version>.jar/META-INF/`
    // next to index.json (F10). `moduleName` is `<group>:<artifact>`.
    const artifact = name.slice(name.lastIndexOf(':') + 1)
    parsed.push({
      ecosystem: 'gradle',
      name,
      version,
      licenses: licenseEntries(dependency.moduleLicenses, file, `dependencies[${index}] (${name})`),
      expression: null,
      homepage: firstUrl(dependency.moduleUrls),
      noticeDirs: [path.join(reportDir, `${artifact}-${version}.jar`, 'META-INF')],
    })
  }
  return parsed
}
