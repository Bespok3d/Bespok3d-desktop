// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { BrowserWindow } from 'electron'
import { updatePrinter, loadPrinters } from '../printers'
import type { PrinterRecord } from '../printers'
import { holdsDaemonAccess } from '../printers/record'
import { DAEMON_PORT } from '../printers/ports'
import { getAdapter } from '../adapter-loader'
import type { AdapterDefinition, EnrollContext, EnrollStep, SshCredentials } from '../adapter-loader'
import { findAdapterStep } from '../adapter-loader/adapter-step'
import { bespok3dRootOn } from '../adapter-loader/bespok3d-root'
import { BOOT_SCRIPT_DEPLOY_STEP_ID, DAEMON_DEPLOY_STEP_ID, DAEMON_START_STEP_ID, JINNI_DEPLOY_STEP_ID } from '../adapter-loader/step-ids'
import { connect, shellQuote } from '../ssh'
import type { SshSession } from '../ssh'
import { runSshOp } from './op-runner'
import type { OpStep } from './op-runner'
import { waitForDaemon, tailDaemonLog } from './daemon-log'
import { recordOrThrow, verifyDaemonVersion } from '../daemon-client/status'
import { wireSetupAfterDaemonMove } from '../daemon-client/client'
import { expectedDaemonVersion } from '../daemon-client/expected-version'
import { offeredJinniBuild } from '../compat/jinni-baseline'
import { assertNotADaemonDowngrade, assertPairLandedTogether, assertPrinterNotPrinting, keepingNewerInstalledDaemon, reportedDaemonVersion } from '../compat'

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

function requiredAdapterStep(adapter: AdapterDefinition, stepId: string): EnrollStep {
  const step = findAdapterStep(adapter, stepId)
  if (!step) throw new Error(`adapter ${adapter.id} has no step ${stepId}`)

  return step
}

function runAdapterStep(adapter: AdapterDefinition, stepId: string, ssh: SshSession, ctx: EnrollContext): Promise<void> {
  return requiredAdapterStep(adapter, stepId).run(ssh, ctx)
}

// A repair usually runs while the daemon is down, so the running daemon cannot say whether this app's
// daemon is older; the files on the printer can. Forced, the owner has asked for this app's daemon.
function redeployDaemon(adapter: AdapterDefinition, forced: boolean, ssh: SshSession, ctx: EnrollContext): Promise<void> {
  const deployStep = requiredAdapterStep(adapter, DAEMON_DEPLOY_STEP_ID)
  const repairDeploy = forced ? deployStep : keepingNewerInstalledDaemon(deployStep, adapter)

  return repairDeploy.run(ssh, { ...ctx, sendChangedFilesOnly: true })
}

// The boot script comes with the daemon, so a daemon that changed it brings the change only once the
// script is copied out again. Without this, a fixed boot script never reached a printer by update or repair.
function bootScriptStep(adapter: AdapterDefinition, ssh: SshSession, ctx: EnrollContext): OpStep {
  return {
    id: 'refresh-boot-script',
    label: 'Updating the startup script',
    detail: 'Puts back the printer\'s bespok3d startup script from the daemon now in place, so a changed one reaches the printer',
    run: () => findAdapterStep(adapter, BOOT_SCRIPT_DEPLOY_STEP_ID)?.run(ssh, ctx) ?? Promise.resolve(),
  }
}

