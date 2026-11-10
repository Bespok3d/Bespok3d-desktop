// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect, vi } from 'vitest'
import type { BrowserWindow } from 'electron'
import type { SshSession } from '../ssh'
import type { OpStep } from './op-runner'
import type { BatchResult } from '../daemon-client/batch-result'

// printer-ops imports the U1 adapter client (electron-bound) at module load; stub the heavy edges so the
// pure command builder can be imported in isolation.
// `app` is here because the adapter this file pulls in reaches the bundled packages, and the code
// that finds them asks electron whether this is a packaged build.
vi.mock('electron', () => ({ ipcMain: { handle: vi.fn() }, app: { isPackaged: false } }))
vi.mock('@adapters/snapmaker-u1/client/snapmaker-u1', () => ({
  patchS90lmd: (text: string) => text, bespok3dIncludeCommand: () => 'true', KLIPPER_INCLUDE: '', MOONRAKER_INCLUDE: '',
}))
vi.mock('../printers', () => ({ updatePrinter: vi.fn(), removePrinter: vi.fn(), resolveLiveAddress: vi.fn(async () => null) }))
vi.mock('../adapter-loader', () => ({ getAdapter: vi.fn(() => undefined) }))
vi.mock('../daemon-client/status', () => ({ recordOrThrow: vi.fn(() => ({ id: 'printer-1', adapter: 'example' })), getManagedRecord: vi.fn() }))
vi.mock('../daemon-client/client', () => ({ recoverPackages: vi.fn(), deactivateAll: vi.fn(), teardownDaemon: vi.fn() }))
vi.mock('../daemon-client/feeds/install-progress', () => ({ watchInstallProgress: vi.fn(async () => vi.fn()) }))
vi.mock('../store/restore-changed-files', () => ({ restoreChangedFiles: vi.fn(async () => []) }))
vi.mock('./op-runner', () => ({ runSshOp: vi.fn() }))
vi.mock('./daemon-log', () => ({ waitForDaemon: vi.fn(), tailDaemonLog: vi.fn() }))
vi.mock('./daemon-ops', () => ({ runRepair: vi.fn(), runUpdateDaemon: vi.fn(), runUpdateJinni: vi.fn() }))
vi.mock('./reboot-wait', () => ({ waitForThePrinterToComeBack: vi.fn() }))

import { ipcMain } from 'electron'
import { bespok3dRemovalCommand, registerPrinterOperationHandlers } from './printer-ops'
import { recoverPackages } from '../daemon-client/client'
import { runSshOp } from './op-runner'

describe('bespok3dRemovalCommand', () => {
  const command = bespok3dRemovalCommand()

  it('recreates the dhcpcd state dir after removing its dangling symlink (or no DHCP on reboot)', () => {
    expect(command).toContain('rm -f /var/db/dhcpcd ; mkdir -p /var/db/dhcpcd')
  })

  it('re-locks the overlay by removing /oem/.debug for a truly-mint state on the next boot', () => {
    expect(command).toContain('rm -f /oem/.debug')
  })

  it('still removes the workspace and the boot hook', () => {
    expect(command).toContain('rm -rf /userdata/bespok3d')
    expect(command).toContain("sed -i '/S99bespok3d/d' /etc/init.d/S90lmd")
  })
})

const REACTIVATING_WINDOW = { webContents: { send: vi.fn() } } as unknown as BrowserWindow
const PRINTER_ON_THE_BENCH = { exec: vi.fn(async () => ''), getContent: vi.fn(async () => ''), putContent: vi.fn() } as unknown as SshSession

async function runOpStepsOn(printer: SshSession, buildSteps: (ssh: SshSession) => OpStep[]): Promise<void> {
  await buildSteps(printer).reduce((previous, step) => previous.then(() => step.run(vi.fn())), Promise.resolve())
}

function reactivateHandler(): (...args: unknown[]) => Promise<unknown> {
  registerPrinterOperationHandlers(() => REACTIVATING_WINDOW)
  const registered = vi.mocked(ipcMain.handle).mock.calls.find(([channel]) => channel === 'printer:reactivate')

  return registered?.[1] as (...args: unknown[]) => Promise<unknown>
}

describe('restarting the plugins', () => {
  it('answers which plugins the printer could not put back', async () => {
    const reapplied: BatchResult = {
      ok: false,
      results: [{ pluginId: 'example-camera', ok: false, skipped: false, reason: 'its service did not start', log: [], autoDeactivated: 'its service did not start', changedFiles: [] }],
    }
    vi.mocked(recoverPackages).mockResolvedValue(reapplied)
    vi.mocked(runSshOp).mockImplementation((_win, _printerId, _credentials, buildSteps) => runOpStepsOn(PRINTER_ON_THE_BENCH, buildSteps))

    const answer = await reactivateHandler()({}, 'printer-1', '192.0.2.10', 'root', 'example', 22)

    expect(answer).toEqual(reapplied)
  })
})
