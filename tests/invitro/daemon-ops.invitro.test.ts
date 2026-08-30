// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { BrowserWindow } from 'electron'
import '@adapters/snapmaker-u1/client/snapmaker-u1'
import { runUpdateDaemon, runRepair } from '../../src/main/ops/daemon-ops'
import { savePrinter, loadPrinters, updatePrinter } from '../../src/main/printers'
import type { PrinterRecord } from '../../src/main/printers'
import type { EnrollProgressEvent } from '../../src/main/enrollment'
import { fetchCapabilities, fetchDaemonStatus, installPlugin, uninstallPlugin } from '../../src/main/daemon-client/client'
import { expectedDaemonVersion } from '../../src/main/daemon-client/expected-version'
import { DaemonHttpError } from '../../src/main/daemon-client/transport'
import { daemonNeedsUpdate } from '../../src/main/daemon-client/status'
import { makeDeviceTarget, DEVICE_AUTOSTART, DEVICE_VENV_PYTHON } from './device-target'
import type { DeviceTarget } from './device-target'
import { FIXTURE_PLUGIN_ID, FIXTURE_PACKAGE_BUNDLED, fixturePluginVars, untamperedPackage, packageWithTamperedPayload } from './tampered-package'

// The daemon maintenance the app performs on an already-enrolled printer, driven end to end against a
// live daemon: update, repair, and the repair refusal after a firmware OTA resets the write layer.
// These call the SAME functions the IPC handlers call, so the app's real path is what is under test,
// never a fixture deploy: prepare() plants an OLD daemon, and the only thing that can put
// expectedDaemonVersion() on the device afterwards is the app doing its job.
// Run: npx vitest run --config vitest.invitro.config.ts daemon-ops
const PORT = 2237
const PRINTER_ID = 'invitro-daemon-ops'
// Older than the bundled daemon, so the update the app is asked for has real work to do.
const OLD_VERSION = '0.12.17-dev'
// deploy-daemon uploads every daemon source file over one SSH session, so an op takes minutes.
const OP_TIMEOUT_MS = 300000

const harness = { target: null as DeviceTarget | null }

function target(): DeviceTarget {
  return harness.target!
}

function record(): PrinterRecord {
  return target().daemonRecord()
}

// The house fake window (src/main/ops/op-runner.test.ts): the ops report progress ONLY by sending on
// the window, so the recorded events are how a test sees which steps ran and which one failed.
function fakeWindow() {
  const send = vi.fn()

  return { win: { webContents: { send } } as unknown as BrowserWindow, send }
}

function opEvents(send: ReturnType<typeof vi.fn>): EnrollProgressEvent[] {
  return send.mock.calls.map((call) => call[1] as EnrollProgressEvent)
}

function doneStepIds(send: ReturnType<typeof vi.fn>): string[] {
  return opEvents(send).filter((event) => event.status === 'done').map((event) => event.stepId)
}

function reportedHints(send: ReturnType<typeof vi.fn>): string[] {
  return opEvents(send).map((event) => event.hint).filter((hint): hint is string => Boolean(hint))
}

function storedRecord(): PrinterRecord {
  return loadPrinters().find((saved) => saved.id === PRINTER_ID)!
}

// Seed the printer the ops resolve with recordOrThrow, through the app's REAL store, so each op reads
// its record exactly as it does in production. Recorded managed on the OLD version: the state a user
// is in when the app offers them the daemon update.
function seedManagedPrinter(): void {
  const device = record()
  savePrinter({
    id: PRINTER_ID, nick: 'in-vitro daemon ops', model: 'Snapmaker U1', adapter: 'snapmaker-u1',
    host: device.ip, ip: device.ip, status: 'managed', installedIds: [],
    daemonCert: device.daemonCert, daemonToken: device.daemonToken,
    daemonVersion: OLD_VERSION, daemonUpdateAvailable: true,
  })
}

// Both maintenance ops open their OWN SSH session, so what a test hands them is the device's real
// credentials. Taking them off the target is what keeps the suite device-agnostic: Docker's published
// port here, the bot's port 22 when the suite is pointed at hardware.
type DaemonMaintenanceOp = (
  win: BrowserWindow, printerId: string, ip: string, user: string, password: string, port: number,
) => Promise<void>

function runDaemonOp(maintenance: DaemonMaintenanceOp, win: BrowserWindow): Promise<void> {
  const ssh = target().sshCredentials()

  return maintenance(win, PRINTER_ID, ssh.host, ssh.user, ssh.password, ssh.port)
}

beforeAll(async () => {
  harness.target = makeDeviceTarget(PORT)
  await target().prepare()
  // The enrolled state maintenance assumes: repair's write-layer guard runs the adapter's
  // verifyEnrolled, which is false without the overlay flag.
  await target().session().exec('touch /oem/.debug')
  // Clean slate for the tamper test's "not installed" assertion. Free on a fresh container; it is the
  // bot, where a previous run's install survives, that this is here for.
  await uninstallPlugin(record(), FIXTURE_PLUGIN_ID, true).catch(() => undefined)
  seedManagedPrinter()
}, 300000)

afterAll(async () => {
  // The positive control leaves a plugin behind, which the container discards but shared hardware keeps.
  await uninstallPlugin(record(), FIXTURE_PLUGIN_ID, true).catch(() => undefined)
  await harness.target?.teardown()
}, 180000)

