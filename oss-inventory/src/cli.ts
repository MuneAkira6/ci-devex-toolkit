import path from 'node:path'
import process from 'node:process'
import { parseArgs } from './args.ts'
import { InputError } from './errors.ts'
import { runInventory } from './inventory.ts'
import { summarise } from './report.ts'

/** `oss-inventory/aliases.yml` — the alias table is part of the tool, not a flag (SCOPE.md). */
const ALIASES = path.join(import.meta.dirname, '..', 'aliases.yml')

function main(argv: readonly string[]): number {
  let result: ReturnType<typeof runInventory>
  try {
    result = runInventory(parseArgs(argv, process.cwd(), ALIASES))
  } catch (error) {
    if (error instanceof InputError) {
      process.stderr.write(`input error: ${error.message}\n`)
      return 3
    }
    throw error
  }

  for (const [license, count] of summarise(result.dependencies)) {
    process.stdout.write(`${license}: ${count}\n`)
  }
  process.stdout.write(`${result.dependencies.length} dependencies\n`)
  for (const failure of result.failures) {
    process.stdout.write(`${failure}\n`)
  }
  for (const unused of result.unusedOverrides) {
    process.stdout.write(`unused override: ${unused}\n`)
  }
  if (result.exitCode === 1) {
    process.stdout.write(`${result.failures.length} failure(s)\n`)
  }
  return result.exitCode
}

process.exitCode = main(process.argv.slice(2))
