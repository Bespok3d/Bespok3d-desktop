// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import '@adapters/snapmaker-u1/client/snapmaker-u1'
import { readFileSync } from 'node:fs'
import { installBatchPackages, type BatchUpdatePackage } from '../../src/main/daemon-client/packages-client'
import type { PrinterRecord } from '../../src/main/printers'
import { makeDeviceTarget, type DeviceTarget } from './device-target'

// webcam-screen is the plugin that registers the Remote Screen framebuffer stream (/screen/) as a
// Moonraker [webcam] entry, so it appears as a camera tile in Fluidd/Mainsail alongside the physical
// cameras. Without it the Remote Screen serves fine on the device but is INVISIBLE in the camera panel.
// It only restarts moonraker, and requires the already-installed screen-service (remote-screen) at run
// time, so it installs on its own without touching Klipper.
const WORKSPACE = '/Users/lucio/Code/Bespok3d_org'
const REMOTE_SCREEN_NAME = 'Printer Screen'

const WEBCAM_SCREEN: BatchUpdatePackage = {
  pluginId: 'webcam-screen',
  bytes: readFileSync(`${WORKSPACE}/plugins/u1-camera-configs/dist/webcam-screen-0.1.1.b3`),
  vars: { REMOTE_SCREEN_NAME },
}

const harness = { target: null as DeviceTarget | null }

function device(): DeviceTarget {
  return harness.target!
}

function record(): PrinterRecord {
  return device().daemonRecord()
}

// One on-device read of Moonraker's registered webcam list, so the suite asserts the app-visible camera
// source really exists rather than that a config file merely landed on disk.
const WEBCAM_LIST_SCRIPT = `python3 <<'PY'
import json
import urllib.request

try:
    with urllib.request.urlopen("http://127.0.0.1:7125/server/webcams/list", timeout=10) as response:
        webcams = json.load(response).get("result", {}).get("webcams", [])
except Exception:
    webcams = []
print(json.dumps([{"name": entry.get("name"), "stream_url": entry.get("stream_url")} for entry in webcams]))
PY`

interface Webcam {
  name: string
  stream_url: string
}

async function registeredWebcams(): Promise<Webcam[]> {
  return JSON.parse(await device().session().exec(WEBCAM_LIST_SCRIPT)) as Webcam[]
}

beforeAll(async () => {
  harness.target = makeDeviceTarget(2242)
  await harness.target.prepare()
}, 300000)

afterAll(async () => {
  await harness.target?.teardown()
}, 300000)

describe('remote-screen becomes a visible camera source via webcam-screen', () => {
  it('installs webcam-screen', async () => {
    const outcome = await installBatchPackages(record(), [WEBCAM_SCREEN])

    const failures = outcome.results.filter((entry) => !entry.ok || entry.skipped)
    expect(failures, JSON.stringify(outcome.results)).toEqual([])
    expect(outcome.ok).toBe(true)
  }, 300000)

  it('registers the screen as a Moonraker webcam pointing at /screen/', async () => {
    const webcams = await registeredWebcams()
    const screen = webcams.find((entry) => entry.name === REMOTE_SCREEN_NAME)
    expect(screen, `webcams seen: ${JSON.stringify(webcams)}`).toBeTruthy()
    expect(screen?.stream_url).toBe('/screen/')
  }, 120000)
})
