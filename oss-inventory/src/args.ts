import path from 'node:path'
import { InputError } from './errors.ts'
import type { InventoryOptions } from './inventory.ts'

export const USAGE = `pnpm inventory -- [--pnpm <report.json>]... [--pnpm-root <dir>]
                  [--sbt <report.csv>]... [--gradle <index.json>]...
                  [--overrides <overrides.yml>] [--texts <dir>] --out <dir>`

/**
 * The flags of SCOPE.md and no others. An unknown flag, a flag without its value and a missing
 * `--out` are input errors (exit code 3): a run that cannot say what it was asked to do must not
 * silently do something else.
 */
export function parseArgs(argv: readonly string[], cwd: string, aliases: string): InventoryOptions {
  const pnpm: string[] = []
  const sbt: string[] = []
  const gradle: string[] = []
  let pnpmRoot: string | null = null
  let overrides: string | null = null
  let texts: string | null = null
  let out: string | null = null

  const value = (index: number, flag: string): string => {
    const next = argv[index]
    if (next === undefined || next.startsWith('--')) {
      throw new InputError(`${flag} needs a value\n${USAGE}`)
    }
    return next
  }

  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i]
    if (flag === undefined) continue
    switch (flag) {
      case '--':
        // `pnpm inventory -- …` passes the separator through; it is not an argument of the tool.
        break
      case '--pnpm':
        i += 1
        pnpm.push(path.resolve(cwd, value(i, flag)))
        break
      case '--sbt':
        i += 1
        sbt.push(path.resolve(cwd, value(i, flag)))
        break
      case '--gradle':
        i += 1
        gradle.push(path.resolve(cwd, value(i, flag)))
        break
      case '--pnpm-root':
        i += 1
        pnpmRoot = path.resolve(cwd, value(i, flag))
        break
      case '--overrides':
        i += 1
        overrides = path.resolve(cwd, value(i, flag))
        break
      case '--texts':
        i += 1
        texts = path.resolve(cwd, value(i, flag))
        break
      case '--out':
        i += 1
        out = path.resolve(cwd, value(i, flag))
        break
      default:
        throw new InputError(`unknown argument "${flag}"\n${USAGE}`)
    }
  }

  if (out === null) throw new InputError(`--out <dir> is required\n${USAGE}`)
  return {
    pnpm,
    pnpmRoot: pnpmRoot ?? cwd,
    sbt,
    gradle,
    overrides,
    texts,
    out,
    aliases,
  }
}
