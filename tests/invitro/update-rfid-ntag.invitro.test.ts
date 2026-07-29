// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import '@adapters/snapmaker-u1/client/snapmaker-u1'
import { fetchCapabilities, updateBatchPackages } from '../../src/main/daemon-client/client'
import type { PrinterRecord } from '../../src/main/printers'
import { makeDeviceTarget } from './device-target'
import type { DeviceTarget } from './device-target'

// Deploy the rfid-ntag claim-substrate (0.1.6) + the rfid-bambu decoder to junior via the real
// batch-update path, which restores the original klipper source then re-applies the reader patch.
const PORT = 2233
const HERE = dirname(fileURLToPath(import.meta.url))
const NTAG_B3 = join(HERE, '../../dist/plugins/rfid-ntag-0.1.6.b3')
const BAMBU_B3 = join(HERE, '../../dist/plugins/rfid-bambu-0.1.0.b3')

const harness = { target: null as DeviceTarget | null }

function device(): DeviceTarget {
  return harness.target!
}

function record(): PrinterRecord {
  return device().daemonRecord()
}

beforeAll(async () => {
  harness.target = makeDeviceTarget(PORT)
  await harness.target.prepare()
}, 120000)

afterAll(async () => {
  await harness.target?.teardown()
})

describe('HIL: deploy rfid-ntag claim substrate + rfid-bambu to junior', () => {
  it('updates rfid-ntag + installs rfid-bambu via the batch path (re-applies the reader patch)', async () => {
    const result = await updateBatchPackages(record(), [
      { pluginId: 'rfid-ntag', bytes: readFileSync(NTAG_B3) },
      { pluginId: 'rfid-bambu', bytes: readFileSync(BAMBU_B3) },
    ])
    console.log('update-batch result:', JSON.stringify(result))
    const caps = await fetchCapabilities(record())
    console.log('installed rfid-ntag:', caps.installed['rfid-ntag'])
    console.log('installed rfid-bambu:', caps.installed['rfid-bambu'])
    expect(caps.installed['rfid-ntag']).toBe('0.1.6')
    expect(caps.installed['rfid-bambu']).toBe('0.1.0')
  })
})
