// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { X509Certificate } from 'crypto'
import { request as httpsRequest, Agent } from 'https'
import type { IncomingMessage } from 'http'
import type { TLSSocket } from 'tls'

export interface DaemonLicenseProbe {
  version: string
  certificateFingerprint: string
}

const DAEMON_LICENSE = 'AGPL-3.0-or-later'
const DAEMON_SOURCE = 'https://github.com/Bespok3d/daemon'
const LICENSE_TIMEOUT_MS = 5000

function isLicenseResponse(value: unknown): value is { version: string; license: string; source: string; notice: string } {
  if (typeof value !== 'object' || value === null) return false
  const answer = value as Record<string, unknown>

  return typeof answer.version === 'string' && answer.version.length > 0
    && answer.license === DAEMON_LICENSE
    && answer.source === DAEMON_SOURCE
    && typeof answer.notice === 'string' && answer.notice.includes(answer.version)
}

function licenseFingerprint(response: IncomingMessage): string {
  const rawCertificate = (response.socket as TLSSocket).getPeerCertificate().raw
  if (!rawCertificate) throw new Error('daemon certificate missing')

  return new X509Certificate(rawCertificate).fingerprint256
}

function parseLicense(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

function collectLicense(response: IncomingMessage, ip: string, resolve: (probe: DaemonLicenseProbe) => void, reject: (error: Error) => void): void {
  const chunks: Buffer[] = []
  response.on('data', (chunk: Buffer) => chunks.push(chunk))
  response.on('aborted', () => reject(new Error(`daemon license response interrupted from ${ip}`)))
  response.on('error', reject)
  response.on('close', () => {
    if (!response.complete) reject(new Error(`daemon license response ended early from ${ip}`))
  })
  response.on('end', () => {
    const body = Buffer.concat(chunks).toString('utf8')
    const license = parseLicense(body)
    if (response.statusCode !== 200 || !isLicenseResponse(license)) {
      reject(new Error(`unrecognized daemon response from ${ip}`))

      return
    }
    try {
      resolve({ version: license.version, certificateFingerprint: licenseFingerprint(response) })
    } catch (error) {
      reject(error as Error)
    }
  })
}

export function fetchDaemonLicense(ip: string, port = 4269): Promise<DaemonLicenseProbe> {
  return new Promise((resolve, reject) => {
    const agent = new Agent({ rejectUnauthorized: false })
    const request = httpsRequest({ hostname: ip, port, path: '/license', method: 'GET', agent }, (response) => {
      collectLicense(response, ip, resolve, reject)
    })
    request.on('error', reject)
    request.setTimeout(LICENSE_TIMEOUT_MS, () => request.destroy(new Error('daemon license probe timed out')))
    request.end()
  })
}
