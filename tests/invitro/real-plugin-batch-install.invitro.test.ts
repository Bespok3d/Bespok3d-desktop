// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import '@adapters/snapmaker-u1/client/snapmaker-u1'
import { readFileSync } from 'node:fs'
import { fetchCapabilities } from '../../src/main/daemon-client/client'
import { installBatchPackages, type BatchUpdatePackage } from '../../src/main/daemon-client/packages-client'
import type { PrinterRecord } from '../../src/main/printers'
import { makeDeviceTarget, type DeviceTarget } from './device-target'

// Standard procedure: install EVERY in-scope plugin on a real printer in ONE coordinated restart, then
// prove the printer stayed healthy AND each plugin's observable effect is actually LIVE - not merely
// that its id landed in /capabilities. "Live" means the thing the plugin exists to do is verifiable on
// the device with no human in the loop: its Klipper config section reached the loaded config with the
// value/name it sets, its Moonraker component/section is registered, its long-running service holds a
// live pid, its endpoint serves, or its source patch is present in the running Klipper source.
//
// The roster is the WHOLE plugin set minus only what a bench genuinely cannot exercise, and each
// exclusion states why:
//   - the two VPNs (tailscale, zerotier) and OctoEverywhere      -> need an external account/relay
//   - panda-breath                                               -> needs its own hardware we do not have
//   - the commercial-tag RFID variants                           -> need physical Bambu/Creality/etc. tags
//   - all-the-tags                                               -> a Collection (curated member list), not an install
//   - force-bed-mesh                                             -> declared mutual conflict with force-bed-mesh-adaptive; test the adaptive one
//   - tmc-low-current                                            -> same [tmc2240 stepper_x/y] tuning as tmc-autotune, opposite intent; test autotune
//   - klipper-hooks                                              -> device-confirmed to HALT Klipper on the U1: it overrides PRINT_START/PRINT_END/
//                                                                   CANCEL_PRINT with rename_existing, but the U1 stock config already defines those as
//                                                                   [gcode_macro PRINT_START] etc., and Klipper's RawConfigParser(strict=False) MERGES the
//                                                                   two same-named sections into one, leaving the rename no distinct base command to
//                                                                   capture -> "Existing command 'PRINT_START' not found" -> printer halts. It is an
//                                                                   experiment-channel plugin whose own manifest says "not yet verified on a physical
//                                                                   printer"; this run is that verification, and it is a reported finding, not a silent skip.
// Everything else installs and is proven live here. rfid-ntag, spoolman and afc-lite need NO tag/spool
// to prove they loaded (their Klipper/Moonraker integration is present); the cameras prove their
// streamer holds a live pid and is registered without a human eyeballing the picture.
//
// The batch is the point: the daemon applies all of them and restarts klipper/moonraker/camera-streamers
// ONCE at the end, instead of back-to-back restarts that have wedged the U1 display. Each plugin carries
// its full resolved variable set (defaults plus the operator's values), exactly what the store form
// posts, so no template placeholder is left unrendered - the suite fails if any does.
//
// Run: B3D_DEVICE_TARGET=real-u1 B3D_HIL_HOST=192.0.2.109 \
//        npx vitest run --config vitest.invitro.config.ts real-plugin-batch-install
const PORT = 2242
const WORKSPACE = '/Users/lucio/Code/Bespok3d_org'
const IDLE_TIMEOUT_SECONDS = '900'
const FLUIDD_PORT = 80
const MAINSAIL_PORT = 81
const PROMETHEUS_PORT = 9101
const TMC_AUTOTUNE_DRIVER_TBL = 1
const REMOTE_SCREEN_NAME = 'Printer Screen'

const SPOOLMAN_VARS = {
  SPOOLMAN_SERVER: '192.0.2.35:8000',
  SPOOLMAN_MODE: 'auto',
  SPOOLMAN_LOGGING: 'info',
  CARD_UIDS_STRATEGY: 'spool_id,uid,sku',
  CARD_UIDS_AUTO_REGISTER: 'false',
  SPOOLMAN_TRACK_LOCATION: 'false',
  SPOOLMAN_LOCATION: 'unU1jr',
}

