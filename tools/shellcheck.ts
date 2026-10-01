import { spawnSync } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'

// The pinned image, by digest (SCOPE.md, "Images and ports"; F5 measured 0.11.0 behind it).
const IMAGE =
  'koalaman/shellcheck@sha256:bb596a0d169b85ddd81d8b6d3a2ff6d5baf5fca10b97f575ebc647c3dff62b3d'

const REPO_ROOT = path.join(import.meta.dirname, '..')

// The helper has no extension, so it is named; everything else is `*.sh`. SCOPE.md: the files are
// named explicitly, never left to a glob the image expands.
const ALWAYS: readonly string[] = ['two-repos-one-worktree/assets']

/**
 * The repository's own shell files: what git tracks plus what is untracked and not ignored. That
 * is exactly "in the repository" — it leaves out `node_modules/`, `out/` and the goal-bus hooks
 * under `.claude/`, which `.gitignore` ignores and which this repository does not ship.
 */
function shellFiles(): string[] {
  const listed = spawnSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  })
  if (listed.status !== 0) {
    throw new Error(`git ls-files failed: ${listed.stderr.trim()}`)
  }
  return listed.stdout.split('\n').filter((file) => file.endsWith('.sh'))
}

function main(): number {
  const files = [...new Set([...ALWAYS, ...shellFiles()])].sort()
  process.stdout.write(`shellcheck (image pinned by digest) over ${files.length} file(s):\n`)
  for (const file of files) process.stdout.write(`  ${file}\n`)

  // Read-only mount, no network, removed on exit: the linter reads the repository and nothing else.
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
    '--color=never',
    ...files,
  ]
  const result = spawnSync('docker', args, { stdio: 'inherit' })
  if (result.error !== undefined) {
    process.stderr.write(`shellcheck: cannot run docker: ${result.error.message}\n`)
    return 3
  }
  if (result.status === null) {
    process.stderr.write(`shellcheck: docker was killed by ${String(result.signal)}\n`)
    return 3
  }
  if (result.status === 0) process.stdout.write('shellcheck: clean\n')
  return result.status
}

process.exitCode = main()
