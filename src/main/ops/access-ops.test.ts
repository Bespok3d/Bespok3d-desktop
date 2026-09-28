// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect, vi, beforeEach } from 'vitest'

const handlers = new Map<string, (...args: unknown[]) => unknown>()
const fixture = vi.hoisted(() => ({
  record: { id: 'fixture-printer', ip: '192.0.2.23', status: 'online', daemonToken: undefined as string | undefined, daemonCert: undefined as string | undefined, accessIdentity: undefined as string | undefined },
  existingClientRecord: { id: 'fixture-existing-client', ip: '192.0.2.23', daemonToken: 'fixture-existing-token', daemonCert: 'fixture-existing-cert', accessIdentity: 'fixture-existing-identity' },
}))

vi.mock('electron', () => ({ ipcMain: { handle: (channel: string, handler: (...args: unknown[]) => unknown) => handlers.set(channel, handler) } }))
vi.mock('../printers', () => ({ loadPrinters: vi.fn(() => [fixture.record, fixture.existingClientRecord]), updatePrinter: vi.fn((_id: string, fields: object) => Object.assign(fixture.record, fields)) }))
vi.mock('../daemon-client/status', () => ({ recordOrThrow: vi.fn(() => fixture.record) }))
vi.mock('../keys', () => ({ listKeys: vi.fn(() => []) }))
vi.mock('../settings', () => ({ loadSettings: vi.fn(() => ({ pgpEnabled: false })), clientId: vi.fn(() => 'fixture-client-identity') }))
vi.mock('../daemon-client/client', () => ({
  requestAccess: vi.fn(), isAccessGranted: vi.fn(), fetchAccessClients: vi.fn(), grantAccess: vi.fn(), revokeAccess: vi.fn(),
}))
vi.mock('../adapter-loader', () => ({ getAdapter: vi.fn() }))
vi.mock('../ssh', () => ({ connect: vi.fn(), shellQuote: vi.fn((value: string) => value) }))

import { registerAccessHandlers } from './access-ops'
import { updatePrinter } from '../printers'
import { requestAccess, isAccessGranted } from '../daemon-client/client'

function accessHandler(name: string) {
  const handler = handlers.get(name)
  if (!handler) throw new Error(`Missing ${name} handler`)

  return handler
}

describe('access request IPC flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    handlers.clear()
    fixture.record.status = 'online'
    fixture.record.daemonToken = undefined
    fixture.record.daemonCert = undefined
    fixture.record.accessIdentity = undefined
  })

  it('keeps request credentials local, reports pending, then confirms the new client grant', async () => {
    vi.mocked(requestAccess).mockResolvedValue({ ok: true, cert: 'fixture-certificate' })
    vi.mocked(isAccessGranted).mockResolvedValueOnce(false).mockResolvedValueOnce(true)
    registerAccessHandlers()

    await accessHandler('access:request')({}, 'fixture-printer', '')

    const request = vi.mocked(requestAccess).mock.calls[0][0]
    expect(request).toMatchObject({ ip: '192.0.2.23', identity: 'fixture-client-identity', label: expect.any(String) })
    expect(request.token).toMatch(/^[a-f0-9]{64}$/)
    expect(updatePrinter).toHaveBeenCalledWith('fixture-printer', {
      daemonCert: 'fixture-certificate', daemonToken: request.token, accessIdentity: 'fixture-client-identity', status: 'online',
    })
    expect(await accessHandler('access:status')({}, 'fixture-printer')).toBe('pending')
    expect(await accessHandler('access:status')({}, 'fixture-printer')).toBe('granted')
    expect(updatePrinter).toHaveBeenLastCalledWith('fixture-printer', { status: 'managed' })
  })

  it('does not replace saved credentials when the daemon refuses the new request', async () => {
    vi.mocked(requestAccess).mockRejectedValue(new Error('fixture request denied'))
    registerAccessHandlers()

    await expect(accessHandler('access:request')({}, 'fixture-printer', '')).rejects.toThrow('fixture request denied')

    expect(updatePrinter).not.toHaveBeenCalled()
    expect(fixture.existingClientRecord.daemonToken).toBe('fixture-existing-token')
  })
})
