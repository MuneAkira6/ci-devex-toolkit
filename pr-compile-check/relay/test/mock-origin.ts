import http from 'node:http'
import net from 'node:net'
import process from 'node:process'

/**
 * The mock origin of the relay test: the only thing the mock upstream is allowed to reach, so that
 * nothing the test does can leave the host.
 *
 * It listens on 80 and 443 rather than on high ports on purpose: the relay under test is started
 * from the real `squid.conf.template`, whose `Safe_ports` and `SSL_ports` are the ones a runner
 * needs, and a test that had to widen them would no longer be testing the template.
 *
 *   GET http://<origin>/        -> 200, a fixed body
 *   TCP  <origin>:443           -> an echo, for the CONNECT tunnel
 */

export const BODY = 'mock origin: the relay reached me\n'

const HTTP_PORT = 80
const ECHO_PORT = 443

function log(event: Record<string, unknown>): void {
  process.stdout.write(`${JSON.stringify({ service: 'mock-origin', ...event })}\n`)
}

const web = http.createServer((request, response) => {
  log({ event: 'http', method: request.method, url: request.url })
  response.writeHead(200, { 'content-type': 'text/plain', 'content-length': `${BODY.length}` })
  response.end(BODY)
})

const echo = net.createServer((socket) => {
  log({ event: 'echo-open' })
  socket.on('error', () => socket.destroy())
  socket.pipe(socket)
})

web.listen(HTTP_PORT, () => log({ event: 'listening', port: HTTP_PORT, kind: 'http' }))
echo.listen(ECHO_PORT, () => log({ event: 'listening', port: ECHO_PORT, kind: 'echo' }))
