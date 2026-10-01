import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { weightOf } from './src/weight.ts'

// The module generator: `node generate-modules.ts <count>` writes src/generated/ from the count
// alone, so the same count always gives the same bytes. The directory is git-ignored; it is input
// to the measurement, not a deliverable.

const count = Number(process.argv[2] ?? '1000')
if (!Number.isInteger(count) || count < 1) {
  process.stderr.write('usage: node generate-modules.ts <count>\n')
  process.exit(3)
}

const generated = path.join(import.meta.dirname, 'src', 'generated')
rmSync(generated, { recursive: true, force: true })
mkdirSync(generated, { recursive: true })

const width = String(count).length
const names: string[] = []
for (let index = 1; index <= count; index += 1) {
  const name = `module-${String(index).padStart(width, '0')}`
  names.push(name)
  writeFileSync(
    path.join(generated, `${name}.ts`),
    `// generated from the module count alone; do not edit\n` +
      `export const name = '${name}'\n` +
      `export const weight = ${weightOf(index)}\n`,
  )
}

const imports = names.map((name, i) => `import * as m${i} from './${name}.js'`).join('\n')
const list = names.map((_name, i) => `  m${i},`).join('\n')
writeFileSync(
  path.join(generated, 'index.ts'),
  `// generated from the module count alone; do not edit\n${imports}\n\n` +
    `export type GeneratedModule = { readonly name: string; readonly weight: number }\n\n` +
    `export const modules: readonly GeneratedModule[] = [\n${list}\n]\n`,
)
process.stdout.write(`generated ${count} modules in src/generated\n`)