const CAMERA_HW_VARS = {
  WEBRTC_ENABLED: '1',
  CAMERA_RESOLUTION: '1080p',
  WEBRTC_SESSION_TIMEOUT_MIN: '0',
}

function pkg(pluginId: string, relPath: string, vars?: Record<string, string>): BatchUpdatePackage {
  return { pluginId, bytes: readFileSync(`${WORKSPACE}/${relPath}`), vars }
}

// Ordered so shared building blocks land before the plugins that build on them (print-prefs-core before
// the force-* macros; the timelapse component before force-timelapse; remote-screen before its webcam
// registration). The daemon applies the whole batch before its single restart, so order only decides
// last-writer-wins on a shared file - none of these overlap - but it keeps the intent legible.
const PACKAGES: BatchUpdatePackage[] = [
  pkg('rfid-ntag', 'plugins/u1-enhanced-rfid/dist/rfid-ntag-0.1.7.b3'),
  pkg('spoolman', 'plugins/spoolman-klipper-helper/dist/spoolman-0.1.29.b3', SPOOLMAN_VARS),
  pkg('afc-lite', 'plugins/u1-afc-lite/dist/afc-lite-0.1.7.b3'),
  pkg('camera-hw-accel', 'plugins/u1-hw-camera/dist/camera-hw-accel-0.1.8.b3', CAMERA_HW_VARS),
  pkg('webcam-builtin', 'plugins/u1-camera-configs/dist/webcam-builtin-0.1.1.b3', { BUILTIN_CAMERA_NAME: 'internal' }),
  pkg('webcam-usb', 'plugins/u1-camera-configs/dist/webcam-usb-0.1.1.b3', { USB_CAMERA_NAME: 'external' }),
  pkg('fluidd', 'plugins/fluidd-plugin/dist/fluidd-0.1.5.b3', { FLUIDD_PORT: String(FLUIDD_PORT) }),
  pkg('mainsail', 'plugins/mainsail-plugin/dist/mainsail-0.1.5.b3', { MAINSAIL_PORT: String(MAINSAIL_PORT) }),
  pkg('idle-timeout', 'plugins/u1-klipper-config-enhancers/dist/idle-timeout-0.1.0.b3', { IDLE_TIMEOUT_SECONDS }),
  pkg('cpu-temp', 'plugins/u1-klipper-config-enhancers/dist/cpu-temp-0.1.2.b3'),
  pkg('object-processing', 'plugins/u1-klipper-config-enhancers/dist/object-processing-0.1.1.b3'),
  pkg('purge-line-back', 'plugins/u1-klipper-config-enhancers/dist/purge-line-back-0.1.1.b3'),
  pkg('u1-gcode-colors', 'plugins/u1-extras/dist/u1-gcode-colors-0.1.1.b3', { GCODE_COLORS_ENABLED: 'true' }),
  pkg('system-utils', 'plugins/u1-extras/dist/system-utils-0.1.1.b3'),
  pkg('wled', 'plugins/u1-extras/dist/wled-0.1.0.b3', { WLED_NAME: 'status', WLED_ADDRESS: '169.254.7.5', WLED_CHAIN_COUNT: '30' }),
  pkg('prometheus-exporter', 'plugins/u1-extras/dist/prometheus-exporter-0.1.1.b3'),
  pkg('moonraker-notify', 'plugins/u1-extras/dist/moonraker-notify-0.1.0.b3', {
    APPRISE_URL: 'json://127.0.0.1:1/bespok3d-hil',
    NOTIFY_NAME: 'bespok3d-hil',
  }),
  pkg('klipper-motion', 'plugins/u1-motion-tweaks/dist/klipper-motion-0.1.2.b3'),
  pkg('tmc-autotune', 'plugins/u1-motion-tweaks/dist/tmc-autotune-0.1.1.b3'),
  pkg('print-prefs-core', 'plugins/u1-force-macros/dist/print-prefs-core-0.1.1.b3'),
  pkg('timelapse', 'plugins/fluidd-timelapse/dist/timelapse-0.1.1.b3'),
  pkg('force-bed-mesh-adaptive', 'plugins/u1-force-macros/dist/force-bed-mesh-adaptive-0.1.1.b3'),
  pkg('force-timelapse', 'plugins/u1-force-macros/dist/force-timelapse-0.1.1.b3'),
  pkg('print-time-human', 'plugins/reference-python-plugins/dist/print-time-human-0.1.1.b3'),
  pkg('moonraker-auth', 'plugins/moonraker-auth/dist/moonraker-auth-0.1.1.b3', { FORCE_LOGINS: 'false' }),
  pkg('status-feed', 'plugins/reference-python-plugins/dist/status-feed-0.1.0.b3'),
  pkg('remote-screen', 'plugins/u1-remote-screen/dist/remote-screen-0.1.20.b3'),
  pkg('webcam-screen', 'plugins/u1-camera-configs/dist/webcam-screen-0.1.1.b3', { REMOTE_SCREEN_NAME }),
  pkg('tun-module', 'plugins/networking/dist/tun-module-0.1.0.b3'),
]

