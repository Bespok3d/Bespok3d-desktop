import { request as httpsRequest, Agent } from 'https'
import type { PrinterRecord } from '../printers'
import { doRequest, collectResponse, DaemonHttpError, DEFAULT_DAEMON_TIMEOUT_MS } from './transport'

export interface AccessClient {
  identity: string
  role: string
  label: string
}

export interface PendingClient {
  identity: string
  label: string
  requested_at: string
}

export interface AccessClients {
  clients: AccessClient[]
  pending: PendingClient[]
}

export interface AccessRequestInput {
  ip: string
  label: string
  identity: string
  token: string
  publicKey?: string
}

// First contact: the requesting client has not pinned a cert yet, so it trusts on first use (the
// same TOFU window enrollment uses) and pins the cert the daemon returns. The user approving on the
// already-paired computer, plus fingerprint comparison (ADR-0016), is the MITM defence.
export function requestAccess(input: AccessRequestInput): Promise<{ ok: boolean; cert: string }> {
  const body = Buffer.from(JSON.stringify({
    label: input.label, identity: input.identity, token: input.token, public_key: input.publicKey,
  }))

  return new Promise((resolve, reject) => {
    const agent = new Agent({ rejectUnauthorized: false })
    const req = httpsRequest(
      { hostname: input.ip, port: 4269, path: '/access/request', method: 'POST', agent,
        headers: { 'Content-Type': 'application/json', 'Content-Length': body.length } },
      (res) => collectResponse(res, (text) => resolve(JSON.parse(text) as { ok: boolean; cert: string }), reject),
    )
    req.on('error', reject)
    req.setTimeout(DEFAULT_DAEMON_TIMEOUT_MS, () => req.destroy(new Error('daemon request timed out')))
    req.write(body)
    req.end()
  })
}

export async function fetchAccessClients(record: PrinterRecord): Promise<AccessClients> {
  const text = await doRequest(record, 'GET', '/access/clients')

  return JSON.parse(text) as AccessClients
}

export async function grantAccess(record: PrinterRecord, identity: string): Promise<void> {
  await doRequest(record, 'POST', '/access/grant', Buffer.from(JSON.stringify({ identity })), 'application/json')
}

export async function revokeAccess(record: PrinterRecord, identity: string): Promise<void> {
  await doRequest(record, 'POST', '/access/revoke', Buffer.from(JSON.stringify({ identity })), 'application/json')
}

// True once an existing client has approved this token (the daemon stops returning 401).
export async function isAccessGranted(record: PrinterRecord): Promise<boolean> {
  try {
    await doRequest(record, 'GET', '/status')

    return true
  } catch (daemonError) {
    if (daemonError instanceof DaemonHttpError && daemonError.statusCode === 401) return false
    throw daemonError
  }
}
