import path from 'node:path'

/** `oss-inventory/`, so that a test names a fixture the way the contract does. */
export const TOOL_DIR = path.join(import.meta.dirname, '..')

export const FIXTURES = path.join(TOOL_DIR, 'fixtures')
export const SAMPLES = path.join(TOOL_DIR, 'samples')
export const ALIASES = path.join(TOOL_DIR, 'aliases.yml')
export const CLI = path.join(TOOL_DIR, 'src', 'cli.ts')

export const GRADLE_REPORT = path.join(FIXTURES, 'gradle', 'index.json')
export const GRADLE_SINGLE_REPORT = path.join(FIXTURES, 'gradle-single', 'index.json')
export const SBT_REPORT = path.join(FIXTURES, 'sbt', 'acme-tasks-api-licenses.csv')
export const PNPM_REPORT = path.join(FIXTURES, 'pnpm', 'acme-tasks-web.json')
export const REPO_ROOT = path.join(TOOL_DIR, '..')
