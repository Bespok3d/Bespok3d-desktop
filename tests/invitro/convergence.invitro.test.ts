// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import '@adapters/snapmaker-u1/client/snapmaker-u1'
import {
  deactivateAll, fetchCapabilities, fetchSelfCheck, installPlugin, recoverPackages, uninstallPlugin,
} from '../../src/main/daemon-client/client'
import type { PrinterRecord } from '../../src/main/printers'
import { buildPackage } from './probe-package'
import { makeDeviceTarget } from './device-target'
import type { DeviceTarget } from './device-target'

// CONVERGENCE: every lifecycle op ends in the same correct state whether it starts from a clean printer,
// a dirty one, or one left half done, and running it twice is never an error. Driven through the real
// daemon-client over cert-pinned HTTPS like the lifecycle suite, and through the same DeviceTarget seam,
// so it runs against the Docker fake device on the gate and against junior (the real U1 bench) with
// B3D_DEVICE_TARGET=real-u1. See doc/hardware-in-the-loop.md for the one command.
//
// The case that started this: a printer whose own config no longer includes bespok3d, with a plugin left
// half removed and NO plugins installed, reported itself healthy, because the check only walked the
// symlinks of installed plugins. Zero plugins meant nothing to walk meant "all fine", and the app then
// offered no way back. The last test here is that printer, end to end.
const PORT = 2228
const PLUGIN_ROOT = '/userdata/bespok3d/usr/local/plugins'
const GLOBAL_DEACTIVATED_MARKER = '/userdata/bespok3d/etc/deactivated'
const harness = { target: null as DeviceTarget | null }

function device(): DeviceTarget {
  return harness.target!
}

function record(): PrinterRecord {
  return device().daemonRecord()
}

function logCleanup(cleanupError: unknown): void {
  console.warn('[invitro cleanup]', cleanupError)
}

async function exists(path: string): Promise<boolean> {
  const answer = await device().session().exec(`test -e ${path} && echo yes || echo no`)

  return answer.trim() === 'yes'
}

async function printerProblems(): Promise<Array<{ kind: string; detail: string }>> {
  const report = await fetchSelfCheck(record())

  return report.problems ?? []
}

async function problemKinds(): Promise<string[]> {
  return (await printerProblems()).map((problem) => problem.kind)
}

// The user asking for bespok3d back: the marker that carries "switched off" goes, and the repair that
// runs on every recover puts the wiring back to match. Nothing else on the device is touched by hand.
async function switchBackOn(): Promise<void> {
  await device().session().exec(`rm -f ${GLOBAL_DEACTIVATED_MARKER}`)
  await recoverPackages(record())
}

async function installedIds(): Promise<string[]> {
  return Object.keys((await fetchCapabilities(record())).installed)
}

beforeAll(async () => {
  harness.target = makeDeviceTarget(PORT)
  await harness.target.prepare()
  // Both configs the printer loads bespok3d from must exist for the wiring to be checkable at all; on
  // the fake device nothing else has created them yet, and on the bench they are already there.
  await harness.target.session().exec('mkdir -p /oem/printer_data/config')
  await harness.target.session().exec('test -f /oem/printer_data/config/printer.cfg || printf "[mcu]\\n" > /oem/printer_data/config/printer.cfg')
  await harness.target.session().exec('test -f /oem/printer_data/config/moonraker.conf || printf "[server]\\n" > /oem/printer_data/config/moonraker.conf')
  await switchBackOn()
}, 180000)

// Leave the printer switched ON and empty however the run ended, so the shared bench is never handed to
// the next run deactivated or holding this suite's plugins.
afterAll(async () => {
  if (harness.target) {
    await device().session().exec(`rm -rf ${PLUGIN_ROOT}/invitro-converge ${PLUGIN_ROOT}/invitro-halfremoved`).catch(logCleanup)
    await switchBackOn().catch(logCleanup)
  }
  await harness.target?.teardown()
})

