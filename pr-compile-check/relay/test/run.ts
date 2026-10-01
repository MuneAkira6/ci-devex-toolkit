import { spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import http from 'node:http'
import net from 'node:net'
import path from 'node:path'
import process from 'node:process'

/**
 * The relay test (`pnpm relay:test`).
 *
 * It starts the real relay — the template's own `squid.conf.template` and `render-squid-conf.sh`,
 * mounted, not copied — beside a mock authenticating upstream and a mock origin, and asserts the
 * five things SCOPE.md lists. The fifth is the control: with the wrong upstream credentials the
 * request must not succeed, and the mock must have logged a rejection. Without it the other four
 * would prove only that something answered.
 *
 * The credentials are generated here, live in the environment of this one run, and are never
 * written to a file. The project is removed with its volumes and network at the end, also on
 * failure.
 */

const PROJECT = 'ci-devex-relay-test'
const COMPOSE_FILE = path.join(import.meta.dirname, 'compose.yml')
const RELAY_PORT = 18441
const UPSTREAM_PORT = 18442
const ORIGIN = 'mock-origin'
const EXPECTED_BODY = 'mock origin: the relay reached me\n'

type Secrets = {
  readonly user: string
  readonly password: string
}

const results: { readonly name: string; readonly ok: boolean; readonly detail: string }[] = []

function report(name: string, ok: boolean, detail: string): void {
  results.push({ name, ok, detail })
  process.stdout.write(`${ok ? 'ok  ' : 'FAIL'} ${name}: ${detail}\n`)
}

// --- docker ---------------------------------------------------------------------------------

function compose(args: readonly string[], secrets: Secrets, relaySecrets: Secrets) {
  return spawnSync('docker', ['compose', '-p', PROJECT, '-f', COMPOSE_FILE, ...args], {
    encoding: 'utf8',
    env: {
      ...process.env,
      UPSTREAM_USER: secrets.user,
      UPSTREAM_PASSWORD: secrets.password,
      RELAY_UPSTREAM_USER: relaySecrets.user,
      RELAY_UPSTREAM_PASSWORD: relaySecrets.password,
    },
  })
}

function down(secrets: Secrets): void {
  // The variables must still be set: Compose interpolates the file even to tear it down.
  const result = compose(
    ['down', '--volumes', '--remove-orphans', '--timeout', '5'],
    secrets,
    secrets,
  )
  if (result.status !== 0) {
    process.stderr.write(`relay-test: teardown failed: ${result.stderr}\n`)
  }
}

// --- probes, from the host -------------------------------------------------------------------

type Response = { readonly status: number; readonly body: string }

/** A proxy request: an absolute URI as the request target, which is what a client sends a proxy. */
function throughProxy(port: number, target: string, headers: http.OutgoingHttpHeaders) {
  return new Promise<Response>((resolve, reject) => {
    const request = http.request(
      { host: '127.0.0.1', port, method: 'GET', path: target, headers },
      (response) => {
        let body = ''
        response.setEncoding('utf8')
        response.on('data', (chunk: string) => {
          body += chunk
        })
        response.on('end', () => resolve({ status: response.statusCode ?? 0, body }))
      },
    )
    request.setTimeout(10_000, () => request.destroy(new Error('timed out')))
    request.on('error', reject)
    request.end()
  })
}

/** CONNECT through the proxy, then send bytes and read what comes back. */
function throughTunnel(port: number, authority: string, payload: string) {
  return new Promise<{ readonly status: string; readonly echoed: string }>((resolve, reject) => {
    const socket = net.connect(port, '127.0.0.1')
    let phase: 'connect' | 'echo' = 'connect'
    let buffer = ''
    let status = ''
    socket.setTimeout(10_000, () => socket.destroy(new Error('timed out')))
    socket.on('error', reject)
    socket.on('connect', () => {
      socket.write(`CONNECT ${authority} HTTP/1.1\r\nHost: ${authority}\r\n\r\n`)
    })
    socket.on('data', (chunk: Buffer) => {
      buffer += chunk.toString('utf8')
      if (phase === 'connect') {
        const end = buffer.indexOf('\r\n\r\n')
        if (end < 0) return
        status = (buffer.slice(0, buffer.indexOf('\r\n')) || '').trim()
        buffer = buffer.slice(end + 4)
        phase = 'echo'
        if (!status.includes('200')) {
          socket.end()
          resolve({ status, echoed: '' })
          return
        }
        socket.write(payload)
      }
      if (phase === 'echo' && buffer.length >= payload.length) {
        const echoed = buffer.slice(0, payload.length)
        socket.end()
        resolve({ status, echoed })
      }
    })
    socket.on('close', () => {
      if (phase === 'connect') resolve({ status: status || '(closed)', echoed: '' })
    })
  })
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

/** Waits until the relay answers 200 through the whole chain, or gives up. */
async function waitForRelay(seconds: number): Promise<string> {
  const deadline = Date.now() + seconds * 1000
  let last = 'no attempt'
  while (Date.now() < deadline) {
    try {
      const response = await throughProxy(RELAY_PORT, `http://${ORIGIN}/`, { host: ORIGIN })
      if (response.status === 200) return 'ready'
      last = `status ${response.status}`
    } catch (error) {
      last = error instanceof Error ? error.message : String(error)
    }
    await sleep(500)
  }
  return `not ready after ${seconds}s (${last})`
}

// --- the run ----------------------------------------------------------------------------------

function secret(prefix: string): string {
  return `${prefix}-${randomBytes(12).toString('hex')}`
}

// The passwords carry an `&` on purpose. The render script runs under the squid image's own bash
// (5.2), where an unquoted `&` in the replacement of `${var//pattern/replacement}` stands for the
// matched text, so a password holding one used to be rendered with the placeholder spliced into it.
// The render script's unit test runs under the bash of whatever machine runs the tests, and a bash
// older than 5.2 cannot show this; here it runs under the bash that matters.
function password(prefix: string): string {
  return `${prefix}-${randomBytes(6).toString('hex')}&${randomBytes(6).toString('hex')}`
}

async function main(): Promise<number> {
  const secrets: Secrets = { user: secret('relay-user'), password: password('relay-pass') }
  const wrong: Secrets = { user: secrets.user, password: password('wrong-pass') }

  try {
    const up = compose(['up', '-d'], secrets, secrets)
    if (up.status !== 0) {
      process.stderr.write(`relay-test: compose up failed: ${up.stderr}\n`)
      return 1
    }
    const ready = await waitForRelay(60)
    if (ready !== 'ready') {
      process.stderr.write(`relay-test: ${ready}\n`)
      process.stderr.write(compose(['logs', '--no-color'], secrets, secrets).stdout)
      return 1
    }

    // 1 — an HTTP request through the relay reaches the origin, and the upstream logged it as
    //     authenticated.
    const http1 = await throughProxy(RELAY_PORT, `http://${ORIGIN}/`, { host: ORIGIN })
    const logs1 = compose(['logs', '--no-color', 'mock-upstream'], secrets, secrets).stdout
    const forwarded = logs1
      .split('\n')
      .filter(
        (line) =>
          line.includes('"outcome":"forwarded"') && line.includes('"credentialsMatched":true'),
      )
    report(
      'http through the relay reaches the origin, authenticated at the upstream',
      http1.status === 200 && http1.body === EXPECTED_BODY && forwarded.length > 0,
      `status ${http1.status}, body ${JSON.stringify(http1.body)}, ` +
        `${forwarded.length} forwarded line(s) with credentialsMatched true`,
    )

    // 2 — CONNECT through the relay opens a tunnel to the echo, also authenticated.
    const payload = `tunnel-${randomBytes(6).toString('hex')}`
    const tunnel = await throughTunnel(RELAY_PORT, `${ORIGIN}:443`, payload)
    const logs2 = compose(['logs', '--no-color', 'mock-upstream'], secrets, secrets).stdout
    const tunnelled = logs2
      .split('\n')
      .filter(
        (line) =>
          line.includes('"outcome":"tunnelled"') && line.includes('"credentialsMatched":true'),
      )
    report(
      'CONNECT through the relay opens a tunnel to the echo, authenticated at the upstream',
      tunnel.status.includes('200') && tunnel.echoed === payload && tunnelled.length > 0,
      `${tunnel.status}, echoed ${JSON.stringify(tunnel.echoed)}, ` +
        `${tunnelled.length} tunnelled line(s) with credentialsMatched true`,
    )

    // 3 — straight to the mock upstream with no credentials: 407.
    const direct = await throughProxy(UPSTREAM_PORT, `http://${ORIGIN}/`, { host: ORIGIN })
    report(
      'a request straight to the upstream without credentials gets 407',
      direct.status === 407,
      `status ${direct.status}`,
    )

    // 4 — the relay is published on 127.0.0.1 only.
    const published = compose(['port', 'relay', '3128'], secrets, secrets).stdout.trim()
    const ss = spawnSync('ss', ['-ltn'], { encoding: 'utf8' })
    const ssLines =
      ss.status === 0 ? ss.stdout.split('\n').filter((line) => line.includes(`:${RELAY_PORT}`)) : []
    const ssOk =
      ss.status !== 0 ||
      (ssLines.length > 0 && ssLines.every((line) => line.includes('127.0.0.1:')))
    report(
      'the relay is published on 127.0.0.1 only',
      published === `127.0.0.1:${RELAY_PORT}` && ssOk,
      `docker compose port -> ${published}; ` +
        (ss.status === 0
          ? `ss -ltn -> ${ssLines.map((line) => line.trim()).join(' / ')}`
          : 'ss not available'),
    )

    // AC-23 — the dummy password never appears in any container's log.
    const allLogs = compose(['logs', '--no-color'], secrets, secrets).stdout
    const leaks = allLogs.split(secrets.password).length - 1
    report('no credential appears in the containers’ logs', leaks === 0, `${leaks} occurrence(s)`)

    // The host's proxy settings are never handed to a container (goal-brief.md, red line 5). Asked
    // from inside, so that nothing the daemon might inject can go unnoticed. The Compose file sets
    // every proxy variable to empty, because some Docker installations add the machine's own proxy
    // settings to every container; so a variable counts here only when it holds a value.
    const proxyVariables: string[] = []
    for (const service of ['relay', 'mock-upstream', 'mock-origin']) {
      const env = compose(['exec', '-T', service, 'env'], secrets, secrets).stdout
      for (const line of env.split('\n')) {
        const [name = '', ...rest] = line.replace(/\r$/, '').split('=')
        if (/proxy/i.test(name) && rest.join('=') !== '') proxyVariables.push(`${service}: ${name}`)
      }
    }
    report(
      'no container of the run has a proxy variable in its environment',
      proxyVariables.length === 0,
      proxyVariables.length === 0
        ? 'none in relay, mock-upstream, mock-origin'
        : proxyVariables.join(', '),
    )

    down(secrets)

    // 5 — the control. The relay is given the wrong upstream password; the mock keeps the right
    //     one, so the request must fail and the mock must log a rejection.
    const upWrong = compose(['up', '-d'], secrets, wrong)
    if (upWrong.status !== 0) {
      process.stderr.write(`relay-test: the control's compose up failed: ${upWrong.stderr}\n`)
      return 1
    }
    await sleep(4000)
    let controlStatus = 0
    let controlError = ''
    try {
      const response = await throughProxy(RELAY_PORT, `http://${ORIGIN}/`, { host: ORIGIN })
      controlStatus = response.status
    } catch (error) {
      controlError = error instanceof Error ? error.message : String(error)
    }
    const controlLogs = compose(['logs', '--no-color', 'mock-upstream'], secrets, wrong).stdout
    const rejected = controlLogs
      .split('\n')
      .filter(
        (line) => line.includes('"credentialsMatched":false') && line.includes('"outcome":"407"'),
      )
    report(
      'control: with the wrong upstream credentials the request does not succeed',
      controlStatus !== 200 && rejected.length > 0,
      `status ${controlStatus === 0 ? `(no response: ${controlError})` : controlStatus}, ` +
        `${rejected.length} rejection(s) logged with credentialsMatched false`,
    )
    return results.every((result) => result.ok) ? 0 : 1
  } finally {
    down(secrets)
  }
}

const code = await main()
process.stdout.write(
  `\n${results.filter((r) => r.ok).length} passed, ${results.filter((r) => !r.ok).length} failed\n`,
)
process.exitCode = code
