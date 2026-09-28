// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { readFileSync } from 'fs'
import { createServer } from 'https'
import type { Server } from 'https'
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'

const handlers = new Map<string, (...args: unknown[]) => unknown>()
const fixture = vi.hoisted(() => ({
  printer: { id: 'fixture-requesting-client', ip: '127.0.0.1', status: 'online', daemonToken: undefined as string | undefined, daemonCert: undefined as string | undefined, accessIdentity: undefined as string | undefined },
  existingClient: { id: 'fixture-existing-client', ip: '192.0.2.23', daemonToken: 'fixture-existing-token', daemonCert: 'fixture-existing-cert', accessIdentity: 'fixture-existing-identity' },
}))

vi.mock('electron', () => ({ ipcMain: { handle: (channel: string, handler: (...args: unknown[]) => unknown) => handlers.set(channel, handler) } }))
vi.mock('../printers', () => ({
  loadPrinters: vi.fn(() => [fixture.printer, fixture.existingClient]),
  updatePrinter: vi.fn((printerId: string, fields: object) => {
    const printerRecord = [fixture.printer, fixture.existingClient].find((record) => record.id === printerId)
    if (printerRecord) Object.assign(printerRecord, fields)
  }),
}))
vi.mock('../daemon-client/status', () => ({ recordOrThrow: vi.fn(() => fixture.printer) }))
vi.mock('../keys', () => ({ listKeys: vi.fn(() => []) }))
vi.mock('../settings', () => ({ loadSettings: vi.fn(() => ({ pgpEnabled: false })), clientId: vi.fn(() => 'fixture-new-client-identity') }))
vi.mock('../adapter-loader', () => ({ getAdapter: vi.fn() }))
vi.mock('../ssh', () => ({ connect: vi.fn(), shellQuote: vi.fn((value: string) => value) }))

import { fetchDaemonLicense } from '../daemon-client/license-client'
import { registerAccessHandlers } from './access-ops'
import { updatePrinter } from '../printers'
import { clientId } from '../settings'
import { connect } from '../ssh'

const certificate = readFileSync(new URL('../daemon-client/__fixtures__/daemon-cert.pem', import.meta.url), 'utf8')
const privateKey = readFileSync(new URL('../daemon-client/__fixtures__/daemon-key.pem', import.meta.url), 'utf8')
const daemonState = { token: '', identity: '', approved: false, acceptRequests: true, truncateLicenseResponse: false, malformedLicenseResponse: false }
const protocol = { server: undefined as Server | undefined, port: 0 }

function sendJson(response: import('http').ServerResponse, statusCode: number, body: unknown): void {
  response.writeHead(statusCode, { 'Content-Type': 'application/json' })
  response.end(JSON.stringify(body))
}

function answerProtocolRequest(request: import('http').IncomingMessage, response: import('http').ServerResponse): void {
  if (request.method === 'GET' && request.url === '/license') {
    if (daemonState.malformedLicenseResponse) {
      sendJson(response, 200, { version: '0.12.12-fixture', license: 'GPL-3.0-only', source: 'https://fixture.invalid/daemon', notice: 'Unrelated service' })

      return
    }
    if (daemonState.truncateLicenseResponse) {
      response.writeHead(200, { 'Content-Type': 'application/json' })
      response.flushHeaders()
      response.write('{"version":')
      setTimeout(() => response.destroy(), 50)

      return
    }
    sendJson(response, 200, { version: '0.12.12-fixture', license: 'AGPL-3.0-or-later', source: 'https://github.com/Bespok3d/daemon', notice: 'Fixture daemon 0.12.12-fixture' })

    return
  }
  if (request.method === 'POST' && request.url === '/access/request') {
    const chunks: Buffer[] = []
    request.on('data', (chunk: Buffer) => chunks.push(chunk))
    request.on('end', () => {
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8')) as { token: string; identity: string }
      daemonState.token = body.token
      daemonState.identity = body.identity
      sendJson(response, 200, { ok: daemonState.acceptRequests, cert: certificate })
    })

    return
  }
  if (request.method === 'GET' && request.url === '/status') {
    const authorized = request.headers.authorization === `Bearer ${daemonState.token}` && daemonState.approved
    sendJson(response, authorized ? 200 : 401, authorized ? { ok: true, version: '0.12.12-fixture' } : { detail: 'pending approval' })

    return
  }
  sendJson(response, 404, { detail: 'not found' })
}

function handler(name: string) {
  const registered = handlers.get(name)
  if (!registered) throw new Error(`Missing ${name} handler`)

  return registered
}

