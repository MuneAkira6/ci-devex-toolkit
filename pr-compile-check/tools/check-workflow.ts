import { readFileSync } from 'node:fs'
import process from 'node:process'
import { parse as parseYaml } from 'yaml'

/**
 * The rule checker of `pr-compile-check.yml` (`pnpm workflow:check <file>...`).
 *
 * One line per rule, `R<n> ok` or `R<n> FAIL <why>`; exit 0 when every rule is kept, 1 when any is
 * broken, 3 when a file cannot be read or is not YAML. The rules and their wording are SCOPE.md's,
 * "pr-compile-check"; the reasons are in runbook.md.
 *
 * Each rule is checked on its own, so that a planted violation fails that rule and no other: a
 * check whose failures cascade cannot say which rule a workflow actually broke.
 */

export type RuleResult = { readonly id: string; readonly ok: boolean; readonly why: string }

type Workflow = {
  readonly raw: string
  readonly document: Record<string, unknown>
}

export class WorkflowInputError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'WorkflowInputError'
  }
}

const SHA = /^[0-9a-f]{40}$/
const USES_LINE = /^\s*-?\s*uses:\s*(\S+)\s*(#.*)?$/
const VERSION_COMMENT = /#\s*v?\d+(\.\d+)*/

function record(value: unknown): Record<string, unknown> | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

/** `on:` is the YAML 1.1 boolean `true` unless the parser is told otherwise; handle both spellings. */
function triggers(document: Record<string, unknown>): Record<string, unknown> | null {
  const raw = Object.hasOwn(document, 'on') ? document.on : document.true
  if (raw === null || raw === undefined) return null
  if (typeof raw === 'string') return { [raw]: null }
  if (Array.isArray(raw)) return Object.fromEntries(raw.map((name) => [text(name), null]))
  return record(raw)
}

function jobs(document: Record<string, unknown>): [string, Record<string, unknown>][] {
  const all = record(document.jobs)
  if (all === null) return []
  const found: [string, Record<string, unknown>][] = []
  for (const [name, value] of Object.entries(all)) {
    const job = record(value)
    if (job !== null) found.push([name, job])
  }
  return found
}

function steps(job: Record<string, unknown>): Record<string, unknown>[] {
  if (!Array.isArray(job.steps)) return []
  return job.steps.map(record).filter((step) => step !== null)
}

/** The dispatch inputs whose default is the self-hosted choice — the input R1 asks for. */
function runnerInputs(document: Record<string, unknown>): string[] {
  const on = triggers(document)
  const dispatch = on === null ? null : record(on.workflow_dispatch)
  const inputs = dispatch === null ? null : record(dispatch.inputs)
  if (inputs === null) return []
  const found: string[] = []
  for (const [name, value] of Object.entries(inputs)) {
    const input = record(value)
    if (input !== null && text(input.default).includes('self-hosted')) found.push(name)
  }
  return found
}

// --- the rules ------------------------------------------------------------------------------

function r1(workflow: Workflow): string {
  const on = triggers(workflow.document)
  if (on === null) return 'the workflow has no triggers'
  const missing: string[] = []
  if (!Object.hasOwn(on, 'pull_request')) missing.push('pull_request')
  if (!Object.hasOwn(on, 'workflow_dispatch')) missing.push('workflow_dispatch')
  const push = record(on.push)
  if (!Object.hasOwn(on, 'push')) missing.push('push')
  else if (push === null || !Array.isArray(push.branches) || push.branches.length === 0) {
    missing.push('push.branches (the default branch)')
  }
  if (missing.length > 0) return `no trigger for ${missing.join(', ')}`
  const inputs = runnerInputs(workflow.document)
  if (inputs.length === 0) {
    return 'workflow_dispatch has no input whose default picks the self-hosted runner'
  }
  return ''
}

function r2(workflow: Workflow): string {
  const top = workflow.document.permissions
  const granted = record(top)
  if (granted === null) return `top-level permissions must be "contents: read", found ${show(top)}`
  const keys = Object.keys(granted)
  if (keys.length !== 1 || keys[0] !== 'contents' || granted.contents !== 'read') {
    return `top-level permissions must be exactly "contents: read", found ${show(top)}`
  }
  for (const [name, job] of jobs(workflow.document)) {
    if (!Object.hasOwn(job, 'permissions')) continue
    const own = record(job.permissions)
    if (own === null) return `job "${name}" sets permissions to ${show(job.permissions)}`
    for (const [key, value] of Object.entries(own)) {
      if (key !== 'contents' || (value !== 'read' && value !== 'none')) {
        return `job "${name}" widens permissions with "${key}: ${String(value)}"`
      }
    }
  }
  return ''
}

function r3(workflow: Workflow): string {
  const on = triggers(workflow.document)
  if (on !== null && Object.hasOwn(on, 'pull_request_target')) {
    return "the pull_request_target trigger runs fork code with the base repository's token"
  }
  const lines = workflow.raw.split('\n')
  for (const [index, line] of lines.entries()) {
    if (line.includes('secrets.')) return `line ${index + 1} reads a secret: ${line.trim()}`
  }
  return ''
}

function r4(workflow: Workflow): string {
  const inputs = runnerInputs(workflow.document)
  const list = jobs(workflow.document)
  if (list.length === 0) return 'the workflow has no jobs'
  for (const [name, job] of list) {
    const runsOn = job['runs-on']
    const expression = typeof runsOn === 'string' ? runsOn : JSON.stringify(runsOn ?? null)
    if (!expression.includes('${{')) {
      return `job "${name}" has a fixed runs-on (${show(runsOn)}), not an expression`
    }
    if (!expression.includes('self-hosted')) {
      return `job "${name}" never names the self-hosted labels in its runs-on`
    }
    const picks = inputs.some((input) => expression.includes(input))
    if (!picks) {
      return `job "${name}" does not let the dispatch input choose the runner`
    }
  }
  return ''
}

function r5(workflow: Workflow): string {
  for (const [name, job] of jobs(workflow.document)) {
    const condition = text(job.if)
    if (
      !condition.includes('pull_request.head.repo.full_name') ||
      !condition.includes('github.repository')
    ) {
      return `job "${name}" does not refuse a pull request from another repository`
    }
  }
  return ''
}

function r6(workflow: Workflow): string {
  const concurrency = record(workflow.document.concurrency)
  if (concurrency === null) return 'the workflow has no concurrency group'
  const group = text(concurrency.group)
  if (!group.includes('pull_request.number') && !group.includes('github.ref')) {
    return `the concurrency group is not per pull request or ref: ${show(concurrency.group)}`
  }
  if (concurrency['cancel-in-progress'] !== true) {
    return `cancel-in-progress must be true, found ${show(concurrency['cancel-in-progress'])}`
  }
  return ''
}

function r7(workflow: Workflow): string {
  for (const [name, job] of jobs(workflow.document)) {
    if (typeof job['timeout-minutes'] !== 'number') {
      return `job "${name}" has no timeout-minutes`
    }
  }
  return ''
}

function r8(workflow: Workflow): string {
  for (const [name, job] of jobs(workflow.document)) {
    for (const [index, step] of steps(job).entries()) {
      const uses = text(step.uses)
      if (!uses.startsWith('actions/checkout@')) continue
      const using = record(step.with)
      if (using === null || using['persist-credentials'] !== false) {
        return `job "${name}" step ${index + 1} checks out without persist-credentials: false`
      }
    }
  }
  return ''
}

function r9(workflow: Workflow): string {
  for (const [index, line] of workflow.raw.split('\n').entries()) {
    const match = USES_LINE.exec(line)
    if (match === null) continue
    const [, reference, comment] = match as unknown as [string, string, string | undefined]
    const at = reference.lastIndexOf('@')
    if (at < 0 || !SHA.test(reference.slice(at + 1))) {
      return `line ${index + 1} is not pinned to a 40-hex commit SHA: ${reference}`
    }
    if (comment === undefined || !VERSION_COMMENT.test(comment)) {
      return `line ${index + 1} pins ${reference.slice(0, at)} with no version comment`
    }
  }
  return ''
}

const RULES: readonly { readonly id: string; readonly check: (w: Workflow) => string }[] = [
  { id: 'R1', check: r1 },
  { id: 'R2', check: r2 },
  { id: 'R3', check: r3 },
  { id: 'R4', check: r4 },
  { id: 'R5', check: r5 },
  { id: 'R6', check: r6 },
  { id: 'R7', check: r7 },
  { id: 'R8', check: r8 },
  { id: 'R9', check: r9 },
]

function show(value: unknown): string {
  return JSON.stringify(value ?? null)
}

/** Reads a workflow file. A file that cannot be read or is not a YAML mapping is an input error. */
export function readWorkflow(file: string): Workflow {
  let raw: string
  try {
    raw = readFileSync(file, 'utf8')
  } catch (cause) {
    throw new WorkflowInputError(`${file}: cannot read the workflow (${String(cause)})`)
  }
  let parsed: unknown
  try {
    parsed = parseYaml(raw)
  } catch (cause) {
    throw new WorkflowInputError(`${file}: cannot parse the workflow as YAML (${String(cause)})`)
  }
  const document = record(parsed)
  if (document === null) {
    throw new WorkflowInputError(`${file}: the workflow must be a YAML mapping`)
  }
  return { raw, document }
}

export function checkWorkflow(workflow: Workflow): RuleResult[] {
  return RULES.map((rule) => {
    const why = rule.check(workflow)
    return { id: rule.id, ok: why === '', why }
  })
}

function main(argv: readonly string[]): number {
  if (argv.length === 0) {
    process.stderr.write('usage: pnpm workflow:check <file>...\n')
    return 3
  }
  let broken = 0
  for (const file of argv) {
    let workflow: Workflow
    try {
      workflow = readWorkflow(file)
    } catch (error) {
      if (error instanceof WorkflowInputError) {
        process.stderr.write(`input error: ${error.message}\n`)
        return 3
      }
      throw error
    }
    process.stdout.write(`${file}\n`)
    for (const result of checkWorkflow(workflow)) {
      if (result.ok) process.stdout.write(`${result.id} ok\n`)
      else {
        process.stdout.write(`${result.id} FAIL ${result.why}\n`)
        broken += 1
      }
    }
  }
  return broken > 0 ? 1 : 0
}

process.exitCode = main(process.argv.slice(2))
