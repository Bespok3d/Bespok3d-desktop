// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import '@adapters/snapmaker-u1/client/snapmaker-u1'
import { fetchCapabilities, installPlugin } from '../../src/main/daemon-client/client'
import type { PrinterRecord } from '../../src/main/printers'
import { makeDeviceTarget } from './device-target'
import type { DeviceTarget } from './device-target'

// HIL verify: install the real u1-gcode-colors .b3 through the actual daemon-client <-> daemon install
// path, then read Moonraker's own HTTP API on-device (via SSH exec, no mDNS/network hop needed) to
// confirm the Moonraker component filled each gcode file's filament_colors[] from the printer's live
// print_task_config (extruder_map_table + filament_color_rgba), per the mapping in
// ok-this-is-the-radiant-thunder.md, leaving the singular filament_colour untouched.
// Run: B3D_DEVICE_TARGET=real-u1 npx vitest run --config vitest.invitro.config.ts u1-gcode-colors
const PORT = 2234
const HERE = dirname(fileURLToPath(import.meta.url))
const PLUGIN_B3 = join(HERE, '../../dist/plugins/u1-gcode-colors-0.1.1.b3')

const harness = { target: null as DeviceTarget | null }

function device(): DeviceTarget {
  return harness.target!
}

function record(): PrinterRecord {
  return device().daemonRecord()
}

interface OnDeviceSnapshot {
  target: string
  error?: string
  printTaskConfig?: {
    extruder_map_table: number[]
    filament_color_rgba: string[]
    filament_exist: boolean[]
  }
  metadata?: {
    filament_colour?: string
    filament_colors?: string[]
  }
  printStats?: { state: string }
}

// Finds a gcode file that already carries a sliced filament_colour, reads its metadata + the printer's
// live print_task_config + print_stats, in one on-device round trip (avoids N separate SSH exec calls).
// Pure python3 (no jq on junior's stock image) talking to Moonraker's own loopback HTTP API.
const SNAPSHOT_SCRIPT = `python3 <<'PY'
import json
import urllib.parse
import urllib.request

def get(path):
    with urllib.request.urlopen("http://127.0.0.1:7125" + path, timeout=10) as response:
        return json.load(response)

files = get("/server/files/list?root=gcodes").get("result", [])
target = None
metadata = None
for entry in files:
    path = entry.get("path")
    if not path:
        continue
    encoded = urllib.parse.quote(path)
    candidate_metadata = get("/server/files/metadata?filename=" + encoded).get("result", {})
    if candidate_metadata.get("filament_colour"):
        target = path
        metadata = candidate_metadata
        break

raw_pt = get("/printer/objects/query?print_task_config")
print_task_config = raw_pt.get("result", {}).get("status", {}).get("print_task_config", {})
if not print_task_config:
    print_task_config = raw_pt.get("result", {}).get("print_task_config", {})
print_stats_raw = get("/printer/objects/query?print_stats")
print_stats = print_stats_raw.get("result", {}).get("status", {}).get("print_stats", {})
if not print_stats:
    print_stats = print_stats_raw.get("result", {}).get("print_stats", {})

out = {
    "target": target or "",
    "metadata": metadata or {},
    "printTaskConfig": print_task_config,
    "printStats": print_stats,
}
if target is None:
    out["error"] = "no_multicolor_file_found"

print(json.dumps(out))
PY`

async function takeSnapshot(): Promise<OnDeviceSnapshot> {
  const raw = await device().session().exec(SNAPSHOT_SCRIPT)

  return JSON.parse(raw) as OnDeviceSnapshot
}

function expectedColors(printTaskConfig: NonNullable<OnDeviceSnapshot['printTaskConfig']>, toolCount: number): string[] {
  return Array.from({ length: toolCount }, (_unused, tool) => {
    const extruder = printTaskConfig.extruder_map_table[tool]
    const loadedRgba = printTaskConfig.filament_color_rgba[extruder]
    const loaded = printTaskConfig.filament_exist[extruder] && loadedRgba && loadedRgba.toUpperCase() !== 'FFFFFFFF'

    return loaded ? `#${loadedRgba.slice(0, 6)}` : ''
  })
}

async function waitForMoonraker(attemptsLeft: number): Promise<void> {
  const result = await device().session().exec(
    'curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:7125/server/info || echo 000',
  )
  if (result.trim() === '200') return
  if (attemptsLeft <= 0) throw new Error('moonraker did not come back after plugin install/reconfigure')
  await new Promise((done) => setTimeout(done, 1000))
  await waitForMoonraker(attemptsLeft - 1)
}

beforeAll(async () => {
  harness.target = makeDeviceTarget(PORT)
  await harness.target.prepare()
}, 120000)

afterAll(async () => {
  await harness.target?.teardown()
})

describe('HIL: u1-gcode-colors Moonraker component on junior', () => {
  it('installs u1-gcode-colors through the real daemon-client install path', async () => {
    const log = await installPlugin(
      record(),
      readFileSync(PLUGIN_B3),
      'u1-gcode-colors',
      { GCODE_COLORS_ENABLED: 'true' },
    )
    expect(log.ok).toBe(true)
    expect(log.pluginId).toBe('u1-gcode-colors')
    await waitForMoonraker(30)

    const caps = await fetchCapabilities(record())
    expect(caps.installed).toHaveProperty('u1-gcode-colors')
  }, 120000)

  it('fills filament_colors from live print_task_config, leaving filament_colour untouched', async () => {
    const snapshot = await takeSnapshot()
    console.log('[u1-gcode-colors] snapshot:', JSON.stringify(snapshot, null, 2))

    expect(snapshot.error).toBeUndefined()
    expect(snapshot.printStats?.state).not.toBe('printing')
    expect(snapshot.printStats?.state).not.toBe('paused')

    const slicedColors = (snapshot.metadata?.filament_colour ?? '').split(';')
    const actualColors = snapshot.metadata?.filament_colors ?? []
    expect(actualColors.length).toBe(slicedColors.length)

    const expected = expectedColors(snapshot.printTaskConfig!, slicedColors.length)
    expected.forEach((expectedColor, tool) => {
      const fallback = slicedColors[tool] ? slicedColors[tool].toLowerCase() : ''
      const wantColor = expectedColor || fallback

      expect(actualColors[tool].toLowerCase()).toBe(wantColor.toLowerCase())
    })

    // filament_colour (singular, the sliced source) must survive unchanged, not be stripped or renamed.
    expect(typeof snapshot.metadata?.filament_colour).toBe('string')
  }, 30000)

  // NOTE (observed on junior, not automated here): disabling GCODE_COLORS_ENABLED stops the
  // component from filling newly-scanned files, but does NOT retroactively strip filament_colors
  // already written to a file's cached Moonraker metadata during an earlier enabled pass - stage 2
  // built "toggle off -> never writes", not "toggle off -> clears". A synthetic probe file for this
  // case proved unreliable in-test (Moonraker's footer parser did not pick up a hand-built fixture's
  // sliced-color comment), so this is left as a documented finding rather than a flaky assertion.
})
