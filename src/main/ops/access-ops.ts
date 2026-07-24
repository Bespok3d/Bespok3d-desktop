import { ipcMain } from 'electron'
import { randomBytes } from 'crypto'
import { hostname } from 'os'
import { loadPrinters, updatePrinter } from '../printers'
import { recordOrThrow } from '../daemon-client/status'
import { listKeys } from '../keys'
import { loadSettings, clientId } from '../settings'
import { requestAccess, fetchAccessClients, grantAccess, revokeAccess, isAccessGranted } from '../daemon-client/client'
import { getAdapter } from '../adapter-loader'
import { connect, shellQuote } from '../ssh'

// This computer's identity for a printer's ACL: the GPG fingerprint when PGP is on, else a stable
// client id that works with no key (the kill-switch keeps the flow alive when PGP is off).
function clientIdentity(): { identity: string; publicKey?: string } {
  const pgpEnabled = loadSettings().pgpEnabled
  const key = pgpEnabled
    ? listKeys().find((entry) => entry.assignments.some((each) => each.purpose === 'printers') || entry.isDefault)
    : undefined

  return { identity: key?.fingerprint || clientId(), publicKey: key?.publicKey }
}

async function runRequestAccess(printerId: string, label: string): Promise<{ ok: boolean }> {
  const record = recordOrThrow(printerId)
  const { identity, publicKey } = clientIdentity()
  const token = randomBytes(32).toString('hex')
  const safeLabel = (label || hostname()).slice(0, 64)
  const result = await requestAccess({ ip: record.ip, label: safeLabel, identity, token, publicKey })
  updatePrinter(printerId, { daemonCert: result.cert, daemonToken: token, accessIdentity: identity, status: 'online' })

  return { ok: result.ok }
}

async function runAccessStatus(printerId: string): Promise<'pending' | 'granted'> {
  const record = loadPrinters().find((rec) => rec.id === printerId)
  if (!record || !record.daemonToken || !record.daemonCert) return 'pending'
  if (!(await isAccessGranted(record))) return 'pending'
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
  const bespok3d = getAdapter(record.adapter)?.envVars.find((envVar) => envVar.name === 'BESPOK3D')?.value || '/userdata/bespok3d'
  const ssh = await connect({ host: ip, port, user, password })
  try {
    await ssh.exec(`mkdir -p ${shellQuote(`${bespok3d}/auth`)}`)
    await ssh.putContent(`${bespok3d}/auth/acl.json`, JSON.stringify(acl, null, 2))
    await ssh.exec(`rm -f ${shellQuote(`${bespok3d}/auth/pending.json`)}`)
  } finally {
    ssh.close()
  }
  updatePrinter(printerId, { daemonToken: token, accessIdentity: identity, status: 'managed' })
}

export function registerAccessHandlers(): void {
  ipcMain.handle('access:request', (_ev, printerId: string, label: string) => runRequestAccess(printerId, label))
  ipcMain.handle('access:status', (_ev, printerId: string) => runAccessStatus(printerId))
  ipcMain.handle('access:clients', (_ev, printerId: string) => fetchAccessClients(recordOrThrow(printerId)))
  ipcMain.handle('access:grant', (_ev, printerId: string, identity: string) => grantAccess(recordOrThrow(printerId), identity))
  ipcMain.handle('access:revoke', (_ev, printerId: string, identity: string) => revokeAccess(recordOrThrow(printerId), identity))
  ipcMain.handle('printer:reset-access', (_ev, printerId: string, ip: string, user: string, password: string, port: number) =>
    runResetAccess(printerId, ip, user, password, port),
  )
}
