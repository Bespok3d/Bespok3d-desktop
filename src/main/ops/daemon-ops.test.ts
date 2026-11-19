// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { BrowserWindow } from 'electron'
import type { AdapterDefinition, EnrollStep } from '../adapter-loader'
import type { SshSession } from '../ssh'
import type { OpStep } from './op-runner'

vi.mock('../printers', () => ({ updatePrinter: vi.fn(), loadPrinters: vi.fn(() => []) }))
vi.mock('../adapter-loader', () => ({ getAdapter: vi.fn() }))
vi.mock('../daemon-client/status', () => ({ recordOrThrow: vi.fn(() => ({ id: 'printer-1', adapter: 'example' })), verifyDaemonVersion: vi.fn() }))
vi.mock('../daemon-client/expected-version', () => ({ expectedDaemonVersion: () => '0.14.0' }))
vi.mock('../store/system-package', () => ({ openSystemPackage: vi.fn(async () => ({ version: '0.14.0' })) }))
vi.mock('../compat/jinni-baseline', () => ({ offeredJinniVersion: vi.fn() }))
vi.mock('./daemon-log', () => ({ waitForDaemon: vi.fn(), tailDaemonLog: vi.fn() }))
vi.mock('./op-runner', () => ({ runSshOp: vi.fn() }))
vi.mock('../daemon-client/client', () => ({ wireSetupAfterDaemonMove: vi.fn() }))
vi.mock('../compat', async () => ({
  assertNotADaemonDowngrade: vi.fn(),
  assertPairLandedTogether: vi.fn(),
  assertPrinterNotPrinting: vi.fn(),
  reportedDaemonVersion: vi.fn(async () => null),
  keepingNewerInstalledDaemon: (await vi.importActual<typeof import('../compat/installed-daemon')>('../compat/installed-daemon')).keepingNewerInstalledDaemon,
}))

import { runRepair, runUpdateDaemon, runUpdateJinni } from './daemon-ops'
import { wireSetupAfterDaemonMove } from '../daemon-client/client'
import { getAdapter } from '../adapter-loader'
import { runSshOp } from './op-runner'
import { updatePrinter } from '../printers'
import { reportedDaemonVersion, assertPairLandedTogether } from '../compat'

const PRINTER_BESPOK3D_ROOT = '/opt/bespok3d-example'
const REPAIRING_WINDOW = { webContents: { send: vi.fn() } } as unknown as BrowserWindow

function printerWithDaemonOnDisk(installedVersion: string): SshSession {
  return { exec: vi.fn(async (command: string) => (command.includes('version.py') ? `DAEMON_VERSION = "${installedVersion}"\n` : '')) } as unknown as SshSession
}

function adapterStep(id: string): EnrollStep {
  return { id, label: id, detail: '', run: vi.fn() }
}

function repairAdapter(deployDaemon: EnrollStep, deployBootScript = adapterStep('deploy-s99')): AdapterDefinition {
  return {
    id: 'example', jinniVersion: '0.1.12', jinniPackage: 'bespok3d-jinni-example',
    defaults: { runtimeUser: 'user' }, envVars: [{ name: 'BESPOK3D', value: PRINTER_BESPOK3D_ROOT }],
    enrollSteps: [deployDaemon, deployBootScript, adapterStep('start-daemon')], verifyEnrolled: vi.fn(async () => true),
  } as unknown as AdapterDefinition
}

async function runOpStepsOn(printer: SshSession, buildSteps: (ssh: SshSession) => OpStep[]): Promise<void> {
  await buildSteps(printer).reduce((previous, step) => previous.then(() => step.run(vi.fn())), Promise.resolve())
}

function stepsRunOn(printer: SshSession, deployDaemon: EnrollStep, deployBootScript?: EnrollStep): void {
  vi.mocked(getAdapter).mockReturnValue(repairAdapter(deployDaemon, deployBootScript))
  vi.mocked(runSshOp).mockImplementation((_win, _printerId, _credentials, buildSteps) => runOpStepsOn(printer, buildSteps))
}