const EXPECTED_IDS = PACKAGES.map((entry) => entry.pluginId)

const harness = { target: null as DeviceTarget | null }
// The healthy snapshot captured once the coordinated restart settles, so every effects test reads the
// same post-install state the health test verified instead of re-racing the restart.
const settled = { snapshot: null as DeviceProbe | null }

interface DeviceProbe {
  klipperState: string | null
  klippyState: string | null
  printState: string | null
  failedComponents: string[]
  // Klipper-side config actuations (lowercased section keys from configfile.settings).
  idleTimeout: string | null
  klipperSections: string[]
  tmcStepperXDriverTbl: number | null
  toolheadCentripetalPatched: boolean
  // Moonraker-side actuations.
  moonrakerSections: string[]
  moonrakerComponents: string[]
  objectProcessingEnabled: boolean
  authForceLogins: boolean | null
  webcamNames: string[]
  // Services + endpoints.
  fluiddCode: number
  fluiddIsFluidd: boolean
  mainsailCode: number
  mainsailIsMainsail: boolean
  prometheusServesMetrics: boolean
  screenProxyCode: number
  remoteScreenAlive: boolean
  statusFeedAlive: boolean
  cameraStreamerAlive: boolean
  // Filesystem effects.
  tunExists: boolean
  systemUtilsCurl: boolean
  systemUtilsRsync: boolean
}

