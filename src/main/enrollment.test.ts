// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { BrowserWindow } from 'electron'
import type { SshSession } from './ssh'
import type { EnrollStep } from './adapter-loader'

vi.mock('./ssh', () => ({ connect: vi.fn(), createPersistentSession: vi.fn() }))
vi.mock('./adapter-loader', () => ({ getAdapter: vi.fn() }))
vi.mock('./printers', () => ({ updatePrinter: vi.fn() }))
vi.mock('./keys', () => ({ listKeys: vi.fn().mockReturnValue([]) }))
vi.mock('./settings', () => ({
  loadSettings: () => ({ pgpEnabled: false, clientId: 'test-client' }),
  clientId: () => 'test-client',
}))

import { checkSsh, enrollPrinter } from './enrollment'
import { connect, createPersistentSession } from './ssh'
import { getAdapter } from './adapter-loader'
import { updatePrinter } from './printers'

const mockConnect = vi.mocked(connect)
const mockCreatePersistentSession = vi.mocked(createPersistentSession)
const mockGetAdapter = vi.mocked(getAdapter)
const mockUpdatePrinter = vi.mocked(updatePrinter)

// markEnrolled merges via a function patch; resolve it against a base record to read the fields written.
function enrolledPatch() {
  const patch = mockUpdatePrinter.mock.calls.at(-1)?.[1]

  return typeof patch === 'function' ? patch(fakePrinterRecord) : patch
}

function mockSession(overrides: Partial<SshSession> = {}): SshSession {
  return { host: 'test.local', exec: vi.fn().mockResolvedValue('ok'), getContent: vi.fn(), putContent: vi.fn(), putBytes: vi.fn(), close: vi.fn(), ...overrides }
}

function mockStep(id: string, runImpl = vi.fn().mockResolvedValue(undefined)): EnrollStep {
  return { id, label: `Label ${id}`, detail: `Detail ${id}`, run: runImpl }
}

function mockAdapter(steps: EnrollStep[]) {
  return {
    id: 'test', title: 'Test', vendor: 'Test', version: '1.0.0', jinniVersion: '0.1.6', description: '',
    defaults: { sshUser: 'root', sshPort: 22, sshPasswordHint: '', runtimeUser: 'user' },
    envVars: [], enrollSteps: steps, verifyEnrolled: vi.fn().mockResolvedValue(true),
  }
}

const fakePrinterRecord = {
  id: 'p1', nick: 'My Printer', model: 'test', adapter: 'test', host: 'test.local',
  ip: '192.168.1.100', status: 'online' as const, installedIds: [],
}

const fakeWin = { webContents: { send: vi.fn() } } as unknown as BrowserWindow
const CREDS = { user: 'root', password: 'pw', port: 22 }

beforeEach(() => {
  vi.clearAllMocks()
  mockConnect.mockResolvedValue(mockSession())
  mockCreatePersistentSession.mockReturnValue(mockSession())
})

describe('checkSsh', () => {
  it('returns ok:true when the connection and echo succeed', async () => {
    const result = await checkSsh('192.168.1.1', CREDS)
    expect(result).toEqual({ ok: true })
  })

  it('returns ok:false with the error message when connect throws', async () => {
    mockConnect.mockRejectedValue(new Error('Connection refused'))
    const result = await checkSsh('192.168.1.1', CREDS)
    expect(result.ok).toBe(false)
    expect(result.error).toContain('Connection refused')
  })
})

describe('enrollPrinter', () => {
  it('runs all steps in order and saves the printer as managed on success', async () => {
    const stepA = mockStep('step-a')
    const stepB = mockStep('step-b')
    mockGetAdapter.mockReturnValue(mockAdapter([stepA, stepB]))

    await enrollPrinter(fakeWin, 'p1', '192.168.1.100', 'test', CREDS)

    expect(stepA.run).toHaveBeenCalledOnce()
    expect(stepB.run).toHaveBeenCalledOnce()
    expect(enrolledPatch()).toMatchObject({ status: 'managed' })
  })

  it('stops at the failed step and does not save the printer as managed', async () => {
    const failingStep = mockStep('step-a', vi.fn().mockRejectedValue(new Error('SSH failed')))
    const skippedStep = mockStep('step-b')
    mockGetAdapter.mockReturnValue(mockAdapter([failingStep, skippedStep]))

    await enrollPrinter(fakeWin, 'p1', '192.168.1.100', 'test', CREDS)

    expect(skippedStep.run).not.toHaveBeenCalled()
    expect(mockUpdatePrinter).not.toHaveBeenCalled()
  })

  it('skips steps before retryFromStepId', async () => {
    const stepA = mockStep('step-a')
    const stepB = mockStep('step-b')
    const stepC = mockStep('step-c')
    mockGetAdapter.mockReturnValue(mockAdapter([stepA, stepB, stepC]))

    await enrollPrinter(fakeWin, 'p1', '192.168.1.100', 'test', CREDS, 'step-b')

    expect(stepA.run).not.toHaveBeenCalled()
    expect(stepB.run).toHaveBeenCalledOnce()
    expect(stepC.run).toHaveBeenCalledOnce()
  })

  it('retries the step on a connection error and succeeds on the next attempt', async () => {
    const connectionError = Object.assign(new Error('Connection closed'), { code: 'ECONNRESET' })
    const retryStep = mockStep('step-a', vi.fn()
      .mockRejectedValueOnce(connectionError)
      .mockResolvedValueOnce(undefined))
    mockGetAdapter.mockReturnValue(mockAdapter([retryStep]))

    await enrollPrinter(fakeWin, 'p1', '192.168.1.100', 'test', CREDS)

    expect(retryStep.run).toHaveBeenCalledTimes(2)
    expect(enrolledPatch()).toMatchObject({ status: 'managed' })
  })
})