describe('in-vitro lifecycle convergence (real daemon-client over the wire)', () => {
  it('repairs a printer that is already whole without changing it, twice over', async () => {
    await installPlugin(record(), buildPackage({ name: 'invitro-converge' }), 'invitro-converge')
    try {
      expect(await problemKinds()).toEqual([])

      await recoverPackages(record())
      await recoverPackages(record())

      expect(await problemKinds()).toEqual([])
      expect(await exists('/userdata/bespok3d/invitro-converge.cfg')).toBe(true)
      expect(await installedIds()).toContain('invitro-converge')
    } finally {
      await uninstallPlugin(record(), 'invitro-converge', true).catch(logCleanup)
    }
  })

  it('deactivates to the same state whether it starts on or already off', async () => {
    await installPlugin(record(), buildPackage({ name: 'invitro-converge' }), 'invitro-converge')
    try {
      await deactivateAll(record())
      await deactivateAll(record())

      expect(await exists(GLOBAL_DEACTIVATED_MARKER)).toBe(true)
      expect(await exists('/userdata/bespok3d/invitro-converge.cfg')).toBe(false)
      // The plugin's own files survive: deactivation is reversible, unlike a removal.
      expect(await exists(`${PLUGIN_ROOT}/invitro-converge/manifest.json`)).toBe(true)
      // Wiring that is gone because the user asked for it to be gone is not a problem to report.
      expect(await problemKinds()).toEqual([])
    } finally {
      await switchBackOn().catch(logCleanup)
      await uninstallPlugin(record(), 'invitro-converge', true).catch(logCleanup)
    }
  })

  it('brings the printer back from deactivated and stays there when asked again', async () => {
    await installPlugin(record(), buildPackage({ name: 'invitro-converge' }), 'invitro-converge')
    try {
      await deactivateAll(record())
      await switchBackOn()
      await switchBackOn()

      expect(await exists(GLOBAL_DEACTIVATED_MARKER)).toBe(false)
      expect(await exists('/userdata/bespok3d/invitro-converge.cfg')).toBe(true)
      expect(await problemKinds()).toEqual([])
    } finally {
      await uninstallPlugin(record(), 'invitro-converge', true).catch(logCleanup)
    }
  })

  it('removes a plugin that is already gone without calling it an error', async () => {
    await installPlugin(record(), buildPackage({ name: 'invitro-converge' }), 'invitro-converge')
    await uninstallPlugin(record(), 'invitro-converge', true)

    const secondRemoval = await uninstallPlugin(record(), 'invitro-converge', true)

    expect(secondRemoval).not.toContain('invitro-converge')
    expect(await installedIds()).not.toContain('invitro-converge')
    expect(await problemKinds()).toEqual([])
  })

  it('reports and repairs the printer that used to look healthy: no plugins, no includes, one half removed', async () => {
    // Exactly the state junior was found in. Deactivate strips the include lines, dropping the marker
    // afterwards leaves the printer claiming to be ON with none of its wiring, and a directory with no
    // manifest is what an uninstall that died partway leaves behind.
    await deactivateAll(record())
    await device().session().exec(`rm -f ${GLOBAL_DEACTIVATED_MARKER}`)
    await device().session().exec(`mkdir -p ${PLUGIN_ROOT}/invitro-halfremoved`)
    try {
      // The half-removed directory is not a plugin: it has no manifest, so nothing reports it as
      // installed, and that is exactly why walking installed plugins could never see this printer.
      expect(await installedIds()).not.toContain('invitro-halfremoved')
      const broken = await problemKinds()
      expect(broken).toContain('includes_missing')
      expect(broken).toContain('plugin_half_removed')

      await recoverPackages(record())

      expect(await problemKinds()).toEqual([])
      expect(await exists(`${PLUGIN_ROOT}/invitro-halfremoved`)).toBe(false)
    } finally {
      await device().session().exec(`rm -rf ${PLUGIN_ROOT}/invitro-halfremoved`).catch(logCleanup)
      await switchBackOn().catch(logCleanup)
    }
  })
})