// One on-device round trip gathering every fact the suite asserts, kept to a single exec so the whole
// post-install picture is one consistent read. Klipper config comes from Moonraker's configfile object
// (result.status.configfile.settings - lowercased section keys); Moonraker's own config, components and
// webcam registry come from its /server endpoints; the HTTP checks fetch each served UI/endpoint; the
// pid checks read the plugin pidfiles and signal 0 (busybox `ps -w` hides args, so a pidfile + kill -0
// is the only reliable liveness signal on the U1); the filesystem checks confirm placed binaries and the
// patched Klipper source.
const PROBE_SCRIPT = `python3 <<'PY'
import glob
import json
import os
import urllib.request

BESPOK3D = "/userdata/bespok3d"

def moon(path):
    try:
        with urllib.request.urlopen("http://127.0.0.1:7125" + path, timeout=12) as response:
            return json.load(response).get("result", {})
    except Exception:
        return {}

def klipper_configfile():
    status = moon("/printer/objects/query?configfile").get("status", {})
    return status.get("configfile", {})

def http(url, needle):
    try:
        with urllib.request.urlopen(url, timeout=8) as response:
            body = response.read(60000).decode("utf-8", "replace").lower()
            return response.status, (needle in body)
    except Exception:
        return 0, False

def pid_alive(name):
    try:
        with open(os.path.join(BESPOK3D, "run", name)) as handle:
            pid = int(handle.read().strip())
        os.kill(pid, 0)
        return True
    except Exception:
        return False

def any_streamer_alive():
    pidfiles = glob.glob(os.path.join(BESPOK3D, "run", "capture-*.pid")) + glob.glob(os.path.join(BESPOK3D, "run", "stream-*.pid"))
    for path in pidfiles:
        try:
            with open(path) as handle:
                os.kill(int(handle.read().strip()), 0)
            return True
        except Exception:
            continue
    return False

def executable(path):
    return os.path.isfile(path) and os.access(path, os.X_OK)

def toolhead_has(needle):
    try:
        with open("/home/lava/klipper/klippy/toolhead.py") as handle:
            return needle in handle.read()
    except Exception:
        return False

info = moon("/server/info")
webhooks = moon("/printer/objects/query?webhooks").get("status", {}).get("webhooks", {})
print_stats = moon("/printer/objects/query?print_stats").get("status", {}).get("print_stats", {})
configfile = klipper_configfile()
settings = configfile.get("settings", {})
raw_sections = configfile.get("config", {})
idle = settings.get("idle_timeout", {})
tmc_x = settings.get("tmc2240 stepper_x", {})
mcfg = moon("/server/config").get("config", {})
file_manager = mcfg.get("file_manager", {})
authorization = mcfg.get("authorization", {})
webcams = moon("/server/webcams/list").get("webcams", [])
# The scross01 exporter serves its OWN Go-runtime metrics at bare /metrics; the printer's metrics come
# from the multi-target /probe?target=<moonraker> endpoint, so that is the one that proves it can read
# Klipper (33 klipper_* series on junior) rather than merely that the Go process is up.
prometheus_code, prometheus_ok = http("http://127.0.0.1:${PROMETHEUS_PORT}/probe?target=127.0.0.1:7125", "klipper_")
fluidd_code, fluidd_is = http("http://127.0.0.1:${FLUIDD_PORT}/", "fluidd")
mainsail_code, mainsail_is = http("http://127.0.0.1:${MAINSAIL_PORT}/", "mainsail")
screen_code, _screen = http("http://127.0.0.1:${FLUIDD_PORT}/screen/", "")

print(json.dumps({
    "klipperState": webhooks.get("state"),
    "klippyState": info.get("klippy_state"),
    "printState": print_stats.get("state"),
    "failedComponents": info.get("failed_components", []),
    "idleTimeout": str(idle.get("timeout")) if idle.get("timeout") is not None else None,
    "klipperSections": sorted(set(settings.keys()) | set(raw_sections.keys())),
    "tmcStepperXDriverTbl": tmc_x.get("driver_tbl"),
    "toolheadCentripetalPatched": toolhead_has("move_centripetal_v2"),
    "moonrakerSections": sorted(mcfg.keys()),
    "moonrakerComponents": sorted(info.get("components", [])),
    "objectProcessingEnabled": bool(file_manager.get("enable_object_processing")),
    "authForceLogins": authorization.get("force_logins"),
    "webcamNames": [entry.get("name") for entry in webcams],
    "fluiddCode": fluidd_code,
    "fluiddIsFluidd": fluidd_is,
    "mainsailCode": mainsail_code,
    "mainsailIsMainsail": mainsail_is,
    "prometheusServesMetrics": prometheus_code == 200 and prometheus_ok,
    "screenProxyCode": screen_code,
    "remoteScreenAlive": pid_alive("remote-screen.pid"),
    "statusFeedAlive": pid_alive("status-feed.pid"),
    "cameraStreamerAlive": any_streamer_alive(),
    "tunExists": os.path.exists("/dev/net/tun"),
    "systemUtilsCurl": executable(os.path.join(BESPOK3D, "bin", "curl")),
    "systemUtilsRsync": executable(os.path.join(BESPOK3D, "bin", "rsync")),
}))
PY`

function device(): DeviceTarget {
  return harness.target!
}

function record(): PrinterRecord {
  return device().daemonRecord()
}

async function probe(): Promise<DeviceProbe> {
  return JSON.parse(await device().session().exec(PROBE_SCRIPT)) as DeviceProbe
}

function idleSeconds(snapshot: DeviceProbe): number {
  return Math.round(Number(snapshot.idleTimeout))
}

function hasKlipperSection(snapshot: DeviceProbe, marker: string): boolean {
  return snapshot.klipperSections.some((section) => section.includes(marker))
}

