// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect } from 'vitest'
import '@adapters/snapmaker-u1/client/snapmaker-u1'
import { readFileSync } from 'node:fs'
import { fetchCapabilities } from '../../src/main/daemon-client/client'
import { installBatchPackages, updateBatchPackages, type BatchUpdatePackage } from '../../src/main/daemon-client/packages-client'
import type { PrinterRecord } from '../../src/main/printers'

// The base-layer migration on a printer that already runs the patching feature plugins: the base
// members install first and adopt the Snapmaker files, then the feature plugins update onto them.
// Inert unless B3D_MIGRATION_RECORD names the managed printer record to drive.
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

describe.skipIf(!recordPath)('base layer migration on a patching printer', () => {

  it('installs the base members onto a printer whose feature plugins still own the patches', async () => {
    const result = await installBatchPackages(managedRecord(), BASE_MEMBERS.map(packageOf))
    console.log('base install:', JSON.stringify(result))
    expect(result.ok).toBe(true)
  }, 600000)

  it('updates the feature plugins onto the base', async () => {
    const result = await updateBatchPackages(managedRecord(), FEATURE_UPDATES.map(packageOf))
    console.log('feature update:', JSON.stringify(result))
    expect(result.ok).toBe(true)
  }, 600000)

  it('reports every base member and the updated feature plugins as installed', async () => {
    const caps = await fetchCapabilities(managedRecord())
    console.log('installed after migration:', JSON.stringify(caps.installed))
    BASE_MEMBERS.map(pluginIdOf).forEach((id) => expect(caps.installed[id]).toBe('0.1.0'))
    expect(caps.installed['rfid-ntag']).toBe('0.1.14')
    expect(caps.installed['print-prefs-core']).toBe('0.1.2')
  }, 120000)
})
