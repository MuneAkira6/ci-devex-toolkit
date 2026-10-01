import { csvRow } from './csv.ts'
import type { Resolved } from './types.ts'
import { describeLicense, identityOf } from './types.ts'

export const CSV_HEADER: readonly string[] = [
  'ecosystem',
  'name',
  'version',
  'licenses',
  'source',
  'declared',
  'homepage',
]

/** Sorted by ecosystem, then name, then version — plain string order, so no locale can change it. */
export function compareDependencies(a: Resolved, b: Resolved): number {
  for (const [left, right] of [
    [a.ecosystem, b.ecosystem],
    [a.name, b.name],
    [a.version, b.version],
  ] as const) {
    if (left < right) return -1
    if (left > right) return 1
  }
  return 0
}

/** The `licenses` cell: the ids joined with `;`, or the pnpm expression exactly as declared. */
export function licensesCell(dependency: Resolved): string {
  if (dependency.source === 'unknown') return 'UNKNOWN'
  if (dependency.source !== 'override' && dependency.expression !== null) {
    return dependency.expression
  }
  return dependency.ids.join(';')
}

/** The `declared` cell: every name and URL the report carried, joined with ` | `. */
export function declaredCell(dependency: Resolved): string {
  if (dependency.licenses.length === 0) return '(no license entry)'
  return dependency.licenses.map(describeLicense).join(' | ')
}

function row(dependency: Resolved): readonly string[] {
  return [
    dependency.ecosystem,
    dependency.name,
    dependency.version,
    licensesCell(dependency),
    dependency.source,
    declaredCell(dependency),
    dependency.homepage ?? '',
  ]
}

export function renderCsv(dependencies: readonly Resolved[]): string {
  return [csvRow(CSV_HEADER), ...dependencies.map((dependency) => csvRow(row(dependency)))].join('')
}

/** license id (or UNKNOWN) → how many dependencies carry it. */
export function summarise(dependencies: readonly Resolved[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const dependency of dependencies) {
    const keys = dependency.source === 'unknown' ? ['UNKNOWN'] : dependency.ids
    for (const key of keys) {
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
  }
  return new Map([...counts].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
}

function cell(text: string): string {
  return text.replaceAll('|', '\\|').replaceAll('\n', ' ')
}

function block(title: string, lines: readonly string[]): string[] {
  return [
    `## ${title}`,
    '',
    ...(lines.length === 0 ? ['None'] : lines.map((line) => `- ${line}`)),
    '',
  ]
}

export function renderMarkdown(
  dependencies: readonly Resolved[],
  failures: readonly string[],
  unusedOverrides: readonly string[],
): string {
  const lines: string[] = ['# OSS license inventory', '', '## Summary', '']
  lines.push('| License | Dependencies |', '| --- | --- |')
  for (const [license, count] of summarise(dependencies)) {
    lines.push(`| ${cell(license)} | ${count} |`)
  }
  lines.push('', `Total: ${dependencies.length} dependencies.`, '', '## Dependencies', '')
  lines.push(
    '| Ecosystem | Name | Version | Licenses | Source | Declared | Homepage |',
    '| --- | --- | --- | --- | --- | --- | --- |',
  )
  for (const dependency of dependencies) {
    lines.push(
      `| ${dependency.ecosystem} | ${cell(dependency.name)} | ${cell(dependency.version)} | ` +
        `${cell(licensesCell(dependency))} | ${dependency.source} | ` +
        `${cell(declaredCell(dependency))} | ${cell(dependency.homepage ?? '')} |`,
    )
  }
  lines.push('')
  lines.push(...block('Failures', failures))
  lines.push(...block('Unused overrides', unusedOverrides))
  return `${lines.join('\n').trimEnd()}\n`
}

/** The failure line of an UNKNOWN dependency: it names the entry that could not be mapped. */
export function unknownFailure(dependency: Resolved): string {
  const identity = identityOf(dependency)
  if (dependency.unresolved.length === 0) {
    return `UNKNOWN ${identity}: the report declares no license entry at all`
  }
  const entries = dependency.unresolved.map((entry) => `"${describeLicense(entry)}"`).join(', ')
  return `UNKNOWN ${identity}: no SPDX id for ${entries}`
}
