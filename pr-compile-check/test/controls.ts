import path from 'node:path'

export const TOOL_DIR = path.join(import.meta.dirname, '..')
export const TEMPLATE = path.join(TOOL_DIR, 'pr-compile-check.yml')
export const CHECKER = path.join(TOOL_DIR, 'tools', 'check-workflow.ts')

/**
 * The nine planted violations: one rule each, broken in a copy of the template by replacing a piece
 * of its text. Each `find` must still be in the template, so a change to the template that would
 * silently stop a control from planting anything fails the test instead.
 *
 * They are textual, not a YAML round-trip, because two of the rules (R3's `secrets.` scan and R9's
 * version comment) are about the file's text and a re-serialised document would lose them.
 */
export type Control = {
  readonly rule: string
  readonly what: string
  readonly find: string
  readonly replace: string
}

const RUNS_ON = `    runs-on: >-
      \${{ (github.event_name == 'workflow_dispatch' && inputs.runner == 'github-hosted')
      && 'ubuntu-24.04'
      || fromJSON('["self-hosted", "linux", "x64"]') }}
`

const IF_SAME_REPO = `    if: >-
      github.event_name != 'pull_request'
      || github.event.pull_request.head.repo.full_name == github.repository
`

export const CONTROLS: readonly Control[] = [
  {
    rule: 'R1',
    what: 'the pull_request trigger is removed',
    find: '  pull_request:\n',
    replace: '',
  },
  {
    rule: 'R2',
    what: 'the top-level permission is widened to contents: write',
    find: 'permissions:\n  contents: read\n',
    replace: 'permissions:\n  contents: write\n',
  },
  {
    rule: 'R3',
    what: 'a secret is read',
    find: '  RELAY_HOST: 127.0.0.1\n',
    // biome-ignore lint/suspicious/noTemplateCurlyInString: a GitHub Actions expression, not a JS template
    replace: '  RELAY_HOST: ${{ secrets.RELAY_HOST }}\n',
  },
  {
    rule: 'R4',
    what: "a job's runs-on is a fixed label instead of an expression",
    find: RUNS_ON,
    replace: '    runs-on: ubuntu-24.04\n',
  },
  {
    rule: 'R5',
    what: 'a job no longer refuses a pull request from a fork',
    find: IF_SAME_REPO,
    replace: '',
  },
  {
    rule: 'R6',
    what: 'the older run of the same pull request is no longer cancelled',
    find: '  cancel-in-progress: true\n',
    replace: '  cancel-in-progress: false\n',
  },
  {
    rule: 'R7',
    what: 'a job has no timeout',
    find: '    timeout-minutes: 45\n',
    replace: '',
  },
  {
    rule: 'R8',
    what: 'a checkout keeps its credentials',
    find: '        with:\n          persist-credentials: false\n',
    replace: '',
  },
  {
    rule: 'R9',
    what: 'an action is pinned to a tag instead of a commit SHA',
    find: 'actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0',
    replace: 'actions/setup-node@v7.0.0',
  },
]

/** The template with one control applied. Throws when the control no longer matches. */
export function plant(template: string, control: Control): string {
  if (!template.includes(control.find)) {
    throw new Error(
      `${control.rule}: the template no longer contains ${JSON.stringify(
        control.find.slice(0, 40),
      )}`,
    )
  }
  return template.replace(control.find, control.replace)
}
