// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect } from 'vitest'
import '@adapters/snapmaker-u1/client/snapmaker-u1'
import { readFileSync } from 'node:fs'
import { fetchCapabilities } from '../../src/main/daemon-client/client'
import { uninstallPlugin } from '../../src/main/daemon-client/packages-client'
import type { PrinterRecord } from '../../src/main/printers'

// What base-layer-migration-device-up does for the Docker device, for the hardware bench: it takes a
// printer that a HALF-FINISHED migration left carrying some base members and puts it back to the state
// a user's printer is in BEFORE the migration, so the one-pass migration run afterwards is a real one.
// The old patching feature plugins are left exactly as they are: they are the pre-migration state.
// Inert unless B3D_MIGRATION_BENCH_UP is set.
const benchUp = process.env.B3D_MIGRATION_BENCH_UP
const recordPath = process.env.B3D_MIGRATION_RECORD ?? ''

const BASE_MEMBER_IDS = [
  'u1-base-print-task-config',
  'u1-base-fm175xx-reader',
  'u1-base-filament-detect',
  'u1-base-toolhead',
  'u1-base-resonance-tester',
  'u1-base-shaper-calibrate',
]

const OLD_PATCHING_PLUGINS = ['klipper-motion', 'print-prefs-core', 'rfid-ntag']

function managedRecord(): PrinterRecord {
  return JSON.parse(readFileSync(recordPath, 'utf8')) as PrinterRecord
}

describe.skipIf(!benchUp || !recordPath)('the hardware bench before the base-layer migration', () => {

  it('removes every base member a half-finished migration left on the printer', async () => {
    const installedBefore = (await fetchCapabilities(managedRecord())).installed
    console.log('installed before rewind:', JSON.stringify(installedBefore))
    const present = BASE_MEMBER_IDS.filter((memberId) => installedBefore[memberId])
    await present.reduce(
      (queue, memberId) => queue.then(async () => { console.log('removing', memberId, JSON.stringify(await uninstallPlugin(managedRecord(), memberId))) }),
      Promise.resolve(),
    )

    const installedAfter = (await fetchCapabilities(managedRecord())).installed
    BASE_MEMBER_IDS.forEach((memberId) => expect(installedAfter[memberId]).toBeUndefined())
  }, 600000)

  it('leaves the printer on the old patching plugins the migration has to move', async () => {
    const installed = (await fetchCapabilities(managedRecord())).installed
    console.log('pre-migration state:', JSON.stringify(installed))
    OLD_PATCHING_PLUGINS.forEach((pluginId) => expect(installed[pluginId]).toBeTruthy())
  }, 120000)
})
