// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { AdapterDefinition, EnrollStep } from '../adapter-loader'
import type { SshSession } from '../ssh'
import type { OpStep } from './op-runner'

// What the four printer ops are: the daemon-side work the app owns, wrapped around the device-side
// work the adapter owns. These rails drive each handler with a stub adapter and read back the step
// list the op runner was handed, so an adapter's lifecycle landing in the wrong place (or the app
// growing device knowledge of its own again) fails here rather than on somebody's printer.

const handlers = new Map<string, (...args: unknown[]) => unknown>()

vi.mock('electron', () => ({
  ipcMain: { handle: (channel: string, listener: (...args: unknown[]) => unknown) => { handlers.set(channel, listener) } },
  app: { isPackaged: false },
}))

const stubSsh = { exec: vi.fn() } as unknown as SshSession
const capturedSteps: OpStep[][] = []

vi.mock('./op-runner', () => ({
  runSshOp: async (_win: unknown, _printerId: string, _credentials: unknown, buildSteps: (ssh: SshSession) => OpStep[]) => {
    capturedSteps.push(buildSteps(stubSsh))
  },
}))
const stubRecord = { id: 'printer-1', adapter: 'stub-adapter' }
vi.mock('../printers', () => ({ updatePrinter: vi.fn(), removePrinter: vi.fn(), resolveLiveAddress: vi.fn().mockResolvedValue(''), loadPrinters: () => [stubRecord] }))
vi.mock('../daemon-client/status', () => ({ getManagedRecord: () => stubRecord, recordOrThrow: () => stubRecord }))
vi.mock('../daemon-client/client', () => ({ deactivateAll: vi.fn(), teardownDaemon: vi.fn(), recoverPackages: vi.fn() }))
vi.mock('./daemon-ops', () => ({ runRepair: vi.fn(), runUpdateDaemon: vi.fn(), runUpdateJinni: vi.fn() }))
vi.mock('./reboot-wait', () => ({ waitForThePrinterToComeBack: vi.fn() }))
vi.mock('./daemon-log', () => ({ waitForDaemon: vi.fn() }))
vi.mock('../adapter-loader', () => ({ getAdapter: () => stubAdapter }))

function lifecycleStep(id: string): EnrollStep {
  return { id, label: id, detail: `detail for ${id}`, run: vi.fn().mockResolvedValue(undefined) }
}

const stubAdapter = {
  id: 'stub-adapter',
  defaults: { sshUser: 'pi', sshPort: 22, sshPasswordHint: 'raspberry', runtimeUser: 'pi' },
  lifecycle: {
    deactivate: [lifecycleStep('disable-services')],
    reactivate: [lifecycleStep('remove-marker'), lifecycleStep('enable-services'), lifecycleStep('start-daemon')],
    remove: [lifecycleStep('remove-system-files'), lifecycleStep('remove-workspace')],
    reboot: [lifecycleStep('power-cycle')],
  },
  readDaemonLog: vi.fn().mockResolvedValue(''),
} as unknown as AdapterDefinition

import { registerPrinterOperationHandlers } from './printer-ops'

const fakeWindow = {} as never
registerPrinterOperationHandlers(() => fakeWindow)

async function stepIdsOf(channel: string): Promise<string[]> {
  capturedSteps.length = 0
  await handlers.get(channel)?.({}, 'printer-1', '10.0.0.5', 'pi', 'secret', 22)

  return (capturedSteps[0] ?? []).map((step) => step.id)
}

describe('printer ops compose the adapter lifecycle', () => {
  beforeEach(() => { capturedSteps.length = 0 })

  it('stops the plugins first, then runs the adapter deactivate steps', async () => {
    expect(await stepIdsOf('printer:deactivate')).toEqual(['stop-plugins', 'disable-services'])
  })

  it('runs the adapter reactivate steps, then verifies and re-applies', async () => {
    expect(await stepIdsOf('printer:reactivate')).toEqual([
      'remove-marker', 'enable-services', 'start-daemon', 'verify-daemon', 're-apply-plugins',
    ])
  })

  it('tears the daemon down first, then runs the adapter removal steps', async () => {
    expect(await stepIdsOf('printer:uninstall')).toEqual(['teardown-daemon', 'remove-system-files', 'remove-workspace'])
  })

  it('lets the adapter ask for the power cycle and waits for the printer itself', async () => {
    expect(await stepIdsOf('printer:reboot')).toEqual(['power-cycle', 'wait-for-reconnect'])
  })
})

describe('an adapter step reached through an op', () => {
  it('keeps the adapter label and detail so the modal reads the same as during enrolment', async () => {
    capturedSteps.length = 0
    await handlers.get('printer:reboot')?.({}, 'printer-1', '10.0.0.5', 'pi', 'secret', 22)
    const powerCycle = capturedSteps[0][0]
    expect(powerCycle.label).toBe('power-cycle')
    expect(powerCycle.detail).toBe('detail for power-cycle')
  })

  it('runs against the open session with the op runner progress threaded into the context', async () => {
    capturedSteps.length = 0
    await handlers.get('printer:reboot')?.({}, 'printer-1', '10.0.0.5', 'pi', 'secret', 22)
    const progress = vi.fn()
    await capturedSteps[0][0].run(progress)
    const adapterStep = stubAdapter.lifecycle.reboot[0].run as ReturnType<typeof vi.fn>
    expect(adapterStep).toHaveBeenCalledTimes(1)
    expect(adapterStep.mock.calls[0][0]).toBe(stubSsh)
    expect(adapterStep.mock.calls[0][1]).toMatchObject({ printerId: 'printer-1', ip: '10.0.0.5', runtimeUser: 'pi', onProgress: progress })
  })
})
