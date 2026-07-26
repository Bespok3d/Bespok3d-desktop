import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import '@adapters/snapmaker-u1/client/snapmaker-u1'
import { fetchCapabilities, installPlugin } from '../../src/main/daemon-client/client'
import type { PrinterRecord } from '../../src/main/printers'
import { makeDeviceTarget } from './device-target'
import type { DeviceTarget } from './device-target'

// HIL smoke test: install the real rfid-elegoo .b3 through the actual daemon-client <-> daemon HTTPS
// install path (exercising Bespok3d's install flow, not a curl shortcut), then report what the reader
// decoded onto each filament channel so a human can confirm it matches the physical Elegoo spools.
// The decode itself is unit-tested off-device (rfid-elegoo/tests); this verifies the on-printer pipeline.
// Run: B3D_DEVICE_TARGET=real-u1 B3D_HIL_HOST=192.0.2.109 npx vitest run --config vitest.invitro.config.ts read-rfid-elegoo
const PORT = 2231
const HERE = dirname(fileURLToPath(import.meta.url))
const ELEGOO_B3 = join(HERE, '../../dist/plugins/rfid-elegoo-0.1.0.b3')
const RFID_DATA = '/oem/printer_data/config/bespok3d/data/rfid_data.json'
const BESPOK3D_LOG = '/userdata/bespok3d/var/logs/bespok3d.log'

interface ChannelInfo {
  VENDOR: string
  MAIN_TYPE: string
  SUB_TYPE: string
  RGB_1: number
  DIAMETER: number
  WEIGHT: number
}

const harness = { target: null as DeviceTarget | null }

function device(): DeviceTarget {
  return harness.target!
}

function record(): PrinterRecord {
  return device().daemonRecord()
}

function describeChannel(channel: string, info: ChannelInfo): string {
  const color = (info.RGB_1 >>> 0).toString(16).padStart(6, '0')

  return `ch${channel}: vendor=${info.VENDOR} type=${info.MAIN_TYPE} sub=${info.SUB_TYPE} `
    + `color=#${color} diameter=${info.DIAMETER} weight=${info.WEIGHT}g`
}

beforeAll(async () => {
  harness.target = makeDeviceTarget(PORT)
  await harness.target.prepare()
}, 120000)

afterAll(async () => {
  await harness.target?.teardown()
})

describe('HIL: Elegoo RFID decoder on junior', () => {
  it('installs rfid-elegoo through the real daemon-client install path', async () => {
    const log = await installPlugin(record(), readFileSync(ELEGOO_B3), 'rfid-elegoo')
    expect(log.ok).toBe(true)
    expect(log.pluginId).toBe('rfid-elegoo')
    const caps = await fetchCapabilities(record())
    expect(caps.installed).toHaveProperty('rfid-elegoo')
  })

  it('reports the decoded filament on each channel + the recent reader log', async () => {
    const raw = await device().session().getContent(RFID_DATA).catch(() => '{}')
    const channels = JSON.parse(raw) as Record<string, ChannelInfo>
    Object.entries(channels).forEach(([channel, info]) => console.log(describeChannel(channel, info)))

    const tail = await device().session().exec(
      `grep -iE 'elegoo|_dispatch_parsers|ndef_parse|filament update ch' ${BESPOK3D_LOG} | tail -20 || true`,
    )
    console.log('--- recent reader log ---\n' + tail)
  })
})
