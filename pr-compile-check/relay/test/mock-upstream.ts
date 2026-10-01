import http from 'node:http'
import net from 'node:net'
import process from 'node:process'

/**
 * The mock upstream of the relay test: an authenticating proxy that stands in for the one a real
 * runner sits behind.
 *
 * It requires `Proxy-Authorization: Basic` with the dummy credentials the test generates for that
 * one run, handles both an absolute-URI request and `CONNECT`, and forwards to the mock origin and
 * to nothing else — so a mistake in the test cannot send a byte off this machine.
 *
 * It logs one JSON line per request saying whether the credentials matched. It never logs the
 * credentials themselves: AC-23 counts the dummy password in `docker compose logs` and expects 0.
 */

const PORT = Number(process.env.PORT ?? '3129')
const USER = process.env.UPSTREAM_USER ?? ''
const PASSWORD = process.env.UPSTREAM_PASSWORD ?? ''
const ALLOWED_HOST = process.env.ALLOWED_HOST ?? 'mock-origin'

if (USER === '' || PASSWORD === '') {
  process.stderr.write('mock-upstream: UPSTREAM_USER and UPSTREAM_PASSWORD must be set\n')
  process.exit(1)
}

const EXPECTED = `Basic ${Buffer.from(`${USER}:${PASSWORD}`).toString('base64')}`

function log(event: Record<string, unknown>): void {
  process.stdout.write(`${JSON.stringify({ service: 'mock-upstream', ...event })}\n`)
}

/** Whether the header carries exactly the credentials of this run. The value is never logged. */
function credentialsMatch(header: string | undefined): boolean {
  if (header === undefined) return false
  return header.trim() === EXPECTED
}

/** The host part of an absolute URI or of a `host:port` authority, without the port. */
function hostOf(target: string): string {
  const withoutScheme = target.replace(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//, '')
  const authority = withoutScheme.split('/')[0] ?? ''
  const lastColon = authority.lastIndexOf(':')
  return lastColon > 0 ? authority.slice(0, lastColon) : authority
}

const server = http.createServer((request, response) => {
  const target = request.url ?? ''
  const matched = credentialsMatch(request.headers['proxy-authorization'])
  if (!matched) {
    log({
      event: 'request',
      method: request.method,
      target,
      credentialsMatched: false,
      outcome: '407',
    })
    response.writeHead(407, {
      'proxy-authenticate': 'Basic realm="mock upstream"',
      'content-length': '0',
    })
    response.end()
    return
  }
  if (!target.startsWith('http://')) {
    log({
      event: 'request',
      method: request.method,
      target,
      credentialsMatched: true,
      outcome: '400',
    })
    response.writeHead(400, { 'content-length': '0' })
    response.end()
    return
  }
  const host = hostOf(target)
  if (host !== ALLOWED_HOST) {
    log({
      event: 'request',
      method: request.method,
      target,
      credentialsMatched: true,
      outcome: 'refused',
    })
    response.writeHead(403, { 'content-length': '0' })
    response.end()
    return
  }

  log({
    event: 'request',
    method: request.method,
    target,
    credentialsMatched: true,
    outcome: 'forwarded',
  })
  const headers = { ...request.headers }
  delete headers['proxy-authorization']
  const upstream = http.request(target, { method: request.method, headers }, (originResponse) => {
    response.writeHead(originResponse.statusCode ?? 502, originResponse.headers)
    originResponse.pipe(response)
  })
  upstream.on('error', (error) => {
    log({
      event: 'request',
      method: request.method,
      target,
      credentialsMatched: true,
      outcome: `error: ${error.message}`,
    })
    response.writeHead(502, { 'content-length': '0' })
    response.end()
  })
  request.pipe(upstream)
})

server.on('connect', (request, clientSocket, head) => {
  const target = request.url ?? ''
  const matched = credentialsMatch(request.headers['proxy-authorization'])
  const refuse = (status: string, extra = ''): void => {
    clientSocket.write(`HTTP/1.1 ${status}\r\n${extra}\r\n`)
    clientSocket.end()
  }
  if (!matched) {
    log({ event: 'connect', target, credentialsMatched: false, outcome: '407' })
    refuse(
      '407 Proxy Authentication Required',
      'Proxy-Authenticate: Basic realm="mock upstream"\r\n',
    )
    return
  }
  const host = hostOf(target)
  if (host !== ALLOWED_HOST) {
    log({ event: 'connect', target, credentialsMatched: true, outcome: 'refused' })
    refuse('403 Forbidden')
    return
  }
  const port = Number(target.slice(target.lastIndexOf(':') + 1))
  log({ event: 'connect', target, credentialsMatched: true, outcome: 'tunnelled' })
  const origin = net.connect(port, host, () => {
    clientSocket.write('HTTP/1.1 200 Connection established\r\n\r\n')
    if (head.length > 0) origin.write(head)
    origin.pipe(clientSocket)
    clientSocket.pipe(origin)
  })
  origin.on('error', () => refuse('502 Bad Gateway'))
  clientSocket.on('error', () => origin.destroy())
})

server.listen(PORT, () => log({ event: 'listening', port: PORT, allowedHost: ALLOWED_HOST }))
