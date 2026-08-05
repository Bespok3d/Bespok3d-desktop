// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { ipcMain, type BrowserWindow } from 'electron'
import { updatePrinter, removePrinter, resolveLiveAddress } from '../printers'
import { getAdapter } from '../adapter-loader'
import {
  bespok3dIncludeCommand,
  KLIPPER_INCLUDE,
  MOONRAKER_INCLUDE,
  patchS90lmd,
} from '@adapters/snapmaker-u1/client/snapmaker-u1'
import type { SshSession } from '../ssh'
import { runSshOp } from './op-runner'
import { waitForDaemon, tailDaemonLog } from './daemon-log'
import { getManagedRecord, recordOrThrow } from '../daemon-client/status'
import { deactivateAll, teardownDaemon, recoverPackages } from '../daemon-client/client'
import { runRepair, runUpdateDaemon, runUpdateJinni } from './daemon-ops'
import { waitForThePrinterToComeBack } from './reboot-wait'

async function runDeactivate(win: BrowserWindow, printerId: string, ip: string, user: string, password: string, port: number): Promise<void> {
  const record = getManagedRecord(printerId)
  await runSshOp(win, printerId, { host: ip, port, user, password }, (ssh) => [
    {
      id: 'stop-plugins',
      label: 'Stopping plugin services',
      detail: 'Daemon stops all plugin services and removes autostart links',
      run: async () => { await deactivateAll(record) },
    },
    {
      id: 'remove-boot-hook',
      label: 'Removing boot hook',
      detail: 'Removes the S99bespok3d call from the firmware boot script',
      run: async () => { await ssh.exec("sed -i '/S99bespok3d/d' /etc/init.d/S90lmd") },
    },
  ])
  updatePrinter(printerId, { deactivated: true, status: 'deactivated', deactivatedAt: new Date().toISOString() })
}

async function reactivateRestoreIncludes(ssh: SshSession, printerData: string): Promise<void> {
  await ssh.exec(bespok3dIncludeCommand(`${printerData}/config/printer.cfg`, KLIPPER_INCLUDE))
  await ssh.exec(bespok3dIncludeCommand(`${printerData}/config/moonraker.conf`, MOONRAKER_INCLUDE))
}

async function reactivateBootHook(ssh: SshSession): Promise<void> {
  const s90lmdContent = await ssh.getContent('/etc/init.d/S90lmd')
  const patched = patchS90lmd(s90lmdContent)
  if (patched !== s90lmdContent) await ssh.putContent('/etc/init.d/S90lmd', patched)
}

async function runReactivate(win: BrowserWindow, printerId: string, ip: string, user: string, password: string, port: number): Promise<void> {
  const record = recordOrThrow(printerId)
  const adapter = getAdapter(record.adapter)
  const bespok3d = adapter?.envVars.find((envVar) => envVar.name === 'BESPOK3D')?.value ?? '/userdata/bespok3d'
  const printerData = adapter?.envVars.find((envVar) => envVar.name === 'PRINTER_DATA')?.value ?? '/oem/printer_data'
  await runSshOp(win, printerId, { host: ip, port, user, password }, (ssh) => [
    { id: 'remove-marker', label: 'Removing deactivated marker', detail: 'Clears the deactivated flag from the printer workspace', run: async () => { await ssh.exec(`rm -f ${bespok3d}/etc/deactivated`) } },
    { id: 'restore-includes', label: 'Restoring plugin includes', detail: 'Re-adds Klipper and Moonraker include lines above the SAVE_CONFIG boundary', run: () => reactivateRestoreIncludes(ssh, printerData) },
    { id: 'restore-boot-hook', label: 'Restoring boot hook', detail: 'Re-patches S90lmd to invoke S99bespok3d at boot', run: () => reactivateBootHook(ssh) },
    { id: 'start-daemon', label: 'Starting the daemon', detail: 'Starts the bespok3d daemon process', run: async () => { await ssh.exec(`${bespok3d}/etc/init.d/autostart/s10bespok3d-daemon start`) } },
    { id: 'verify-daemon', label: 'Verifying the daemon', detail: 'Waits for the daemon to accept connections on port 4269', run: () => waitForDaemon(ip, () => tailDaemonLog(ssh, `${bespok3d}/var/log/daemon.log`)) },
    { id: 're-apply-plugins', label: 'Re-applying plugins', detail: 'Rebuilds plugin links and dependencies, then restarts services once', run: async () => { await recoverPackages(record) } },
  ])
  updatePrinter(printerId, { deactivated: false, status: 'managed', deactivatedAt: undefined })
}

