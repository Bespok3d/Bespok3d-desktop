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
import { connect } from '../ssh'
import { RESET_ACCESS_ALREADY_RUNNING } from './reset-access-busy'

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

function fakePrinterSession(exec = vi.fn().mockResolvedValue('')) {
  return { exec, putContent: vi.fn().mockResolvedValue(undefined), close: vi.fn() }
}

function tokenWrittenTo(printerSession: ReturnType<typeof fakePrinterSession>): string {
  return JSON.parse(printerSession.putContent.mock.calls[0][1]).tokens[0]
}

function resetOnPrinter() {
  return accessHandler('printer:reset-access')({}, 'fixture-printer', '192.0.2.23', 'root', 'their-secret', 22)
}

function heldDaemonAnswers(): Array<(answer: unknown) => void> {
  const daemonAnswers: Array<(answer: unknown) => void> = []
  vi.mocked(requestAccess).mockImplementation(() => new Promise((resolve) => { daemonAnswers.push(resolve) }) as never)

  return daemonAnswers
}

function letPendingWorkRun() {
  return new Promise((settle) => setTimeout(settle, 0))
}

function startFromCleanFixtures() {
  vi.clearAllMocks()
  vi.mocked(connect).mockReset()
  vi.mocked(requestAccess).mockReset()
  handlers.clear()
  fixture.record.status = 'online'
  fixture.record.daemonToken = undefined
  fixture.record.daemonCert = undefined
  fixture.record.accessIdentity = undefined
}

describe('reset access', () => {
  beforeEach(startFromCleanFixtures)

  it('refuses a second reset while the first runs, so the stored token is the one the printer kept', async () => {
    const printerSession = fakePrinterSession()
    const loginGate = { open: (_session: unknown) => undefined as void }
    vi.mocked(connect).mockImplementation(() => new Promise((resolve) => { loginGate.open = resolve }) as never)
    registerAccessHandlers()

    const firstReset = resetOnPrinter()
    await expect(resetOnPrinter()).rejects.toThrow(RESET_ACCESS_ALREADY_RUNNING)
    await vi.waitFor(() => expect(connect).toHaveBeenCalled())
    loginGate.open(printerSession)
    await firstReset

    expect(connect).toHaveBeenCalledTimes(1)
    expect(printerSession.putContent).toHaveBeenCalledTimes(1)
    expect(fixture.record.daemonToken).toBe(tokenWrittenTo(printerSession))
  })

  it('takes a new reset once the one before it has ended', async () => {
    const printerSession = fakePrinterSession(vi.fn().mockRejectedValueOnce(new Error('fixture write refused')).mockResolvedValue(''))
    vi.mocked(connect).mockResolvedValue(printerSession as never)
    registerAccessHandlers()

    await expect(resetOnPrinter()).rejects.toThrow('fixture write refused')
    await resetOnPrinter()

    expect(updatePrinter).toHaveBeenCalledTimes(1)
  })

  it('keeps the token the printer now holds even when clearing the pending requests fails', async () => {
    const printerSession = fakePrinterSession(vi.fn().mockResolvedValueOnce('').mockRejectedValue(new Error('fixture removal refused')))
    vi.mocked(connect).mockResolvedValue(printerSession as never)
    registerAccessHandlers()

    await expect(resetOnPrinter()).rejects.toThrow('fixture removal refused')

    expect(fixture.record.daemonToken).toBe(tokenWrittenTo(printerSession))
  })
})

