// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect } from 'vitest'
import '@adapters/snapmaker-u1/client/snapmaker-u1'
import { readFileSync } from 'node:fs'
import { fetchCapabilities } from '../../src/main/daemon-client/client'
import {
  installBatchPackages,
  updateBatchPackages,
  uninstallBatch,
  type BatchUpdatePackage,
} from '../../src/main/daemon-client/packages-client'
import type { PrinterRecord } from '../../src/main/printers'

const recordPath = process.env.B3D_MIGRATION_RECORD
const packageDir = process.env.B3D_MIGRATION_PACKAGES ?? 'dist/plugins'

const BASE_MEMBERS = [
  'u1-base-print-task-config-0.1.0.b3',
  'u1-base-fm175xx-reader-0.1.0.b3',
  'u1-base-filament-detect-0.1.0.b3',
  'u1-base-toolhead-0.1.0.b3',
  'u1-base-resonance-tester-0.1.0.b3',
  'u1-base-shaper-calibrate-0.1.0.b3',
]
const FEATURE_UPDATES = ['rfid-ntag-0.1.14.b3', 'print-prefs-core-0.1.2.b3']

function pluginIdOf(fileName: string): string {
  return fileName.replace(/-\d+\.\d+\.\d+\.b3$/, '')
}
function packageOf(fileName: string): BatchUpdatePackage {
  return { pluginId: pluginIdOf(fileName), bytes: readFileSync(`${packageDir}/${fileName}`) }
}
function managedRecord(): PrinterRecord {
  return JSON.parse(readFileSync(recordPath as string, 'utf8')) as PrinterRecord
}

describe.skipIf(!recordPath)('migration orders on a printer running the patching plugins', () => {
  it('clears any base member left behind by an earlier attempt', async () => {
    const result = await uninstallBatch(managedRecord(), BASE_MEMBERS.map(pluginIdOf), false)
    console.log('CLEANUP:', JSON.stringify(result))
    const caps = await fetchCapabilities(managedRecord())
    const remaining = Object.keys(caps.installed).filter((id) => id.startsWith('u1-base-'))
    console.log('BASE REMAINING AFTER CLEANUP:', JSON.stringify(remaining))
    expect(remaining).toEqual([])
  }, 600000)

  it('order A: update the feature plugins first, with the base absent', async () => {
    const result = await updateBatchPackages(managedRecord(), FEATURE_UPDATES.map(packageOf))
    console.log('ORDER A:', JSON.stringify(result))
    const caps = await fetchCapabilities(managedRecord())
    console.log('ORDER A INSTALLED:', JSON.stringify(caps.installed))
  }, 600000)

  it('order B: one batch, base members and feature updates together', async () => {
    const everything = [...BASE_MEMBERS, ...FEATURE_UPDATES].map(packageOf)
    const result = await installBatchPackages(managedRecord(), everything)
    console.log('ORDER B:', JSON.stringify(result))
    const caps = await fetchCapabilities(managedRecord())
    console.log('ORDER B INSTALLED:', JSON.stringify(caps.installed))
  }, 900000)
})

const OLD_PATCHING_PLUGINS = ['rfid-ntag', 'print-prefs-core', 'klipper-motion']

describe.skipIf(!recordPath)('order C: retire the old patching plugins first', () => {
  it('uninstalls the old patching plugins so they hand their files back', async () => {
    const result = await uninstallBatch(managedRecord(), OLD_PATCHING_PLUGINS, false)
    console.log('ORDER C RETIRE:', JSON.stringify(result))
  }, 600000)

  it('clears any base member left behind by the earlier orders', async () => {
    await uninstallBatch(managedRecord(), BASE_MEMBERS.map(pluginIdOf), false)
    const caps = await fetchCapabilities(managedRecord())
    expect(Object.keys(caps.installed).filter((id) => id.startsWith('u1-base-'))).toEqual([])
  }, 600000)

  it('installs the base onto the handed-back files', async () => {
    const result = await installBatchPackages(managedRecord(), BASE_MEMBERS.map(packageOf))
    console.log('ORDER C BASE:', JSON.stringify(result))
  }, 900000)

  it('installs the new feature plugins onto the base', async () => {
    const result = await installBatchPackages(managedRecord(), FEATURE_UPDATES.map(packageOf))
    console.log('ORDER C FEATURES:', JSON.stringify(result))
    const caps = await fetchCapabilities(managedRecord())
    console.log('ORDER C INSTALLED:', JSON.stringify(caps.installed))
  }, 900000)
})
