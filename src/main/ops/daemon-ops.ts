// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { BrowserWindow } from 'electron'
import { updatePrinter, loadPrinters } from '../printers'
import type { PrinterRecord } from '../printers'
import { getAdapter } from '../adapter-loader'
import type { AdapterDefinition, EnrollContext, SshCredentials } from '../adapter-loader'
import { connect } from '../ssh'
import type { SshSession } from '../ssh'
import { runSshOp } from './op-runner'
import { waitForDaemon, tailDaemonLog } from './daemon-log'
import { recordOrThrow, verifyDaemonVersion } from '../daemon-client/status'
import { expectedDaemonVersion } from '../daemon-client/expected-version'
import { offeredJinniVersion } from '../compat/jinni-baseline'
import { assertNotADaemonDowngrade, assertPairLandedTogether, assertPrinterNotPrinting } from '../compat'

// Asked before a single byte moves, so a refused op never touches the printer at all: it is not
// printing, and this app is not about to put it back onto an older daemon than it is running.
//
// Forcing waives the version question and nothing else. A running print is still a refusal however the
// op was launched: the print is the user's, and no menu of ours is worth ruining it.
async function assertSafeToMoveDaemon(record: PrinterRecord, forced: boolean): Promise<void> {
  assertPrinterNotPrinting(record.id)
  await assertNotADaemonDowngrade(record, forced)
}

function repairContext(record: PrinterRecord, ip: string, credentials: SshCredentials, runtimeUser: string): EnrollContext {
  return {
    printerId: record.id,
    ip,
    credentials,
    runtimeUser,
    daemonToken: record.daemonToken,
    daemonCert: record.daemonCert,
  }
}

// The record + adapter + enroll context the three daemon-maintenance ops all open with; throws the
// same way each did inline so a missing record or adapter still fails loudly before any SSH work.
function daemonOpContext(printerId: string, ip: string, credentials: SshCredentials) {
  const record = recordOrThrow(printerId)
  const adapter = getAdapter(record.adapter)
  if (!adapter) throw new Error('adapter not found')
  const ctx = repairContext(record, ip, credentials, adapter.defaults.runtimeUser)

  return { record, adapter, ctx }
}

function runAdapterStep(adapter: AdapterDefinition, stepId: string, ssh: SshSession, ctx: EnrollContext): Promise<void> {
  const step = [...adapter.enrollSteps, ...(adapter.opSteps ?? [])].find((candidate) => candidate.id === stepId)
  if (!step) throw new Error(`adapter ${adapter.id} has no step ${stepId}`)

  return step.run(ssh, ctx)
}

function diagnoseDaemon(ssh: SshSession): Promise<string> {
  return ssh.exec(
    `out=""; ` +
    `[ -d /userdata/bespok3d/var/lib/demon ] && out="$out stale-demon-dir"; ` +
    `[ -f /userdata/bespok3d/var/lib/daemon/daemon.py ] || out="$out missing-daemon.py"; ` +
    `grep -q 'var/lib/demon' /userdata/bespok3d/etc/init.d/autostart/s10bespok3d-daemon 2>/dev/null && out="$out wrong-autostart-path"; ` +
    `netstat -ltnp 2>/dev/null | grep -q ':4269 ' && out="$out port-4269-occupied"; ` +
    `[ -z "$out" ] && out=" no-issues-detected"; ` +
    `echo "Diagnosis:$out"`
  )
}

// A repair only redeploys the daemon; it does NOT unlock the overlay or reboot (those are enroll-only
// steps). So on a printer whose write layer was reset by a firmware OTA, a repair would report success
// while nothing persists past the next reboot. The adapter's verifyEnrolled is false in exactly that
// state, so refuse with a clear reason; the repair progress UI then surfaces the existing "Run full
// recovery" escalation, which is the operation this printer actually needs.
async function guardWriteLayer(adapter: AdapterDefinition, ssh: SshSession): Promise<void> {
  if (!(await adapter.verifyEnrolled(ssh))) {
    throw new Error('This printer\'s write layer was reset, which happens after a firmware update, so a daemon repair will not stick. Run full recovery to rebuild it.')
  }
}

// One-shot repair-vs-recover probe, run by the renderer at most once per recoverable episode (the
// .debug check never rides the status-ping ladder). Uses the adapter's default SSH credentials, so a
// printer that needs custom credentials returns null and defers to the op-time write-layer backstop.
// Any failure returns null too, degrading to the Repair banner. true = intact (Repair), false = the
// overlay was reset by a firmware OTA (full Recover).
export async function checkWriteLayer(printerId: string): Promise<boolean | null> {
  const record = loadPrinters().find((rec) => rec.id === printerId)
  if (!record || !record.enrollmentLog || record.customSshCredentials) return null
  const adapter = getAdapter(record.adapter)
  if (!adapter) return null
  const { sshUser, sshPasswordHint, sshPort } = adapter.defaults
  try {
    const ssh = await connect({ host: record.ip, port: sshPort, user: sshUser, password: sshPasswordHint })
    try {
      // Answered to the caller, never written to the printer record: a printer can be reflashed while
      // the app is closed, and a saved "the write layer is fine" was then read back at the next start
      // as if it had just been measured, so Repair went on being offered on a printer only full
      // recovery can rebuild. Every app start asks the printer again.
      return await adapter.verifyEnrolled(ssh)
    } finally {
      ssh.close()
    }
  } catch {
    return null
  }
}

