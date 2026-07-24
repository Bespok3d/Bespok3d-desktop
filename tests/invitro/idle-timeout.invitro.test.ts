import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import '@adapters/snapmaker-u1/client/snapmaker-u1'
import { fetchCapabilities, installPlugin, reconfigurePlugin, uninstallPlugin } from '../../src/main/daemon-client/client'
import type { PrinterRecord } from '../../src/main/printers'
import { makeDeviceTarget } from './device-target'
import type { DeviceTarget } from './device-target'

// HIL verify: install the real idle-timeout .b3 through the actual daemon-client <-> daemon install
// path (a klipper-config plugin: renders an [idle_timeout] override and restarts Klipper). The
// override wins because Klipper reads the bespok3d include after the stock section (last value wins),
// so Klipper's parsed configfile.settings.idle_timeout.timeout becomes the chosen value. That is the
// durable, queryable proof: on the U1 the firmware re-applies configfile.settings.idle_timeout.timeout
// after every print, so a runtime SET_IDLE_TIMEOUT would not stick but this config override does.
// timeout_on_pause must survive (the override only sets timeout), and a reconfigure must move the value.
// Run: B3D_DEVICE_TARGET=real-u1 npx vitest run --config vitest.invitro.config.ts idle-timeout
const PORT = 2235
const HERE = dirname(fileURLToPath(import.meta.url))
const PLUGIN_B3 = join(HERE, '../../dist/plugins/idle-timeout-0.1.0.b3')

const harness = { target: null as DeviceTarget | null }
// The stock timeout_on_pause captured before install, so the "override leaves it intact" check
// compares against the real prior value instead of an arbitrary magnitude.
const baseline = { timeoutOnPause: '' }

function device(): DeviceTarget {
  return harness.target!
}

function record(): PrinterRecord {
  return device().daemonRecord()
}

interface DeviceProbe {
  klipperState: string | null
  printState: string | null
  configuredTimeout: string | null
  configuredTimeoutOnPause: string | null
}

// One on-device round trip: Klipper's ready state, the print state (so the test refuses to touch a
// printing machine), and the parsed idle_timeout config settings that our override drives.
const PROBE_SCRIPT = `python3 <<'PY'
import json
import urllib.request

def status(obj):
    try:
        with urllib.request.urlopen("http://127.0.0.1:7125/printer/objects/query?" + obj, timeout=10) as response:
            return json.load(response).get("result", {}).get("status", {})
    except Exception:
        return {}

webhooks = status("webhooks").get("webhooks", {})
print_stats = status("print_stats").get("print_stats", {})
idle_settings = status("configfile").get("configfile", {}).get("settings", {}).get("idle_timeout", {})
print(json.dumps({
    "klipperState": webhooks.get("state"),
    "printState": print_stats.get("state"),
    "configuredTimeout": str(idle_settings.get("timeout")) if idle_settings.get("timeout") is not None else None,
    "configuredTimeoutOnPause": str(idle_settings.get("timeout_on_pause")) if idle_settings.get("timeout_on_pause") is not None else None,
}))
PY`

async function probe(): Promise<DeviceProbe> {
  return JSON.parse(await device().session().exec(PROBE_SCRIPT)) as DeviceProbe
}

// Configfile settings are floats once parsed (7200 -> "7200.0"), so compare numerically.
function timeoutSeconds(snapshot: DeviceProbe): number {
  return Math.round(Number(snapshot.configuredTimeout))
}

// After a Klipper restart configfile reloads, so poll until Klipper is ready with the expected value
// rather than reading once and racing the restart.
async function waitForConfiguredTimeout(expected: number, attemptsLeft: number): Promise<DeviceProbe> {
  const snapshot = await probe()
  if (snapshot.klipperState === 'ready' && timeoutSeconds(snapshot) === expected) return snapshot
  if (attemptsLeft <= 0) {
    throw new Error(`configured idle timeout never reached ${expected}s (last probe: ${JSON.stringify(snapshot)})`)
  }
  await new Promise((done) => setTimeout(done, 2000))

  return waitForConfiguredTimeout(expected, attemptsLeft - 1)
}

beforeAll(async () => {
  harness.target = makeDeviceTarget(PORT)
  await harness.target.prepare()
  // Clean slate so the suite is re-runnable: drop any idle-timeout left from a prior run before the
  // install test asserts a fresh override. Ignored if it was not installed.
  await uninstallPlugin(record(), 'idle-timeout', true).catch(() => undefined)
  const stock = await probe()
  baseline.timeoutOnPause = stock.configuredTimeoutOnPause ?? ''
}, 180000)

afterAll(async () => {
  await harness.target?.teardown()
})

describe('HIL: idle-timeout klipper-config plugin on junior', () => {
  it('installs idle-timeout (7200s) and the override wins in Klipper config', async () => {
    const log = await installPlugin(
      record(),
      readFileSync(PLUGIN_B3),
      'idle-timeout',
      { IDLE_TIMEOUT_SECONDS: '7200' },
    )
    expect(log.ok).toBe(true)
    expect(log.pluginId).toBe('idle-timeout')

    const caps = await fetchCapabilities(record())
    expect(caps.installed).toHaveProperty('idle-timeout')

    const snapshot = await waitForConfiguredTimeout(7200, 40)
    console.log('[idle-timeout] after 7200s install:', JSON.stringify(snapshot))
    expect(snapshot.printState).not.toBe('printing')
    expect(snapshot.printState).not.toBe('paused')
    expect(timeoutSeconds(snapshot)).toBe(7200)
    // The override sets only timeout, so the firmware's timeout_on_pause must be exactly as before.
    expect(snapshot.configuredTimeoutOnPause).toBe(baseline.timeoutOnPause)
  }, 180000)

  it('reconfiguring to 1800s moves the configured timeout (proves the value is user-driven)', async () => {
    const log = await reconfigurePlugin(record(), 'idle-timeout', { IDLE_TIMEOUT_SECONDS: '1800' })
    expect(log.ok).toBe(true)

    const snapshot = await waitForConfiguredTimeout(1800, 40)
    console.log('[idle-timeout] after 1800s reconfigure:', JSON.stringify(snapshot))
    expect(timeoutSeconds(snapshot)).toBe(1800)

    // Leave junior on the plugin's shipped default so the shared bench is in a clean state.
    const restore = await reconfigurePlugin(record(), 'idle-timeout', { IDLE_TIMEOUT_SECONDS: '7200' })
    expect(restore.ok).toBe(true)
    await waitForConfiguredTimeout(7200, 40)
  }, 180000)
})
