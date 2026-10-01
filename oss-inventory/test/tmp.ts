import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll } from 'vitest'

// Scratch directories for the tests, in one place so that none is forgotten: every directory this
// hands out is removed when the test file that asked for it has finished, pass or fail. Vitest
// gives each test file its own module graph, so each file registers its own hook and its own list.

const created: string[] = []

afterAll(() => {
  for (const directory of created) rmSync(directory, { recursive: true, force: true })
  created.length = 0
})

/** A fresh directory under the OS temp directory, removed after this test file. */
export function temporaryDirectory(prefix: string): string {
  const directory = mkdtempSync(path.join(tmpdir(), `ci-devex-${prefix}-`))
  created.push(directory)
  return directory
}

/** A file written into a fresh temporary directory, which is removed with it. */
export function temporaryFile(prefix: string, name: string, content: string): string {
  const file = path.join(temporaryDirectory(prefix), name)
  writeFileSync(file, content)
  return file
}
