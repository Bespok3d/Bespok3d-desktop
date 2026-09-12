// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { ipcMain, type BrowserWindow } from 'electron'
import { updatePrinter, removePrinter, resolveLiveAddress } from '../printers'
import type { PrinterRecord } from '../printers'
import type { AdapterLifecycle, EnrollStep } from '../adapter-loader'
import { runSshOp } from './op-runner'
import type { OpStep } from './op-runner'
import { adapterOpContext, adapterOpSteps, daemonOpContext, rebootOpContext } from './adapter-context'
import { waitForDaemon } from './daemon-log'
import { getManagedRecord } from '../daemon-client/status'
import { deactivateAll, teardownDaemon, recoverPackages } from '../daemon-client/client'
import { runRepair, runUpdateDaemon, runUpdateJinni } from './daemon-ops'
import { waitForThePrinterToComeBack } from './reboot-wait'

// Every op below is the same sandwich: what the DAEMON has to do (stop the plugins, tear them down,
// put them back) is the app's, and what has to change on the printer's own filesystem is the
// adapter's, read off its lifecycle. Nothing here knows what a printer's boot sequence looks like.
interface SshTarget { host: string; port: number; user: string; password: string }

// Deactivate and uninstall are that sandwich in the same order, so they are one named flow: the daemon
// does its half to the plugins, then the adapter does its half to the printer's own files. Each caller
// supplies only the daemon step it needs and which lifecycle list follows it.
async function runDaemonThenDevice(
  win: BrowserWindow,
  printerId: string,
  target: SshTarget,
  daemonStep: (record: PrinterRecord) => OpStep,
  deviceSteps: (lifecycle: AdapterLifecycle) => EnrollStep[],
): Promise<void> {
  const record = getManagedRecord(printerId)
  const { adapter, ctx } = adapterOpContext(record, target.host, { user: target.user, password: target.password, port: target.port })

  await runSshOp(win, printerId, target, (ssh) => [
    daemonStep(record),
    ...adapterOpSteps(deviceSteps(adapter.lifecycle), ssh, ctx),
  ])
}

async function runDeactivate(win: BrowserWindow, printerId: string, ip: string, user: string, password: string, port: number): Promise<void> {
  await runDaemonThenDevice(
    win, printerId, { host: ip, port, user, password },
    (record) => ({
      id: 'stop-plugins',
      label: 'Stopping plugin services',
      detail: 'Daemon stops all plugin services and removes autostart links',
      run: async () => { await deactivateAll(record) },
    }),
    (lifecycle) => lifecycle.deactivate,
  )
  updatePrinter(printerId, { deactivated: true, status: 'deactivated', deactivatedAt: new Date().toISOString() })
}

async function runReactivate(win: BrowserWindow, printerId: string, ip: string, user: string, password: string, port: number): Promise<void> {
  const { record, adapter, ctx } = daemonOpContext(printerId, ip, { user, password, port })
  await runSshOp(win, printerId, { host: ip, port, user, password }, (ssh) => [
    ...adapterOpSteps(adapter.lifecycle.reactivate, ssh, ctx),
    {
      id: 'verify-daemon',
      label: 'Verifying the daemon',
      detail: 'Waits for the daemon to accept connections on port 4269',
      run: () => waitForDaemon(ip, () => adapter.readDaemonLog(ssh)),
    },
    {
      id: 're-apply-plugins',
      label: 'Re-applying plugins',
      detail: 'Rebuilds plugin links and dependencies, then restarts services once',
      run: async () => { await recoverPackages(record) },
    },
  ])
  updatePrinter(printerId, { deactivated: false, status: 'managed', deactivatedAt: undefined })
}

async function runUninstall(win: BrowserWindow, printerId: string, ip: string, user: string, password: string, port: number): Promise<void> {
  await runDaemonThenDevice(
    win, printerId, { host: ip, port, user, password },
    (record) => ({
      id: 'teardown-daemon',
      label: 'Uninstalling plugins',
      detail: 'Daemon uninstalls all plugins and reverts applied patches',
      run: async () => { await teardownDaemon(record) },
    }),
    (lifecycle) => lifecycle.remove,
  )
  removePrinter(printerId)
}

// Some states clear only on a power cycle, and stopping, restarting or removing bespok3d leaves the
// printer running something other than what is now on disk. The adapter asks for the power cycle (it
// knows how this printer is told to go down, and that the connection dying IS the reboot happening);
// the wait is the app's, so the screen never says the printer is back while it is still down.
async function runReboot(win: BrowserWindow, printerId: string, ip: string, user: string, password: string, port: number, adapterId = ''): Promise<void> {
  const { adapter, ctx } = rebootOpContext(printerId, adapterId, ip, { user, password, port })
  await runSshOp(win, printerId, { host: ip, port, user, password }, (ssh) => [
    ...adapterOpSteps(adapter.lifecycle.reboot, ssh, ctx),
    {
      id: 'wait-for-reconnect',
      label: 'Waiting for your printer',
      detail: 'Waits for the printer to come back and rejoin the network',
      run: () => waitForThePrinterToComeBack(ip),
    },
  ])
}

// The address an SSH op should connect to: the one the printer answers on right now, found by probing
// its recorded IP plus every fresh discovery sighting. A printer whose DHCP lease moved (or is
// flip-flopping between two leases) is followed to its live address instead of the renderer's possibly
// stale IP, so an op never connects to the old lease; the click-time IP is the fallback.
async function opAddress(printerId: string, hintIp: string): Promise<string> {
  return (await resolveLiveAddress(printerId)) || hintIp
}

export function registerPrinterOperationHandlers(getMainWindow: () => BrowserWindow): void {
  ipcMain.handle('printer:update-daemon', async (_ev, printerId: string, ip: string, user: string, password: string, port: number) =>
    runUpdateDaemon(getMainWindow(), printerId, await opAddress(printerId, ip), user, password, port)
  )
  ipcMain.handle('printer:update-jinni', async (_ev, printerId: string, ip: string, user: string, password: string, port: number) =>
    runUpdateJinni(getMainWindow(), printerId, await opAddress(printerId, ip), user, password, port)
  )
  ipcMain.handle('printer:deactivate', async (_ev, printerId: string, ip: string, user: string, password: string, port: number) =>
    runDeactivate(getMainWindow(), printerId, await opAddress(printerId, ip), user, password, port)
  )
  ipcMain.handle('printer:reactivate', async (_ev, printerId: string, ip: string, user: string, password: string, port: number) =>
    runReactivate(getMainWindow(), printerId, await opAddress(printerId, ip), user, password, port)
  )
  ipcMain.handle('printer:uninstall', async (_ev, printerId: string, ip: string, user: string, password: string, port: number) =>
    runUninstall(getMainWindow(), printerId, await opAddress(printerId, ip), user, password, port)
  )
  ipcMain.handle('printer:reboot', async (_ev, printerId: string, ip: string, user: string, password: string, port: number, adapterId?: string) =>
    runReboot(getMainWindow(), printerId, await opAddress(printerId, ip), user, password, port, adapterId)
  )
  ipcMain.handle('printer:repair', async (_ev, printerId: string, ip: string, user: string, password: string, port: number, forced?: boolean) =>
    runRepair(getMainWindow(), printerId, await opAddress(printerId, ip), user, password, port, forced)
  )
}
