// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { createServer } from 'node:https'
import type { Server } from 'node:https'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// A stand-in daemon on 127.0.0.1:4269, so an e2e fixture printer can be MANAGED.
//
// WHY THIS EXISTS: a seeded record is not enough. The app re-grades every saved printer from
// `checking` at boot through a live probe (hooks/printers.ts), and `checking` outranks nothing, so
// the first offline verdict lands with no hysteresis. A fixture with nothing answering is offline
// within a second, and every managed-only affordance (the daemon-update prompt among them) then
// correctly refuses to render. Nothing about the daemon-update surface can be covered without a
// daemon that answers.
//
// WHY A STUB AND NOT A PRODUCTION SEAM: the alternative was an env flag in probe.ts that reports a
// grade nobody measured, which is a test-only lie inside shipped code. A stub on the port leaves
// production honest and keeps the app's REAL probe path (checkDaemon, then /status + /capabilities
// + /selfcheck, then daemonNeedsUpdate) under test. It is also exactly what this layer is for:
// e2e = real app against a mocked backend, in vitro = real system (feedback_e2e_vs_invitro). The
// REAL daemon is driven on a container by tests/invitro/daemon-ops.invitro.test.ts.
// 4269 is the daemon's port and the app will not look anywhere else, so this binds the same host port
// the in-vitro containers publish: an e2e run and an in-vitro run cannot share a machine at the same
// moment.
const DAEMON_PORT = 4269
const DAEMON_HOST = '127.0.0.1'
const STUB_TOKEN = 'e2e-stub-daemon-token'

export interface StubDaemon {
  cert: string
  token: string
  stop(): Promise<void>
}

// Self-signed is all the app asks for: it pins the record's own daemonCert as the CA and skips
// hostname identity (transport.ts makeAgent), the same way it trusts a real daemon's provisioned
// cert. Generated per run, valid for a day, so no key material is ever checked in.
function selfSignedPair(): { cert: string; key: string } {
  const certDir = mkdtempSync(join(tmpdir(), 'b3-e2e-daemon-cert-'))
  const certPath = join(certDir, 'server.crt')
  const keyPath = join(certDir, 'server.key')
  try {
    execFileSync('openssl', [
      'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1',
      '-subj', '/CN=bespok3d-e2e-daemon', '-keyout', keyPath, '-out', certPath,
    ], { stdio: 'ignore' })

    return { cert: readFileSync(certPath, 'utf-8'), key: readFileSync(keyPath, 'utf-8') }
  } finally {
    // Both files are already in memory by here, and the private key is the reason this does not wait
    // for the OS to reap the temp dir whenever it feels like it.
    rmSync(certDir, { recursive: true, force: true })
  }
}

// The three routes a managed grade reads. parseCaps defaults every optional field, so an empty
// capabilities payload is a complete answer for a printer with nothing installed.
function routePayloads(daemonVersion: string): Record<string, unknown> {
  return {
    '/status': { ok: true, version: daemonVersion },
    '/capabilities': { installed: {}, endpoints: [] },
    '/selfcheck': { ok: true, drift: [] },
  }
}

function respond(payloads: Record<string, unknown>, request: IncomingMessage, response: ServerResponse): void {
  const body = payloads[(request.url ?? '').split('?')[0]]
  response.writeHead(body ? 200 : 404, { 'content-type': 'application/json' })
  response.end(JSON.stringify(body ?? { detail: 'route not served by the e2e stub daemon' }))
}

function closeServer(server: Server): Promise<void> {
  // The app's status loop keeps its agent's sockets alive, and close() alone waits for them.
  server.closeAllConnections()

  return new Promise((closed) => server.close(() => closed()))
}

// Reports `daemonVersion` as the running daemon, which is what decides whether the app offers an
// update: the renderer never sees daemonUpdateAvailable from the fixture, it sees what
// daemonNeedsUpdate() derives from this answer.
export function startStubDaemon(daemonVersion: string): Promise<StubDaemon> {
  const pair = selfSignedPair()
  const payloads = routePayloads(daemonVersion)
  const server = createServer({ cert: pair.cert, key: pair.key }, (request, response) => respond(payloads, request, response))

  return new Promise((ready, failed) => {
    // Without this, the one failure that actually happens (an in-vitro container still holding 4269)
    // surfaces as an unhandled EADDRINUSE that takes the Playwright worker down with no clue attached.
    server.once('error', (listenError: NodeJS.ErrnoException) => failed(listenError.code === 'EADDRINUSE'
      ? new Error(`port ${DAEMON_PORT} is already taken, which is usually a leftover in-vitro container: docker ps, then docker rm -f it`)
      : listenError))
    server.listen(DAEMON_PORT, DAEMON_HOST, () => ready({
      cert: pair.cert, token: STUB_TOKEN, stop: () => closeServer(server),
    }))
  })
}