async function repairOn(printer: SshSession, deployDaemon: EnrollStep, forced = false, deployBootScript?: EnrollStep): Promise<void> {
  stepsRunOn(printer, deployDaemon, deployBootScript)

  await runRepair(REPAIRING_WINDOW, 'printer-1', '192.0.2.10', 'root', 'example', 22, forced)
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('a daemon repair', () => {
  it('keeps a newer daemon the printer has on its disk, though that daemon is not running', async () => {
    var deployDaemon = adapterStep('deploy-daemon')

    await repairOn(printerWithDaemonOnDisk('0.14.1'), deployDaemon)

    expect(deployDaemon.run).not.toHaveBeenCalled()
  })

  it('records the newer daemon it kept, not the one this app ships', async () => {
    var deployDaemon = adapterStep('deploy-daemon')
    vi.mocked(reportedDaemonVersion).mockResolvedValueOnce('0.14.1')

    await repairOn(printerWithDaemonOnDisk('0.14.1'), deployDaemon)

    expect(deployDaemon.run).not.toHaveBeenCalled()
    expect(updatePrinter).toHaveBeenCalledWith('printer-1', expect.objectContaining({ daemonVersion: '0.14.1' }))
  })

  it('puts this app\'s daemon over a newer one when the owner forced it', async () => {
    var deployDaemon = adapterStep('deploy-daemon')

    await repairOn(printerWithDaemonOnDisk('0.14.1'), deployDaemon, true)

    expect(deployDaemon.run).toHaveBeenCalledOnce()
  })

  it('sends only the daemon files whose checksum differs from the printer\'s', async () => {
    var deployDaemon = adapterStep('deploy-daemon')
    var printer = printerWithDaemonOnDisk('0.13.9')

    await repairOn(printer, deployDaemon)

    expect(deployDaemon.run).toHaveBeenCalledWith(printer, expect.objectContaining({ sendChangedFilesOnly: true }))
  })

  it('looks for the daemon\'s problems under the bespok3d folder the printer\'s adapter names', async () => {
    var printer = printerWithDaemonOnDisk('0.13.9')

    await repairOn(printer, adapterStep('deploy-daemon'))

    expect(printer.exec).toHaveBeenCalledWith(expect.stringContaining(`'${PRINTER_BESPOK3D_ROOT}'/var/lib/daemon/daemon.py`))
  })
})

describe('the startup script after a daemon repair', () => {
  it('puts the startup script back from the daemon it left on the printer', async () => {
    var deployDaemon = adapterStep('deploy-daemon')
    var deployBootScript = adapterStep('deploy-s99')
    var printer = printerWithDaemonOnDisk('0.13.9')

    await repairOn(printer, deployDaemon, false, deployBootScript)

    expect(deployBootScript.run).toHaveBeenCalledWith(printer, expect.anything())
    expect(vi.mocked(deployBootScript.run).mock.invocationCallOrder[0]).toBeGreaterThan(vi.mocked(deployDaemon.run).mock.invocationCallOrder[0])
  })

  it('puts the startup script back from the newer daemon it kept', async () => {
    var deployBootScript = adapterStep('deploy-s99')

    await repairOn(printerWithDaemonOnDisk('0.14.1'), adapterStep('deploy-daemon'), false, deployBootScript)

    expect(deployBootScript.run).toHaveBeenCalledOnce()
  })
})

describe('a daemon update', () => {
  it('puts the startup script back from the daemon it just sent', async () => {
    var deployDaemon = adapterStep('deploy-daemon')
    var deployBootScript = adapterStep('deploy-s99')
    var printer = printerWithDaemonOnDisk('0.13.9')
    stepsRunOn(printer, deployDaemon, deployBootScript)

    await runUpdateDaemon(REPAIRING_WINDOW, 'printer-1', '192.0.2.10', 'root', 'example', 22)

    expect(deployBootScript.run).toHaveBeenCalledWith(printer, expect.anything())
    expect(vi.mocked(deployBootScript.run).mock.invocationCallOrder[0]).toBeGreaterThan(vi.mocked(deployDaemon.run).mock.invocationCallOrder[0])
  })
})

function jinniUpdateOn(printer: SshSession, deployJinni: EnrollStep): Promise<void> {
  vi.mocked(getAdapter).mockReturnValue({ ...repairAdapter(adapterStep('deploy-daemon')), opSteps: [deployJinni] } as unknown as AdapterDefinition)
  vi.mocked(runSshOp).mockImplementation((_win, _printerId, _credentials, buildSteps) => runOpStepsOn(printer, buildSteps))

  return runUpdateJinni(REPAIRING_WINDOW, 'printer-1', '192.0.2.10', 'root', 'example', 22)
}

function daemonUpdateOn(printer: SshSession): Promise<void> {
  stepsRunOn(printer, adapterStep('deploy-daemon'))

  return runUpdateDaemon(REPAIRING_WINDOW, 'printer-1', '192.0.2.10', 'root', 'example', 22)
}

function calledBefore(first: ReturnType<typeof vi.fn>, second: ReturnType<typeof vi.fn>): boolean {
  return first.mock.invocationCallOrder[0] < second.mock.invocationCallOrder[0]
}

const EVERY_DAEMON_MOVE: Array<[string, () => Promise<void>]> = [
  ['daemon update', () => daemonUpdateOn(printerWithDaemonOnDisk('0.13.9'))],
  ['jinni update', () => jinniUpdateOn(printerWithDaemonOnDisk('0.13.9'), adapterStep('deploy-jinni'))],
  ['daemon repair', () => repairOn(printerWithDaemonOnDisk('0.13.9'), adapterStep('deploy-daemon'))],
]

describe('the printer setup after a daemon or jinni move', () => {
  it.each(EVERY_DAEMON_MOVE)('a %s wires the settings files the new daemon or jinni checks, so no banner asks for it', async (_move, moveDaemon) => {
    await moveDaemon()

    expect(wireSetupAfterDaemonMove).toHaveBeenCalledOnce()
    expect(wireSetupAfterDaemonMove).toHaveBeenCalledWith(expect.objectContaining({ id: 'printer-1' }))
    expect(calledBefore(vi.mocked(assertPairLandedTogether), vi.mocked(updatePrinter))).toBe(true)
    expect(calledBefore(vi.mocked(updatePrinter), vi.mocked(wireSetupAfterDaemonMove))).toBe(true)
  })

  it.each(EVERY_DAEMON_MOVE)('a %s saves and wires nothing through a pair that does not fit', async (_move, moveDaemon) => {
    vi.mocked(assertPairLandedTogether).mockRejectedValueOnce(new Error('pair does not fit'))

    await expect(moveDaemon()).rejects.toThrow('pair does not fit')
    expect(updatePrinter).not.toHaveBeenCalled()
    expect(wireSetupAfterDaemonMove).not.toHaveBeenCalled()
  })

  // The wiring is a step on screen, so a failure shows as that step failed, while the move that landed
  // stays saved.
  it.each(EVERY_DAEMON_MOVE)('a %s keeps the move it saved when the wiring fails', async (_move, moveDaemon) => {
    vi.mocked(wireSetupAfterDaemonMove).mockRejectedValueOnce(new Error('connection reset'))

    await expect(moveDaemon()).rejects.toThrow('connection reset')
    expect(updatePrinter).toHaveBeenCalledWith('printer-1', expect.objectContaining({ status: 'managed' }))
  })
})
