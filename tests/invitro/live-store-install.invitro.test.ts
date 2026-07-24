import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import '@adapters/snapmaker-u1/client/snapmaker-u1'
import { fetchCapabilities, installPlugin, uninstallPlugin } from '../../src/main/daemon-client/client'
import { verifiedPackageTrust, PackageRefusedError } from '../../src/main/store/verify-package'
import type { MergedEntry } from '../../src/main/registry/model'
import type { PrinterRecord } from '../../src/main/printers'
import { makeDeviceTarget } from './device-target'
import type { DeviceTarget } from './device-target'

// The app half of the signing chain, on PUBLISHED bytes: the daemon suites prove a tampered payload is
// refused on the device, but they carry unsigned fixtures, so nothing there exercises the app's own
// GPG check. This suite feeds the real `.b3` files the live store serves to the same function the store
// install path calls, then installs the verified bytes on a live daemon.
//
// Opt-in, because it needs artifacts fetched from the org's private repos: it is skipped unless
// B3D_LIVE_FIXTURES points at a directory holding the published `index.json` plus `<name>.b3` for each
// plugin below. That keeps the gate free of a network + credentials dependency.
// Run: B3D_LIVE_FIXTURES=<dir> B3D_DEVICE_TARGET=real-u1 npx vitest run --config vitest.invitro.config.ts live-store
const LIVE_FIXTURES = process.env.B3D_LIVE_FIXTURES
const PORT = 2238
// Web assets only: no core-service restart, so verifying the signed-install path costs the bench no
// restart storm ([[project_junior_shakedown_bugs]]), and uninstall puts the stock UI back.
const WEB_UI_PLUGIN = 'fluidd'
// The plugin whose source was restored and re-published: what is asserted here is that the copy the
// store serves carries an org signature the app accepts, not that a heater plugin runs without hardware.
const RESTORED_PLUGIN = 'panda-breath'

const harness = { target: null as DeviceTarget | null }

function record(): PrinterRecord {
  return harness.target!.daemonRecord()
}

function liveArchive(pluginName: string): Buffer {
  return readFileSync(join(LIVE_FIXTURES!, `${pluginName}.b3`))
}

// The published listing carries no per-source stamps: those are added by the resolver as it merges a
// source into the catalog, and the verifier reads only the fields the index itself supplies.
function liveEntry(pluginName: string): MergedEntry {
  const index = JSON.parse(readFileSync(join(LIVE_FIXTURES!, 'index.json'), 'utf8'))
  const listed = index.plugins.find((plugin: { name: string }) => plugin.name === pluginName)
  if (!listed) throw new Error(`${pluginName} is not listed in the live index fixture`)

  return { ...listed, trust: 'project', registry_url: 'https://github.com/Bespok3d/main-index' } as MergedEntry
}

async function installedIds(): Promise<string[]> {
  return Object.keys((await fetchCapabilities(record())).installed)
}

// A root hook runs even when every test below is skipped, so without this guard a plain invitro run
// would build a container, or reach into a live printer and uninstall from it, for a suite that is
// about to run nothing.
beforeAll(async () => {
  if (!LIVE_FIXTURES) return
  harness.target = makeDeviceTarget(PORT)
  await harness.target.prepare()
  await uninstallPlugin(record(), WEB_UI_PLUGIN, true).catch(() => undefined)
}, 180000)

afterAll(async () => {
  if (!harness.target) return
  // Leave the bench as it was found: the stock UI comes back with the plugin.
  await uninstallPlugin(record(), WEB_UI_PLUGIN, true).catch(() => undefined)
  await harness.target.teardown()
}, 180000)

describe.skipIf(!LIVE_FIXTURES)('the app verifying packages the live store serves', () => {
  it('grants the published package the project tier, not unknown', async () => {
    expect(await verifiedPackageTrust(liveArchive(WEB_UI_PLUGIN), liveEntry(WEB_UI_PLUGIN))).toBe('project')
  })

  it('grants the restored plugin the project tier from its published bytes', async () => {
    expect(await verifiedPackageTrust(liveArchive(RESTORED_PLUGIN), liveEntry(RESTORED_PLUGIN))).toBe('project')
  })

  // The control the two tiers above are worth nothing without: a validly signed package is still refused
  // when it is not the package that was asked for, so the tier comes from THIS archive matching THIS
  // listing and not from the verifier waving org signatures through.
  it('refuses a validly signed package served in place of another plugin', async () => {
    const substitution = verifiedPackageTrust(liveArchive(RESTORED_PLUGIN), liveEntry(WEB_UI_PLUGIN))

    await expect(substitution).rejects.toBeInstanceOf(PackageRefusedError)
  })

  it('installs the verified package on a live daemon', async () => {
    const log = await installPlugin(record(), liveArchive(WEB_UI_PLUGIN), WEB_UI_PLUGIN)

    expect(log.phases.filter((installPhase) => !installPhase.ok)).toEqual([])
    expect(await installedIds()).toContain(WEB_UI_PLUGIN)
  }, 300000)
})

// Not covered here on purpose: INSTALLING panda-breath. Run on junior 2026-07-21 it halted Klipper, and
// the daemon's safety auto-recovery rolled it back and left the printer ready. The cause is in the
// plugin, not in this path: its klipper config template substitutes $PANDA_PORT, which its manifest
// never declares, so the port line reaches Klipper unsubstituted. A case that halts a printer's firmware
// on every run is not something to leave in a suite; it belongs to the stage that fixes the plugin.