// The SSH-side reversal of enrollment for a clean removal. Kept as one named, testable string because a
// regression here strands the printer: the dhcpcd state dir must be RECREATED (a dangling symlink leaves
// it with no lease and no network on the next boot), and /oem/.debug must be REMOVED (re-locking the
// overlay so the next boot resets the write layer to stock). Mirrors reset-to-stock.invitro.ts.
export function bespok3dRemovalCommand(): string {
  return (
    `sed -i '/S99bespok3d/d' /etc/init.d/S90lmd` +
    ` && sed -i '/bespok3d\\/etc\\/nginx\\/locations/d' /etc/nginx/sites-enabled/fluidd` +
    ` && rm -f /etc/init.d/S99bespok3d` +
    ` && rm -f /etc/udev/rules.d/70-wlan0-mac.rules` +
    ` ; rm -f /var/db/dhcpcd ; mkdir -p /var/db/dhcpcd` +
    ` ; rm -rf /userdata/bespok3d` +
    ` ; rm -f /oem/.debug`
  )
}

async function runUninstall(win: BrowserWindow, printerId: string, ip: string, user: string, password: string, port: number): Promise<void> {
  const record = getManagedRecord(printerId)
  await runSshOp(win, printerId, { host: ip, port, user, password }, (ssh) => [
    {
      id: 'teardown-daemon',
      label: 'Uninstalling plugins',
      detail: 'Daemon uninstalls all plugins and reverts applied patches',
      run: async () => { await teardownDaemon(record) },
    },
    {
      id: 'remove-files',
      label: 'Removing bespok3d from the printer',
      detail: 'Removes all bespok3d files and system configuration changes',
      run: async () => { await ssh.exec(bespok3dRemovalCommand()) },
    },
  ])
  removePrinter(printerId)
}

// The printer drops the link the moment it starts going down, so the exec never returns cleanly:
// that dropped connection IS the reboot happening, not a failure to report to the user.
async function askForThePowerCycle(ssh: SshSession): Promise<void> {
  try {
    await ssh.exec('reboot')
  } catch {
    /* the connection dies as the printer goes down; expected */
  }
}

// Some states clear only on a power cycle, and stopping, restarting or removing bespok3d leaves the
// printer running something other than what is now on disk. The step only reports done once the printer
// is answering again, so the screen never says it is back while it is still down.
async function runReboot(win: BrowserWindow, printerId: string, ip: string, user: string, password: string, port: number): Promise<void> {
  await runSshOp(win, printerId, { host: ip, port, user, password }, (ssh) => [
    {
      id: 'reboot-and-reconnect',
      label: 'Rebooting your printer',
      detail: 'Asks the printer to power cycle, then waits for it to come back and rejoin the network',
      run: async () => {
        await askForThePowerCycle(ssh)
        await waitForThePrinterToComeBack(ip)
      },
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
  ipcMain.handle('printer:reboot', async (_ev, printerId: string, ip: string, user: string, password: string, port: number) =>
    runReboot(getMainWindow(), printerId, await opAddress(printerId, ip), user, password, port)
  )
  ipcMain.handle('printer:repair', async (_ev, printerId: string, ip: string, user: string, password: string, port: number) =>
    runRepair(getMainWindow(), printerId, await opAddress(printerId, ip), user, password, port)
  )
}
