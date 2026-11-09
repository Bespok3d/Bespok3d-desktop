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
vi.mock('../compat', async () => ({
  assertNotADaemonDowngrade: vi.fn(),
  assertPairLandedTogether: vi.fn(),
  assertPrinterNotPrinting: vi.fn(),
  reportedDaemonVersion: vi.fn(async () => null),
  keepingNewerInstalledDaemon: (await vi.importActual<typeof import('../compat/installed-daemon')>('../compat/installed-daemon')).keepingNewerInstalledDaemon,
}))

import { runRepair } from './daemon-ops'
import { getAdapter } from '../adapter-loader'
import { runSshOp } from './op-runner'
import { updatePrinter } from '../printers'
import { reportedDaemonVersion } from '../compat'

const PRINTER_BESPOK3D_ROOT = '/opt/bespok3d-example'
const REPAIRING_WINDOW = { webContents: { send: vi.fn() } } as unknown as BrowserWindow

function printerWithDaemonOnDisk(installedVersion: string): SshSession {
  return { exec: vi.fn(async (command: string) => (command.includes('version.py') ? `DAEMON_VERSION = "${installedVersion}"\n` : '')) } as unknown as SshSession
}

function adapterStep(id: string): EnrollStep {
  return { id, label: id, detail: '', run: vi.fn() }
}

function repairAdapter(deployDaemon: EnrollStep): AdapterDefinition {
  return {
    id: 'example', jinniVersion: '0.1.12', jinniPackage: 'bespok3d-jinni-example',
    defaults: { runtimeUser: 'user' }, envVars: [{ name: 'BESPOK3D', value: PRINTER_BESPOK3D_ROOT }],
    enrollSteps: [deployDaemon, adapterStep('start-daemon')], verifyEnrolled: vi.fn(async () => true),
  } as unknown as AdapterDefinition
}

async function runOpStepsOn(printer: SshSession, buildSteps: (ssh: SshSession) => OpStep[]): Promise<void> {
  await buildSteps(printer).reduce((previous, step) => previous.then(() => step.run(vi.fn())), Promise.resolve())
}

async function repairOn(printer: SshSession, deployDaemon: EnrollStep, forced = false): Promise<void> {
  vi.mocked(getAdapter).mockReturnValue(repairAdapter(deployDaemon))
  vi.mocked(runSshOp).mockImplementation((_win, _printerId, _credentials, buildSteps) => runOpStepsOn(printer, buildSteps))

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
    vi.mocked(reportedDaemonVersion).mockResolvedValueOnce('0.14.1')

    await repairOn(printerWithDaemonOnDisk('0.14.1'), adapterStep('deploy-daemon'))

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