function hasMoonrakerSection(snapshot: DeviceProbe, marker: string): boolean {
  return snapshot.moonrakerSections.some((section) => section.includes(marker))
}

// The coordinated restart reloads Klipper and Moonraker, so poll until both report ready rather than
// reading once and racing the restart. Ready means Klipper's webhooks state and Moonraker's klippy_state
// both say ready, which is the same signal the app waits on before calling an install settled.
async function waitForHealthy(attemptsLeft: number): Promise<DeviceProbe> {
  const snapshot = await probe()
  const ready = snapshot.klipperState === 'ready' && snapshot.klippyState === 'ready'
  if (ready) return snapshot
  if (attemptsLeft <= 0) {
    throw new Error(`printer never returned to ready after the batch (last probe: ${JSON.stringify(snapshot)})`)
  }
  await new Promise((done) => setTimeout(done, 3000))

  return waitForHealthy(attemptsLeft - 1)
}

async function installedIds(): Promise<string[]> {
  return Object.keys((await fetchCapabilities(record())).installed)
}

function settledSnapshot(): DeviceProbe {
  const snapshot = settled.snapshot
  if (snapshot === null) throw new Error('no settled snapshot: the health test must run before the effects tests')

  return snapshot
}

beforeAll(async () => {
  harness.target = makeDeviceTarget(PORT)
  await harness.target.prepare()
  // Refuse to mutate a printing machine: the batch restarts Klipper, which would abort a live print.
  const stock = await probe()
  expect(stock.printState, 'refusing to run against a printing machine').not.toBe('printing')
  expect(stock.printState).not.toBe('paused')
}, 300000)

afterAll(async () => {
  await harness.target?.teardown()
}, 300000)

