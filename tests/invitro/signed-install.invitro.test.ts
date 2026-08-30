// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import '@adapters/snapmaker-u1/client/snapmaker-u1'
import { fetchCapabilities, installPlugin, uninstallPlugin } from '../../src/main/daemon-client/client'
import { DaemonHttpError } from '../../src/main/daemon-client/transport'
import type { PrinterRecord } from '../../src/main/printers'
import type { InstallLog } from '@bespok3d/contract'
import { makeDeviceTarget } from './device-target'
import type { DeviceTarget } from './device-target'
import { FIXTURE_PLUGIN_ID, FIXTURE_PACKAGE_BUNDLED, fixturePluginVars, untamperedPackage, packageWithTamperedPayload } from './tampered-package'

// The device half of the signing chain. The published index is signed so the app can trust WHICH .b3
// to fetch (verify.ts, unit-tested); this suite proves the other half on a real daemon: the manifest
// pins a sha256 per payload file, and the daemon refuses a package whose payload no longer matches
// before any phase touches the printer. Tamper AFTER packing, leave the manifest hash untouched: that
// is exactly what a package altered in transit or at rest looks like.
// Run: npx vitest run --config vitest.invitro.config.ts signed-install
const PORT = 2236

const harness = { target: null as DeviceTarget | null }

function record(): PrinterRecord {
  return harness.target!.daemonRecord()
}

async function installedIds(): Promise<string[]> {
  return Object.keys((await fetchCapabilities(record())).installed)
}

// Every phase the integrity check gates, which is all of them up to the core-service restart. The
// container has no real Klipper or Moonraker to restart, so `restart` reports not-ok there for a
// reason that has nothing to do with the package: scoring it would be scoring the harness.
function failedPlacementPhases(log: InstallLog): string[] {
  return log.phases
    .filter((installPhase) => installPhase.id !== 'restart' && !installPhase.ok)
    .map((installPhase) => installPhase.id)
}

beforeAll(async () => {
  harness.target = makeDeviceTarget(PORT)
  await harness.target.prepare()
  // Clean slate so the refusal case starts from "not installed" and its assertion means something.
  await uninstallPlugin(record(), FIXTURE_PLUGIN_ID, true).catch(() => undefined)
}, 180000)

afterAll(async () => {
  await uninstallPlugin(record(), FIXTURE_PLUGIN_ID, true).catch(() => undefined)
  await harness.target?.teardown()
}, 180000)

describe.skipIf(!FIXTURE_PACKAGE_BUNDLED)('daemon package integrity on a live daemon', () => {
  it('refuses a package tampered with after packing, and installs nothing', async () => {
    const refusal = await installPlugin(record(), packageWithTamperedPayload(), FIXTURE_PLUGIN_ID, fixturePluginVars())
      .then(() => null, (error: Error) => error)

    expect(refusal).toBeInstanceOf(DaemonHttpError)
    // A refusal is not a daemon fault: every refused install answers 409 and is told apart by the
    // `error` discriminator, so pin the discriminator and not just the status.
    expect((refusal as DaemonHttpError).statusCode).toBe(409)
    expect((refusal as DaemonHttpError).detail).toMatchObject({ error: 'integrity' })
    // The refusal is worth nothing if it happened after the daemon had already placed files: the
    // daemon must not report the plugin as installed.
    expect(await installedIds()).not.toContain(FIXTURE_PLUGIN_ID)
  }, 180000)

  it('installs the untouched package the refusal was derived from', async () => {
    const log = await installPlugin(record(), untamperedPackage(), FIXTURE_PLUGIN_ID, fixturePluginVars())

    expect(failedPlacementPhases(log)).toEqual([])
    expect(log.pluginId).toBe(FIXTURE_PLUGIN_ID)
    expect(await installedIds()).toContain(FIXTURE_PLUGIN_ID)
  }, 180000)
})
