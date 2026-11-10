// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { ipcMain } from 'electron'
import { randomBytes } from 'crypto'
import { hostname } from 'os'
import { loadPrinters, updatePrinter } from '../printers'
import { recordOrThrow } from '../daemon-client/status'
import { listKeys } from '../keys'
import { loadSettings, clientId } from '../settings'
import { requestAccess, fetchAccessClients, grantAccess, revokeAccess, isAccessGranted } from '../daemon-client/client'
import { getAdapter } from '../adapter-loader'
import { bespok3dRootOn } from '../adapter-loader/bespok3d-root'
import { connect, shellQuote } from '../ssh'
import { DAEMON_PORT } from '../printers/ports'
import { RESET_ACCESS_ALREADY_RUNNING } from './reset-access-busy'

// This computer's identity for a printer's ACL: the GPG fingerprint when PGP is on, else a stable
// client id that works with no key (the kill-switch keeps the flow alive when PGP is off).
function clientIdentity(): { identity: string; publicKey?: string } {
  const pgpEnabled = loadSettings().pgpEnabled
  const key = pgpEnabled
    ? listKeys().find((entry) => entry.assignments.some((each) => each.purpose === 'printers') || entry.isDefault)
    : undefined

  return { identity: key?.fingerprint || clientId(), publicKey: key?.publicKey }
}

async function runRequestAccess(printerId: string, label: string, daemonPort: number): Promise<{ ok: boolean }> {
  const record = recordOrThrow(printerId)
  const { identity, publicKey } = clientIdentity()
  const token = randomBytes(32).toString('hex')
  const safeLabel = (label || hostname()).slice(0, 64)
  const result = await requestAccess({ ip: record.ip, port: daemonPort, label: safeLabel, identity, token, publicKey })
  updatePrinter(printerId, { daemonCert: result.cert, daemonToken: token, accessIdentity: identity, status: 'online' })

  return { ok: result.ok }
}

async function runAccessStatus(printerId: string, daemonPort: number): Promise<'pending' | 'granted'> {
  const record = loadPrinters().find((rec) => rec.id === printerId)
  if (!record || !record.daemonToken || !record.daemonCert) return 'pending'
  if (!(await isAccessGranted(record, daemonPort))) return 'pending'
  updatePrinter(printerId, { status: 'managed' })

  return 'granted'
}

// Re-seed the ACL to a single admin = this computer, bypassing the daemon over SSH so it works even
// when the ACL is broken. Recovers a printer whose access list locked everyone out.
async function runResetAccess(printerId: string, ip: string, user: string, password: string, port: number): Promise<void> {
  const record = recordOrThrow(printerId)
  const { identity } = clientIdentity()
  const token = randomBytes(32).toString('hex')
  const acl = {
    keys: [identity], roles: { [identity]: 'admin' }, labels: { [identity]: hostname() },
    tokens: [token], token_identity: { [token]: identity },
  }
  const bespok3d = bespok3dRootOn(getAdapter(record.adapter))
  const ssh = await connect({ host: ip, port, user, password })
  try {
    await ssh.exec(`mkdir -p ${shellQuote(`${bespok3d}/auth`)}`)
    await ssh.putContent(`${bespok3d}/auth/acl.json`, JSON.stringify(acl, null, 2))
    // Stored the moment the printer holds it, so a failure after this line cannot leave the old token here.
    updatePrinter(printerId, { daemonToken: token, accessIdentity: identity, status: 'managed' })
    await ssh.exec(`rm -f ${shellQuote(`${bespok3d}/auth/pending.json`)}`)
  } finally {
    ssh.close()
  }
}

const resetsRunning = new Set<string>()
const requestsRunning = new Map<string, Promise<unknown>>()

// One reset per printer at a time: two would each write their own token, and the one stored last here
// need not be the one the printer kept. A second reset is refused, never queued, so it cannot undo the first.
// A reset also lets a running access request store its token first, so the reset's token is the one kept.
async function runResetAccessAlone(printerId: string, ip: string, user: string, password: string, port: number): Promise<void> {
  if (resetsRunning.has(printerId)) throw new Error(RESET_ACCESS_ALREADY_RUNNING)
  resetsRunning.add(printerId)
  try {
    // A request's own failure is told to whoever asked for it; the reset only waits for it to end.
    await requestsRunning.get(printerId)
    await runResetAccess(printerId, ip, user, password, port)
  } finally {
    resetsRunning.delete(printerId)
  }
}

function forgetEndedRequests(printerId: string, requestsSoFar: Promise<unknown>): void {
  if (requestsRunning.get(printerId) === requestsSoFar) requestsRunning.delete(printerId)
}

// An access request stores a token too, so it must not land after a reset and replace the reset's token.
// Each request chains onto the ones already running, so a reset waits for all of them, not only the newest.
function runRequestAccessOutsideReset(printerId: string, label: string, daemonPort: number): Promise<{ ok: boolean }> {
  if (resetsRunning.has(printerId)) return Promise.reject(new Error(RESET_ACCESS_ALREADY_RUNNING))
  const request = runRequestAccess(printerId, label, daemonPort)
  const requestsSoFar = Promise.allSettled([requestsRunning.get(printerId), request])
  requestsRunning.set(printerId, requestsSoFar)
  void requestsSoFar.then(() => forgetEndedRequests(printerId, requestsSoFar))

  return request
}

export function registerAccessHandlers(daemonPort = DAEMON_PORT): void {
  ipcMain.handle('access:request', (_ev, printerId: string, label: string) => runRequestAccessOutsideReset(printerId, label, daemonPort))
  ipcMain.handle('access:status', (_ev, printerId: string) => runAccessStatus(printerId, daemonPort))
  ipcMain.handle('access:clients', (_ev, printerId: string) => fetchAccessClients(recordOrThrow(printerId)))
  ipcMain.handle('access:grant', (_ev, printerId: string, identity: string) => grantAccess(recordOrThrow(printerId), identity))
  ipcMain.handle('access:revoke', (_ev, printerId: string, identity: string) => revokeAccess(recordOrThrow(printerId), identity))
  ipcMain.handle('printer:reset-access', (_ev, printerId: string, ip: string, user: string, password: string, port: number) =>
    runResetAccessAlone(printerId, ip, user, password, port),
  )
}