describe('access IPC against a local daemon-protocol fixture', () => {
  it('rejects an unrelated HTTPS service that answers at the daemon port', async () => {
    daemonState.malformedLicenseResponse = true

    await expect(fetchDaemonLicense('127.0.0.1', protocol.port)).rejects.toThrow(/unrecognized daemon response/)
  })

  it('rejects an interrupted license response promptly', async () => {
    daemonState.truncateLicenseResponse = true
    const probeOutcome = fetchDaemonLicense('127.0.0.1', protocol.port).then(
      () => ({ kind: 'resolved', message: '' }),
      (error: Error) => ({ kind: 'rejected', message: error.message }),
    )
    const outcome = await Promise.race([probeOutcome, new Promise<{ kind: string; message: string }>((resolve) => setTimeout(() => resolve({ kind: 'pending', message: '' }), 250))])

    expect(outcome.kind).toBe('rejected')
    expect(outcome.message).toMatch(/daemon license response (interrupted|ended early)/)
  })
})

describe('access request against a local daemon-protocol fixture', () => {
  it.each([
    { clientContext: 'same-machine fresh profile', printerId: 'fixture-same-machine-client', identity: 'fixture-same-machine-identity' },
    { clientContext: 'other-machine profile', printerId: 'fixture-other-machine-client', identity: 'fixture-other-machine-identity' },
  ])('identifies an uncredentialed daemon for a $clientContext, then grants only that client', async ({ printerId, identity }) => {
    fixture.printer.id = printerId
    vi.mocked(clientId).mockReturnValue(identity)
    const licenseProbe = await fetchDaemonLicense('127.0.0.1', protocol.port)
    expect(licenseProbe.version).toBe('0.12.12-fixture')
    registerAccessHandlers(protocol.port)

    await expect(handler('access:request')({}, printerId, 'Fixture laptop')).resolves.toEqual({ ok: true })

    expect(daemonState.identity).toBe(identity)
    expect(daemonState.token).toMatch(/^[a-f0-9]{64}$/)
    expect(await handler('access:status')({}, printerId)).toBe('pending')
    expect(fixture.existingClient.daemonToken).toBe('fixture-existing-token')
    expect(fixture.existingClient.accessIdentity).toBe('fixture-existing-identity')
    expect(updatePrinter).not.toHaveBeenCalledWith(fixture.existingClient.id, expect.anything())

    daemonState.approved = true
    expect(await handler('access:status')({}, fixture.printer.id)).toBe('granted')
    expect(fixture.printer.daemonToken).toBe(daemonState.token)
    expect(fixture.printer.accessIdentity).toBe(identity)
    expect(fixture.existingClient.daemonToken).toBe('fixture-existing-token')
    expect(updatePrinter).not.toHaveBeenCalledWith(fixture.existingClient.id, expect.anything())
    expect(vi.mocked(updatePrinter)).toHaveBeenCalledWith(printerId, expect.objectContaining({ daemonToken: daemonState.token }))
    expect(connect).not.toHaveBeenCalled()
  }, 10000)
})

describe('access request denial against the local daemon fixture', () => {
  it('preserves saved access when the protocol fixture denies a replacement request', async () => {
    fixture.printer.daemonToken = 'fixture-old-token'
    fixture.printer.daemonCert = certificate
    fixture.printer.accessIdentity = 'fixture-old-identity'
    daemonState.acceptRequests = false
    registerAccessHandlers(protocol.port)

    await expect(handler('access:request')({}, fixture.printer.id, 'Fixture laptop')).rejects.toThrow(/did not take the request/)

    expect(fixture.printer.daemonToken).toBe('fixture-old-token')
    expect(fixture.printer.accessIdentity).toBe('fixture-old-identity')
    expect(fixture.existingClient.daemonToken).toBe('fixture-existing-token')
    expect(updatePrinter).not.toHaveBeenCalledWith(fixture.existingClient.id, expect.anything())
    expect(connect).not.toHaveBeenCalled()
    expect(updatePrinter).not.toHaveBeenCalled()
  })
})

beforeAll(async () => {
  protocol.server = createServer({ key: privateKey, cert: certificate }, answerProtocolRequest)
  await new Promise<void>((resolve) => protocol.server?.listen(0, '127.0.0.1', resolve))
  protocol.port = (protocol.server?.address() as { port: number }).port
})

afterAll(async () => new Promise<void>((resolve, reject) => protocol.server?.close((error) => error ? reject(error) : resolve())))

beforeEach(() => {
  handlers.clear()
  fixture.printer.id = 'fixture-requesting-client'
  fixture.printer.status = 'online'
  fixture.printer.daemonToken = undefined
  fixture.printer.daemonCert = undefined
  fixture.printer.accessIdentity = undefined
  daemonState.token = ''
  daemonState.identity = ''
  daemonState.approved = false
  daemonState.acceptRequests = true
  daemonState.truncateLicenseResponse = false
  daemonState.malformedLicenseResponse = false
  vi.clearAllMocks()
})