function diagnoseDaemon(adapter: AdapterDefinition, ssh: SshSession): Promise<string> {
  const quotedBespok3dRoot = shellQuote(bespok3dRootOn(adapter))

  return ssh.exec(
    `out=""; ` +
    `[ -d ${quotedBespok3dRoot}/var/lib/demon ] && out="$out stale-demon-dir"; ` +
    `[ -f ${quotedBespok3dRoot}/var/lib/daemon/daemon.py ] || out="$out missing-daemon.py"; ` +
    `grep -q 'var/lib/demon' ${quotedBespok3dRoot}/etc/init.d/autostart/s10bespok3d-daemon 2>/dev/null && out="$out wrong-autostart-path"; ` +
    `netstat -ltnp 2>/dev/null | grep -q ':${DAEMON_PORT} ' && out="$out port-${DAEMON_PORT}-occupied"; ` +
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
  if (!record || !holdsDaemonAccess(record) || record.customSshCredentials) return null
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

// A repair can keep a newer daemon than this app ships, so the record takes the version that answered.
async function runningDaemonVersion(record: PrinterRecord): Promise<string> {
  return (await reportedDaemonVersion(record)) ?? expectedDaemonVersion()
}

async function saveFittingPair(record: PrinterRecord, saveTheMove: () => void | Promise<void>): Promise<void> {
  await assertPairLandedTogether(record)
  await saveTheMove()
}

// The pair that landed is read back and saved before anything runs through it, so a failed wiring
// never loses a move that landed. A new daemon or jinni can check settings files the old one never
// wired, so the printer flagged itself as not set up right until someone pressed "Put it back": the
// move wires them itself, as a step the screen shows like any other.
function landedPairSteps(record: PrinterRecord, saveTheMove: () => void | Promise<void>): OpStep[] {
  return [
    { id: 'save-pair', label: 'Saving the daemon and jinni that landed', detail: 'Reads back the daemon and jinni that landed, refuses a pair that does not fit, and saves the pair that does', run: () => saveFittingPair(record, saveTheMove) },
    { id: 'wire-setup', label: 'Putting the printer setup back', detail: 'Puts the printer setup back the way the new daemon or jinni checks it, so the printer does not flag itself as not set up', run: () => wireSetupAfterDaemonMove(record) },
  ]
}

async function saveRepair(printerId: string, record: PrinterRecord): Promise<void> {
  updatePrinter(printerId, { status: 'managed', daemonVersion: await runningDaemonVersion(record), daemonUpdateAvailable: false })
}

// The jinni build the app just installed, with its fingerprint: the jinni-update banner must not flash
// between this save and the next capabilities ping. An unknown fingerprint drops the old copy's, which
// would otherwise mark the jinni just installed as a rebuild still to come.
function landedJinni(current: PrinterRecord, adapter: AdapterDefinition): Partial<PrinterRecord> {
  const landed = offeredJinniBuild(adapter)
  const otherFingerprints = Object.fromEntries(Object.entries(current.machineryFingerprints ?? {}).filter(([packageName]) => packageName !== adapter.jinniPackage))
  const machineryFingerprints = landed?.fingerprint ? { ...otherFingerprints, [adapter.jinniPackage]: landed.fingerprint } : otherFingerprints

  return { jinniVersion: landed?.version ?? adapter.jinniVersion, machineryFingerprints }
}

// deploy-daemon redeploys the jinni too, so both are recorded as the builds the app just installed.
function saveDaemonUpdate(printerId: string, adapter: AdapterDefinition): void {
  updatePrinter(printerId, (current) => ({ status: 'managed', daemonVersion: expectedDaemonVersion(), daemonUpdateAvailable: false, daemonUpdatedAt: new Date().toISOString(), ...landedJinni(current, adapter) }))
}

function saveJinniUpdate(printerId: string, adapter: AdapterDefinition): void {
  updatePrinter(printerId, (current) => ({ status: 'managed', ...landedJinni(current, adapter) }))
}

export async function runRepair(win: BrowserWindow, printerId: string, ip: string, user: string, password: string, port: number, forced = false): Promise<void> {
  const { record, adapter, ctx } = daemonOpContext(printerId, ip, { user, password, port })
  await assertSafeToMoveDaemon(record, forced)
  await runSshOp(win, printerId, { host: ip, port, user, password }, (ssh) => [
    { id: 'check-write-layer', label: 'Checking the write layer', detail: 'A firmware update resets the printer overlay; when that happens a daemon repair would not survive a reboot, so the printer needs full recovery instead', run: async () => { await guardWriteLayer(adapter, ssh) } },
    { id: 'diagnose', label: 'Diagnosing the daemon', detail: 'Checks for a stale demon directory, a wrong autostart path, a missing daemon, or an occupied port', run: async (progress) => { progress((await diagnoseDaemon(adapter, ssh)).trim()) } },
    { id: 'redeploy-daemon', label: 'Re-deploying a fresh daemon', detail: 'Uploads fresh daemon source and removes the stale demon directory', run: (progress) => redeployDaemon(adapter, forced, ssh, { ...ctx, onProgress: progress }) },
    bootScriptStep(adapter, ssh, ctx),
    { id: 'start-daemon', label: 'Starting the daemon', detail: 'Deploys the corrected autostart script, frees port 4269, and starts the daemon', run: () => runAdapterStep(adapter, DAEMON_START_STEP_ID, ssh, ctx) },
    { id: 'verify-daemon', label: 'Verifying the daemon', detail: 'Waits for the daemon and confirms it restarted on the expected version', run: async () => { await waitForDaemon(ip, () => tailDaemonLog(ssh)); await verifyDaemonVersion(record) } },
    ...landedPairSteps(record, () => saveRepair(printerId, record)),
  ])
}

export async function runUpdateDaemon(win: BrowserWindow, printerId: string, ip: string, user: string, password: string, port: number): Promise<void> {
  const { record, adapter, ctx } = daemonOpContext(printerId, ip, { user, password, port })
  // Update is not a Force flow: it exists to move a printer forward, so it keeps the version question.
  await assertSafeToMoveDaemon(record, false)
  await runSshOp(win, printerId, { host: ip, port, user, password }, (ssh) => [
    { id: 'deploy-daemon', label: 'Uploading fresh daemon code', detail: 'Uploads the latest daemon source and adapter jinni; the cert and plugins are left untouched', run: (progress) => runAdapterStep(adapter, DAEMON_DEPLOY_STEP_ID, ssh, { ...ctx, onProgress: progress, sendChangedFilesOnly: true }) },
    bootScriptStep(adapter, ssh, ctx),
    { id: 'start-daemon', label: 'Restarting the daemon', detail: 'Deploys the autostart script, frees port 4269, and restarts the daemon', run: () => runAdapterStep(adapter, DAEMON_START_STEP_ID, ssh, ctx) },
    { id: 'verify-daemon', label: 'Verifying the daemon', detail: 'Waits for the daemon and confirms it restarted on the expected version', run: async () => { await waitForDaemon(ip, () => tailDaemonLog(ssh)); await verifyDaemonVersion(record) } },
    ...landedPairSteps(record, () => saveDaemonUpdate(printerId, adapter)),
  ])
}

export async function runUpdateJinni(win: BrowserWindow, printerId: string, ip: string, user: string, password: string, port: number): Promise<void> {
  const { record, adapter, ctx } = daemonOpContext(printerId, ip, { user, password, port })
  // A jinni move restarts the daemon too, so it waits for the print; it deploys no daemon, so there
  // is no daemon version to be put backwards here.
  assertPrinterNotPrinting(printerId)
  await runSshOp(win, printerId, { host: ip, port, user, password }, (ssh) => [
    { id: 'deploy-jinni', label: 'Updating the adapter jinni', detail: 'Re-uploads only the device-side adapter; the daemon source, cert, and plugins are left untouched', run: (progress) => runAdapterStep(adapter, JINNI_DEPLOY_STEP_ID, ssh, { ...ctx, onProgress: progress, sendChangedFilesOnly: true }) },
    { id: 'start-daemon', label: 'Restarting the daemon', detail: 'Restarts the daemon so it loads the updated jinni', run: () => runAdapterStep(adapter, DAEMON_START_STEP_ID, ssh, ctx) },
    { id: 'verify-daemon', label: 'Verifying the daemon', detail: 'Waits for the daemon to accept connections on port 4269', run: () => waitForDaemon(ip, () => tailDaemonLog(ssh)) },
    ...landedPairSteps(record, () => saveJinniUpdate(printerId, adapter)),
  ])
}