describe('the app daemon maintenance ops against a live daemon', () => {
  it('updates the device daemon to the bundled version through the app update path', async () => {
    await target().downgradeDaemon(OLD_VERSION)
    const before = await fetchDaemonStatus(record())
    expect(before.version).toBe(OLD_VERSION)
    expect(daemonNeedsUpdate(before.version)).toBe(true)
    // The app's start-daemon reclaims 4269 through the autostart script's free_port, which needs
    // fuser, netstat or a system-wide ps: the slim base image has none of them. Stopping the fixture's
    // own daemon first means only the app's op can put a daemon back on that port, which is what makes
    // the version assertion below evidence of the app's work rather than of the fixture's.
    await target().stopDaemon()

    const { win, send } = fakeWindow()
    await runDaemonOp(runUpdateDaemon, win)

    expect(doneStepIds(send)).toEqual(['deploy-daemon', 'start-daemon', 'verify-daemon'])
    expect((await fetchDaemonStatus(record())).version).toBe(expectedDaemonVersion())
    // The daemon answering is the one the app deployed: the autostart script the deploy installed
    // reports the process it started as running.
    expect((await target().session().exec(`${DEVICE_AUTOSTART} status`)).trim()).toBe('running')
    // The python the daemon runs on was built here, on this device, out of the wheels the package
    // carries, with no network: nothing seeds it beforehand, so a printer that can only reach port 22
    // still ends up with a working runtime.
    expect((await target().session().exec(`${DEVICE_VENV_PYTHON} -c 'import fastapi, uvicorn, multipart; print("ok")'`)).trim()).toBe('ok')
    expect(storedRecord().daemonVersion).toBe(expectedDaemonVersion())
    expect(storedRecord().daemonUpdateAvailable).toBe(false)
    expect(storedRecord().daemonUpdatedAt).toBeTruthy()
  }, OP_TIMEOUT_MS)

  it('repairs a daemon on an enrolled printer through the app repair path', async () => {
    // Break the printer the way a user's is broken when they reach for Repair, or the assertions below
    // are pre-satisfied by the update test that just ran: the daemon is down AND the deployed tree
    // reports a stale version, so restarting what is there fails the op's own verify-daemon and only a
    // real re-upload can go green. The store is degraded to match, since the repair's own record write
    // is the other thing under test.
    await target().ageDeployedDaemon(OLD_VERSION)
    updatePrinter(PRINTER_ID, { status: 'offline', daemonVersion: OLD_VERSION, daemonUpdateAvailable: true })

    const { win, send } = fakeWindow()
    await runDaemonOp(runRepair, win)

    expect(doneStepIds(send)).toEqual(['check-write-layer', 'diagnose', 'redeploy-daemon', 'start-daemon', 'verify-daemon'])
    // The diagnosis is reported, whatever it found: its shell pipeline is what a broken quoting
    // regression would silently take out. WHICH issues it lists depends on the tooling the device has,
    // so asserting a particular verdict would be asserting the harness.
    expect(reportedHints(send).some((hint) => hint.startsWith('Diagnosis:'))).toBe(true)
    expect((await fetchDaemonStatus(record())).version).toBe(expectedDaemonVersion())
    expect(storedRecord().status).toBe('managed')
    expect(storedRecord().daemonVersion).toBe(expectedDaemonVersion())
    expect(storedRecord().daemonUpdateAvailable).toBe(false)
  }, OP_TIMEOUT_MS)

  it.skipIf(!FIXTURE_PACKAGE_BUNDLED)('refuses a package tampered after packing, on the daemon the app itself deployed', async () => {
    const refusal = await installPlugin(record(), packageWithTamperedPayload(), FIXTURE_PLUGIN_ID, fixturePluginVars())
      .then(() => null, (installError: Error) => installError)

    expect(refusal).toBeInstanceOf(DaemonHttpError)
    // Same refusal contract as signed-install: 409 plus the `integrity` discriminator, not a fault status.
    expect((refusal as DaemonHttpError).statusCode).toBe(409)
    expect((refusal as DaemonHttpError).detail).toMatchObject({ error: 'integrity' })
    expect(Object.keys((await fetchCapabilities(record())).installed)).not.toContain(FIXTURE_PLUGIN_ID)
    // The control the refusal is worth nothing without: the SAME daemon takes the untouched package.
    // Every assertion above also passes on a daemon that can install nothing at all, so without this the
    // suite cannot tell "refuses tampering" from "refuses everything". Phase-level scoring of the
    // install belongs to signed-install.invitro.test.ts; what this suite adds is the provenance, that
    // the daemon deciding both cases is the one the app's own update path put there.
    await installPlugin(record(), untamperedPackage(), FIXTURE_PLUGIN_ID, fixturePluginVars())
    expect(Object.keys((await fetchCapabilities(record())).installed)).toContain(FIXTURE_PLUGIN_ID)
  }, OP_TIMEOUT_MS)

  // Destructive: it takes the write layer away, so it runs last.
  it('refuses to repair once a firmware update has reset the write layer', async () => {
    await target().resetWriteLayer()
    const { win, send } = fakeWindow()

    await expect(runDaemonOp(runRepair, win)).rejects.toThrow(/full recovery/i)
    expect(doneStepIds(send)).toEqual([])
    const failure = opEvents(send).find((event) => event.status === 'failed')
    expect(failure?.stepId).toBe('check-write-layer')
    expect(failure?.error).toMatch(/full recovery/i)
  }, OP_TIMEOUT_MS)
})
