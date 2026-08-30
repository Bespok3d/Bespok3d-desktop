// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
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

interface AccessRequestResult {
  ok: boolean
  cert: string
}

const CERTIFICATE_HEADER = '-----BEGIN CERTIFICATE-----'

function jsonOrNothing(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

// What this computer will pin as the printer's identity for every later call, or a refusal. Nothing
// has verified the host that answers this: the request goes out before any certificate is pinned, so
// whatever is listening at that address gets to reply, and a home router's login page is the ordinary
// case. Three answers are refused here. One that is not a Bespok3d reply at all: parsing it threw
// inside the response handler, where nothing catches it, and the promise it was meant to settle was
// left hanging, so the pairing screen sat waiting for an approval that was never asked for and said
// nothing. One that does not say the request was recorded, which was pinned anyway and left the
// printer showing as paired with nobody on it holding a request to approve. And one carrying no
// certificate, which the daemon itself sends when its certificate file is missing: pinning an empty
// one makes every later call check the printer against the public certificate authorities, which a
// printer's own certificate can never satisfy, so the printer reads as paired and is unreachable from
// that moment, with only a reset over SSH to get back out of it.
function grantedAccessOrRefusal(text: string): AccessRequestResult {
  const answered = jsonOrNothing(text)
  if (answered === null || typeof answered !== 'object') {
    throw new Error('that address answered with something other than a Bespok3d printer, so this computer was not paired with it')
  }
  const { ok, cert } = answered as Partial<AccessRequestResult>
  if (ok !== true) throw new Error('the printer did not take the request to pair with this computer, so there is nothing for you to approve on it')
  if (typeof cert !== 'string' || !cert.includes(CERTIFICATE_HEADER)) {
    throw new Error('the printer sent no certificate to identify itself with, so this computer was not paired with it')
  }

  return { ok, cert }
}

// A refusal reaches the caller only by being handed to reject: this runs inside the response handler,
// where a throw is caught by nobody and the promise never settles at all.
function settleAccessRequest(text: string, granted: (result: AccessRequestResult) => void, refused: (error: Error) => void): void {
  try {
    granted(grantedAccessOrRefusal(text))
  } catch (refusal) {
    refused(refusal as Error)
  }
}

// First contact: the requesting client has not pinned a cert yet, so it trusts on first use (the
// same TOFU window enrollment uses) and pins the cert the daemon returns. The user approving on the
// already-paired computer, plus fingerprint comparison (ADR-0016), is the MITM defence.
export function requestAccess(input: AccessRequestInput): Promise<AccessRequestResult> {
  const body = Buffer.from(JSON.stringify({
    label: input.label, identity: input.identity, token: input.token, public_key: input.publicKey,
  }))

  return new Promise((resolve, reject) => {
    const agent = new Agent({ rejectUnauthorized: false })
    const req = httpsRequest(
      { hostname: input.ip, port: 4269, path: '/access/request', method: 'POST', agent,
        headers: { 'Content-Type': 'application/json', 'Content-Length': body.length } },
      (res) => collectResponse(res, (text) => settleAccessRequest(text, resolve, reject), reject),
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