describe('standard procedure: real-hardware batch install of the full in-scope plugin roster', () => {
  it('installs every in-scope plugin in one coordinated restart, each config rendered', async () => {
    const outcome = await installBatchPackages(record(), PACKAGES)

    const failures = outcome.results.filter((entry) => !entry.ok || entry.skipped)
    expect(failures, JSON.stringify(failures)).toEqual([])
    expect(outcome.ok).toBe(true)
    // The daemon returns one synthetic '(services)' entry for the single coordinated restart, alongside
    // one entry per plugin. Assert every plugin id landed rather than an exact-length match.
    const resultIds = outcome.results.map((entry) => entry.pluginId)
    EXPECTED_IDS.forEach((pluginId) => expect(resultIds).toContain(pluginId))
  }, 900000)

  it('the printer returns to ready with no failed components, every plugin present, nothing unrendered', async () => {
    const snapshot = await waitForHealthy(80)
    settled.snapshot = snapshot
    console.log('[batch] settled probe:', JSON.stringify(snapshot))
    expect(snapshot.failedComponents, JSON.stringify(snapshot.failedComponents)).toEqual([])
    expect(snapshot.printState).not.toBe('printing')

    const present = await installedIds()
    EXPECTED_IDS.forEach((pluginId) => expect(present).toContain(pluginId))
    // A literal '$' in any loaded section name means a template variable never rendered - the exact
    // symptom that made the Remote Screen webcam and the notifier land half-configured before.
    const unrendered = [...snapshot.klipperSections, ...snapshot.moonrakerSections].filter((section) => section.includes('$'))
    expect(unrendered, `unrendered template vars in loaded config: ${JSON.stringify(unrendered)}`).toEqual([])
  }, 300000)

  it('Klipper-config plugins reached the loaded config with the value/name each sets', async () => {
    const snapshot = settledSnapshot()
    expect(idleSeconds(snapshot), 'idle-timeout override reached Klipper config').toBe(Number(IDLE_TIMEOUT_SECONDS))
    expect(hasKlipperSection(snapshot, 'temperature_sensor rockchip'), 'cpu-temp added its named sensor').toBe(true)
    expect(hasKlipperSection(snapshot, 'gcode_macro dk_print_start_line'), 'purge-line-back added its macro').toBe(true)
    expect(hasKlipperSection(snapshot, 'gcode_macro bed_mesh_calibrate'), 'force-bed-mesh-adaptive overrode the macro').toBe(true)
    expect(hasKlipperSection(snapshot, 'gcode_macro timelapse_start'), 'force-timelapse added its macro').toBe(true)
    expect(hasKlipperSection(snapshot, 'print_time_human'), 'print-time-human loaded its module').toBe(true)
    expect(hasKlipperSection(snapshot, 'afc'), 'afc-lite loaded its config section').toBe(true)
    expect(hasKlipperSection(snapshot, 'rfid'), 'rfid-ntag loaded its reader section').toBe(true)
    expect(hasKlipperSection(snapshot, 'spoolman'), 'spoolman loaded its Klipper helper section').toBe(true)
    // tmc-autotune overrides the STOCK [tmc2240 stepper_x] section, so presence proves nothing; assert
    // the tuned value it writes.
    expect(snapshot.tmcStepperXDriverTbl, 'tmc-autotune wrote its tuned driver_TBL').toBe(TMC_AUTOTUNE_DRIVER_TBL)
    // klipper-motion patches the running Klipper source; its centripetal junction code must be present.
    expect(snapshot.toolheadCentripetalPatched, 'klipper-motion patched the live toolhead source').toBe(true)
  }, 120000)

  it('Moonraker-side plugins registered their component/section', async () => {
    const snapshot = settledSnapshot()
    expect(snapshot.objectProcessingEnabled, 'object-processing enabled file_manager preprocessing').toBe(true)
    expect(hasMoonrakerSection(snapshot, 'wled'), 'wled registered its Moonraker section').toBe(true)
    expect(snapshot.moonrakerComponents, 'timelapse component loaded').toContain('timelapse')
    expect(hasMoonrakerSection(snapshot, 'timelapse'), 'timelapse configured its Moonraker section').toBe(true)
    expect(snapshot.moonrakerComponents, 'spoolman component loaded').toContain('spoolman')
    expect(snapshot.moonrakerComponents, 'moonraker-notify registered the notifier').toContain('notifier')
    expect(hasMoonrakerSection(snapshot, 'gcode_preview'), 'u1-gcode-colors registered its Moonraker section').toBe(true)
    // moonraker-auth writes [authorization] force_logins; assert the value we posted reached Moonraker.
    expect(snapshot.authForceLogins, 'moonraker-auth applied force_logins').toBe(false)
  }, 120000)

  it('service and endpoint plugins are actually serving', async () => {
    const snapshot = settledSnapshot()
    expect(snapshot.fluiddCode, 'fluidd serves its web UI on its port').toBe(200)
    expect(snapshot.fluiddIsFluidd).toBe(true)
    expect(snapshot.mainsailCode, 'mainsail serves its web UI on its port').toBe(200)
    expect(snapshot.mainsailIsMainsail).toBe(true)
    expect(snapshot.prometheusServesMetrics, 'prometheus-exporter serves Klipper metrics').toBe(true)
    expect(snapshot.remoteScreenAlive, 'remote-screen holds a live pid').toBe(true)
    expect(snapshot.screenProxyCode, 'remote-screen /screen/ proxy serves').toBe(200)
    expect(snapshot.statusFeedAlive, 'status-feed holds a live pid').toBe(true)
    expect(snapshot.cameraStreamerAlive, 'camera-hw-accel holds a live streamer pid').toBe(true)
    // The cameras and the Remote Screen must be app-visible camera sources, not just files on disk.
    expect(snapshot.webcamNames, 'webcam-builtin registered').toContain('internal')
    expect(snapshot.webcamNames, 'webcam-usb registered').toContain('external')
    expect(snapshot.webcamNames, 'webcam-screen registered the Remote Screen').toContain(REMOTE_SCREEN_NAME)
  }, 120000)

  it('filesystem-effect plugins placed their artifacts', async () => {
    const snapshot = settledSnapshot()
    expect(snapshot.tunExists, 'tun-module loaded /dev/net/tun').toBe(true)
    expect(snapshot.systemUtilsCurl, 'system-utils installed curl').toBe(true)
    expect(snapshot.systemUtilsRsync, 'system-utils installed rsync').toBe(true)
  }, 120000)
})