export async function runRepair(win: BrowserWindow, printerId: string, ip: string, user: string, password: string, port: number, forced = false): Promise<void> {
  const { record, adapter, ctx } = daemonOpContext(printerId, ip, { user, password, port })
  await assertSafeToMoveDaemon(record, forced)
  await runSshOp(win, printerId, { host: ip, port, user, password }, (ssh) => [
    { id: 'check-write-layer', label: 'Checking the write layer', detail: 'A firmware update resets the printer overlay; when that happens a daemon repair would not survive a reboot, so the printer needs full recovery instead', run: async () => { await guardWriteLayer(adapter, ssh) } },
    { id: 'diagnose', label: 'Diagnosing the daemon', detail: 'Checks for a stale demon directory, a wrong autostart path, a missing daemon, or an occupied port', run: async (progress) => { progress((await diagnoseDaemon(ssh)).trim()) } },
    { id: 'redeploy-daemon', label: 'Re-deploying a fresh daemon', detail: 'Uploads fresh daemon source and removes the stale demon directory', run: (progress) => runAdapterStep(adapter, 'deploy-daemon', ssh, { ...ctx, onProgress: progress }) },
    { id: 'start-daemon', label: 'Starting the daemon', detail: 'Deploys the corrected autostart script, frees port 4269, and starts the daemon', run: () => runAdapterStep(adapter, 'start-daemon', ssh, ctx) },
    { id: 'verify-daemon', label: 'Verifying the daemon', detail: 'Waits for the daemon and confirms it restarted on the expected version', run: async () => { await waitForDaemon(ip, () => tailDaemonLog(ssh)); await verifyDaemonVersion(record) } },
  ])
  await assertPairLandedTogether(record)
  updatePrinter(printerId, { status: 'managed', daemonVersion: expectedDaemonVersion(), daemonUpdateAvailable: false })
}

export async function runUpdateDaemon(win: BrowserWindow, printerId: string, ip: string, user: string, password: string, port: number): Promise<void> {
  const { record, adapter, ctx } = daemonOpContext(printerId, ip, { user, password, port })
  // Update is not a Force flow: it exists to move a printer forward, so it keeps the version question.
  await assertSafeToMoveDaemon(record, false)
  await runSshOp(win, printerId, { host: ip, port, user, password }, (ssh) => [
    { id: 'deploy-daemon', label: 'Uploading fresh daemon code', detail: 'Uploads the latest daemon source and adapter jinni; the cert and plugins are left untouched', run: (progress) => runAdapterStep(adapter, 'deploy-daemon', ssh, { ...ctx, onProgress: progress }) },
    { id: 'start-daemon', label: 'Restarting the daemon', detail: 'Deploys the autostart script, frees port 4269, and restarts the daemon', run: () => runAdapterStep(adapter, 'start-daemon', ssh, ctx) },
    { id: 'verify-daemon', label: 'Verifying the daemon', detail: 'Waits for the daemon and confirms it restarted on the expected version', run: async () => { await waitForDaemon(ip, () => tailDaemonLog(ssh)); await verifyDaemonVersion(record) } },
  ])
  await assertPairLandedTogether(record)
  // deploy-daemon redeploys the jinni too, so record both at the version the app just installed: the
  // jinni-update banner must not flash between this save and the next capabilities ping.
  updatePrinter(printerId, { status: 'managed', daemonVersion: expectedDaemonVersion(), daemonUpdateAvailable: false, daemonUpdatedAt: new Date().toISOString(), jinniVersion: offeredJinniVersion(adapter) ?? adapter.jinniVersion })
}

export async function runUpdateJinni(win: BrowserWindow, printerId: string, ip: string, user: string, password: string, port: number): Promise<void> {
  const { record, adapter, ctx } = daemonOpContext(printerId, ip, { user, password, port })
  // A jinni move restarts the daemon too, so it waits for the print; it deploys no daemon, so there
  // is no daemon version to be put backwards here.
  assertPrinterNotPrinting(printerId)
  await runSshOp(win, printerId, { host: ip, port, user, password }, (ssh) => [
    { id: 'deploy-jinni', label: 'Updating the adapter jinni', detail: 'Re-uploads only the device-side adapter; the daemon source, cert, and plugins are left untouched', run: (progress) => runAdapterStep(adapter, 'deploy-jinni', ssh, { ...ctx, onProgress: progress }) },
    { id: 'start-daemon', label: 'Restarting the daemon', detail: 'Restarts the daemon so it loads the updated jinni', run: () => runAdapterStep(adapter, 'start-daemon', ssh, ctx) },
    { id: 'verify-daemon', label: 'Verifying the daemon', detail: 'Waits for the daemon to accept connections on port 4269', run: () => waitForDaemon(ip, () => tailDaemonLog(ssh)) },
  ])
  await assertPairLandedTogether(record)
  updatePrinter(printerId, { status: 'managed', jinniVersion: offeredJinniVersion(adapter) ?? adapter.jinniVersion })
}