describe('reset access next to an access request', () => {
  beforeEach(startFromCleanFixtures)

  it('refuses an access request while a reset runs, so the request cannot replace the reset token', async () => {
    const loginGate = { open: (_session: unknown) => undefined as void }
    vi.mocked(connect).mockImplementation(() => new Promise((resolve) => { loginGate.open = resolve }) as never)
    registerAccessHandlers()

    const reset = resetOnPrinter()
    await expect(accessHandler('access:request')({}, 'fixture-printer', '')).rejects.toThrow(RESET_ACCESS_ALREADY_RUNNING)
    await vi.waitFor(() => expect(connect).toHaveBeenCalled())
    loginGate.open(fakePrinterSession())
    await reset

    expect(requestAccess).not.toHaveBeenCalled()
  })

  it('lets a running access request end before the reset stores its token', async () => {
    const printerSession = fakePrinterSession()
    const daemonAnswers = heldDaemonAnswers()
    vi.mocked(connect).mockResolvedValue(printerSession as never)
    registerAccessHandlers()

    const request = accessHandler('access:request')({}, 'fixture-printer', '')
    const reset = resetOnPrinter()
    await letPendingWorkRun()
    expect(connect).not.toHaveBeenCalled()
    daemonAnswers[0]({ ok: true, cert: 'fixture-certificate' })
    await Promise.all([request, reset])

    expect(fixture.record.daemonToken).toBe(tokenWrittenTo(printerSession))
  })
})

describe('reset access after an access request that fails', () => {
  beforeEach(startFromCleanFixtures)

  it('still resets when the access request it waited for fails', async () => {
    const printerSession = fakePrinterSession()
    const daemonRefusal = { give: (_failure: Error) => undefined as void }
    vi.mocked(requestAccess).mockImplementation(() => new Promise((_resolve, reject) => { daemonRefusal.give = reject }) as never)
    vi.mocked(connect).mockResolvedValue(printerSession as never)
    registerAccessHandlers()

    const request = accessHandler('access:request')({}, 'fixture-printer', '')
    const reset = resetOnPrinter()
    await letPendingWorkRun()
    expect(connect).not.toHaveBeenCalled()
    daemonRefusal.give(new Error('fixture request denied'))
    await expect(request).rejects.toThrow('fixture request denied')
    await reset

    expect(fixture.record.daemonToken).toBe(tokenWrittenTo(printerSession))
  })
})

describe('reset access after several access requests', () => {
  beforeEach(startFromCleanFixtures)

  it('waits for every running access request, not only the newest, before it stores its token', async () => {
    const printerSession = fakePrinterSession()
    const daemonAnswers = heldDaemonAnswers()
    vi.mocked(connect).mockResolvedValue(printerSession as never)
    registerAccessHandlers()

    const firstRequest = accessHandler('access:request')({}, 'fixture-printer', '')
    const secondRequest = accessHandler('access:request')({}, 'fixture-printer', '')
    const reset = resetOnPrinter()
    await vi.waitFor(() => expect(daemonAnswers).toHaveLength(2))
    daemonAnswers[1]({ ok: true, cert: 'fixture-certificate' })
    await secondRequest
    await letPendingWorkRun()
    expect(connect).not.toHaveBeenCalled()
    daemonAnswers[0]({ ok: true, cert: 'fixture-certificate' })
    await Promise.all([firstRequest, reset])

    expect(fixture.record.daemonToken).toBe(tokenWrittenTo(printerSession))
  })

  it('still waits for an older access request after a newer one has ended', async () => {
    const printerSession = fakePrinterSession()
    const daemonAnswers = heldDaemonAnswers()
    vi.mocked(connect).mockResolvedValue(printerSession as never)
    registerAccessHandlers()

    const olderRequest = accessHandler('access:request')({}, 'fixture-printer', '')
    const newerRequest = accessHandler('access:request')({}, 'fixture-printer', '')
    await vi.waitFor(() => expect(daemonAnswers).toHaveLength(2))
    daemonAnswers[1]({ ok: true, cert: 'fixture-certificate' })
    await newerRequest
    const reset = resetOnPrinter()
    await letPendingWorkRun()
    expect(connect).not.toHaveBeenCalled()
    daemonAnswers[0]({ ok: true, cert: 'fixture-certificate' })
    await Promise.all([olderRequest, reset])

    expect(fixture.record.daemonToken).toBe(tokenWrittenTo(printerSession))
  })
})
