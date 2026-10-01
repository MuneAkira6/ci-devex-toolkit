import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

// The pinned image, by digest (SCOPE.md, "Images and ports"; F5 measured 1.7.12 behind it).
const IMAGE =
  'rhysd/actionlint@sha256:b1934ee5f1c509618f2508e6eb47ee0d3520686341fec936f3b79331f9315667'

const REPO_ROOT = path.join(import.meta.dirname, '..')

// Named explicitly, never left to the image's own search: the template, which does not live under
// .github/, and this repository's own CI once G5 writes it.
const CANDIDATES: readonly string[] = [
  'pr-compile-check/pr-compile-check.yml',
  '.github/workflows/ci.yml',
]

function main(): number {
  const files = CANDIDATES.filter((file) => existsSync(path.join(REPO_ROOT, file)))
  if (files.length === 0) {
    process.stderr.write('actionlint: none of the workflow files exist yet\n')
    return 3
  }
  process.stdout.write(`actionlint (image pinned by digest) over ${files.length} file(s):\n`)
  for (const file of files) process.stdout.write(`  ${file}\n`)

  // Read-only mount, no network, removed on exit.
  const args = [
    'run',
    '--rm',
    '--network',
    'none',
    '--volume',
    `${REPO_ROOT}:/repo:ro`,
    '--workdir',
    '/repo',
    IMAGE,
    '-no-color',
    ...files,
  ]
  const result = spawnSync('docker', args, { stdio: 'inherit' })
  if (result.error !== undefined) {
    process.stderr.write(`actionlint: cannot run docker: ${result.error.message}\n`)
    return 3
  }
  if (result.status === null) {
    process.stderr.write(`actionlint: docker was killed by ${String(result.signal)}\n`)
    return 3
  }
  if (result.status === 0) process.stdout.write('actionlint: clean\n')
  return result.status
}

process.exitCode = main()
