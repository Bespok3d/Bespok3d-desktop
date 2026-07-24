import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createHash } from 'node:crypto'
import AdmZip from 'adm-zip'
import '@adapters/snapmaker-u1/client/snapmaker-u1'
import {
  deactivateAll, fetchAccessClients, fetchCapabilities, fetchSelfCheck, grantAccess,
  installPlugin, isAccessGranted, reconfigurePlugin, requestAccess, revokeAccess, teardownDaemon,
  uninstallPlugin, updateBatchPackages,
} from '../../src/main/daemon-client/client'
import type { PrinterRecord } from '../../src/main/printers'
import { makeDeviceTarget } from './device-target'
import type { DeviceTarget } from './device-target'

// The plugin LIFECYCLE driven through the REAL daemon-client <-> daemon HTTP contract against a real
// daemon over cert-pinned HTTPS. This is the seam nothing else exercises: the daemon FS-integration tests
// call packages.py DIRECTLY (not over HTTP), and the renderer cage drives a MOCKED daemon. So a drift in
// the multipart-install / 409 envelope / DELETE-cascade contract (audit section 6, the top silent-drift
// risk) would slip past both. Off the fast gate; runs via scripts/invitro.sh.
//
// Driven through the DeviceTarget seam (like recover.invitro.test.ts), so the SAME suite runs against the
// Docker fake device today and the real U1 test bot via B3D_DEVICE_TARGET=real-u1, no rewrite. The seam's
// DockerDevice deploys the real adapter jinni, so ops that read the device's klipper config paths
// (deactivate/teardown) resolve the way they do on a real printer. Plugins are built inline as minimal
// `start: []` config-symlink packages: the daemon injects jinni.paths() server-side, so a symlink into
// $BESPOK3D needs no client-sent vars and restarts no services. Covered: install + uninstall round-trip,
// the 409 conflict envelope, the 409 dependents envelope + cascade, selfcheck-drift, update-batch,
// reconfigure (template re-render), deactivate, teardown, and the access flow (requestAccess -> grant ->
// revoke). print-guard 400 stays RealU1-only (needs a live Moonraker mid-print). See backlog 1.
const PORT = 2227
const harness = { target: null as DeviceTarget | null }

function device(): DeviceTarget {
  return harness.target!
}

function record(): PrinterRecord {
  return device().daemonRecord()
}

// A record for a freshly-granted second client: same pinned cert + host, its own bearer token.
function secondRecord(token: string): PrinterRecord {
  return { ...record(), daemonToken: token } as PrinterRecord
}

// Cleanup in a finally must never mask the real assertion failure, but a fully swallowed cleanup error
// hides genuine teardown bugs; log it instead of dropping it on the floor.
function logCleanup(cleanupError: unknown): void {
  console.warn('[invitro cleanup]', cleanupError)
}

// A minimal valid .b3: a config file symlinked into $BESPOK3D (legacy install shape, no service restart).
// Optional `templates` render a packaged `.tmpl` (with `extraFiles`) into the plugin dir, expanding a
// user var, so reconfigure has something to re-render.
interface PluginSpec {
  name: string
  version?: string
  provides?: string[]
  depends?: string[]
  conflicts?: string[]
  templates?: Array<{ from: string; to: string }>
  extraFiles?: Array<{ path: string; content: string }>
}
function sha256Hex(payload: Buffer): string {
  return createHash('sha256').update(payload).digest('hex')
}

function buildPackage(spec: PluginSpec): Buffer {
  const probeConfig = Buffer.from(`# ${spec.name}\n`)
  const packagedExtras = (spec.extraFiles ?? []).map((extra) => ({
    path: extra.path, bytes: Buffer.from(extra.content),
  }))
  // The daemon refuses any archive member the manifest never declared (members.py: undeclared payload
  // is unsigned), verify_files treats a declared entry with no sha256 as a mismatch, and apply_modes
  // chmods every declared file by its octal mode (KeyError otherwise, which trips auto-deactivate), so
  // every packaged file is listed here with its real hash and a mode, exactly as b3-builder emits.
  const declaredFiles = [
    { path: 'files/probe.cfg', sha256: sha256Hex(probeConfig), mode: '644' },
    ...packagedExtras.map((extra) => ({ path: extra.path, sha256: sha256Hex(extra.bytes), mode: '644' })),
  ]
  const manifest = {
    name: spec.name,
    version: spec.version ?? '1.0.0',
    provides: spec.provides ?? [],
    depends: spec.depends ?? [],
    conflicts: spec.conflicts ?? [],
    install: {
      dirs: [],
      symlinks: [{ from: 'files/probe.cfg', to: `$BESPOK3D/${spec.name}.cfg` }],
      patches: [],
      templates: spec.templates ?? [],
      start: [],
    },
    files: declaredFiles,
  }
  const zip = new AdmZip()
  zip.addFile('manifest.json', Buffer.from(JSON.stringify(manifest)))
  zip.addFile('files/probe.cfg', probeConfig)
  packagedExtras.forEach((extra) => zip.addFile(extra.path, extra.bytes))

  return zip.toBuffer()
}

async function installedIds(): Promise<string[]> {
  const caps = await fetchCapabilities(record())

  return Object.keys(caps.installed)
}

beforeAll(async () => {
  harness.target = makeDeviceTarget(PORT)
  await harness.target.prepare()
}, 120000)

afterAll(async () => {
  await harness.target?.teardown()
})

describe('in-vitro plugin lifecycle (real daemon-client over the wire)', () => {
  it('install -> capabilities -> uninstall round-trips over real HTTPS', async () => {
    const log = await installPlugin(record(), buildPackage({ name: 'invitro-probe' }), 'invitro-probe')
    expect(log.ok).toBe(true)
    expect(log.pluginId).toBe('invitro-probe')

    const caps = await fetchCapabilities(record())
    expect(caps.installed['invitro-probe']).toBe('1.0.0')

    const removed = await uninstallPlugin(record(), 'invitro-probe')
    expect(removed).toContain('invitro-probe')
    expect(await installedIds()).not.toContain('invitro-probe')
  })

  it('rejects a conflicting install with HTTP 409 (the conflict envelope)', async () => {
    await installPlugin(record(), buildPackage({ name: 'invitro-alpha' }), 'invitro-alpha')
    try {
      const conflicting = buildPackage({ name: 'invitro-beta', conflicts: ['invitro-alpha'] })
      await expect(installPlugin(record(), conflicting, 'invitro-beta')).rejects.toMatchObject({
        name: 'DaemonHttpError', statusCode: 409,
      })
      expect(await installedIds()).not.toContain('invitro-beta')
    } finally {
      await uninstallPlugin(record(), 'invitro-alpha').catch(logCleanup)
    }
  })

  it('blocks uninstall of a depended-on plugin with HTTP 409, and cascade removes both', async () => {
    await installPlugin(record(), buildPackage({ name: 'invitro-core', provides: ['invitro-svc'] }), 'invitro-core')
    await installPlugin(record(), buildPackage({ name: 'invitro-leaf', depends: ['invitro-svc'] }), 'invitro-leaf')
    try {
      await expect(uninstallPlugin(record(), 'invitro-core')).rejects.toMatchObject({
        name: 'DaemonHttpError', statusCode: 409,
      })
      const removed = await uninstallPlugin(record(), 'invitro-core', true)
      expect(removed).toEqual(expect.arrayContaining(['invitro-core', 'invitro-leaf']))
      const ids = await installedIds()
      expect(ids).not.toContain('invitro-core')
      expect(ids).not.toContain('invitro-leaf')
    } finally {
      await uninstallPlugin(record(), 'invitro-leaf', true).catch(logCleanup)
      await uninstallPlugin(record(), 'invitro-core', true).catch(logCleanup)
    }
  })

  it('selfcheck reports drift over the wire once an installed symlink is removed', async () => {
    await installPlugin(record(), buildPackage({ name: 'invitro-selfcheck' }), 'invitro-selfcheck')
    try {
      const clean = await fetchSelfCheck(record())
      expect(clean.drift.some((entry) => entry.plugin_id === 'invitro-selfcheck')).toBe(false)

      // Remove the placed symlink under the workspace (path-agnostic) to simulate post-OTA / tamper drift.
      // -exec rm, not -delete: the U1's busybox find has no -delete, and a swallowed error would leave the
      // symlink in place and mask real drift. -exec rm -f {} + works on both busybox and GNU find.
      await device().session().exec('find /userdata -name invitro-selfcheck.cfg -exec rm -f {} +')

      const drifted = await fetchSelfCheck(record())
      expect(drifted.ok).toBe(false)
      expect(drifted.drift.some((entry) => entry.plugin_id === 'invitro-selfcheck')).toBe(true)
    } finally {
      await uninstallPlugin(record(), 'invitro-selfcheck', true).catch(logCleanup)
    }
  })

  it('update-batch upgrades an installed plugin to a newer version over the wire', async () => {
    await installPlugin(record(), buildPackage({ name: 'invitro-upd', version: '1.0.0' }), 'invitro-upd')
    expect((await fetchCapabilities(record())).installed['invitro-upd']).toBe('1.0.0')
    try {
      const next = buildPackage({ name: 'invitro-upd', version: '2.0.0' })
      const result = await updateBatchPackages(record(), [{ pluginId: 'invitro-upd', bytes: next }])
      expect(result).toHaveProperty('results')
      expect((await fetchCapabilities(record())).installed['invitro-upd']).toBe('2.0.0')
    } finally {
      await uninstallPlugin(record(), 'invitro-upd', true).catch(logCleanup)
    }
  })

  it('reconfigure re-renders a plugin template from new vars over the wire', async () => {
    const templated = buildPackage({
      name: 'invitro-tmpl',
      templates: [{ from: 'files/conf.tmpl', to: 'rendered/conf.cfg' }],
      extraFiles: [{ path: 'files/conf.tmpl', content: 'server: $RECONF_SERVER\n' }],
    })
    const renderedPath = '/userdata/bespok3d/usr/local/plugins/invitro-tmpl/rendered/conf.cfg'
    await installPlugin(record(), templated, 'invitro-tmpl', { RECONF_SERVER: 'http://first.local:7912' })
    try {
      expect((await device().session().getContent(renderedPath)).trim()).toBe('server: http://first.local:7912')

      const log = await reconfigurePlugin(record(), 'invitro-tmpl', { RECONF_SERVER: 'http://second.local:7912' })
      expect(log.ok).toBe(true)
      expect(log.pluginId).toBe('invitro-tmpl')
      expect((await device().session().getContent(renderedPath)).trim()).toBe('server: http://second.local:7912')
    } finally {
      await uninstallPlugin(record(), 'invitro-tmpl', true).catch(logCleanup)
    }
  })

  it('requestAccess -> grant -> revoke flows over the wire with a second identity', async () => {
    const secondToken = 'invitrosecondclienttoken00000001'
    try {
      // requestAccess (unauthenticated) appends a pending entry; grant pops it; revoke drops the token.
      const granted = await requestAccess({
        ip: record().ip, label: 'Second computer', identity: 'second-client', token: secondToken, publicKey: '',
      })
      expect(granted.ok).toBe(true)
      expect(granted.cert).toContain('BEGIN CERTIFICATE')

      const beforeGrant = await fetchAccessClients(record())
      expect(beforeGrant.pending.some((pending) => pending.identity === 'second-client')).toBe(true)
      expect(beforeGrant.clients.some((client) => client.identity === 'second-client')).toBe(false)
      expect(await isAccessGranted(secondRecord(secondToken))).toBe(false)

      await grantAccess(record(), 'second-client')
      expect(await isAccessGranted(secondRecord(secondToken))).toBe(true)
      const afterGrant = await fetchAccessClients(record())
      expect(afterGrant.clients.some((client) => client.identity === 'second-client')).toBe(true)
      expect(afterGrant.pending.some((pending) => pending.identity === 'second-client')).toBe(false)

      await revokeAccess(record(), 'second-client')
      expect(await isAccessGranted(secondRecord(secondToken))).toBe(false)
      const afterRevoke = await fetchAccessClients(record())
      expect(afterRevoke.clients.some((client) => client.identity === 'second-client')).toBe(false)
    } finally {
      // Restore the ACL + pending store as found, even if an assertion threw mid-flow (the request
      // mutates both before the asserts complete). Revoke is idempotent; pending.json is per-container.
      await revokeAccess(record(), 'second-client').catch(logCleanup)
      await device().session().exec('rm -f /userdata/bespok3d/auth/pending.json').catch(logCleanup)
    }
  })

  // deactivate + teardown run LAST: deactivate writes the global deactivated marker, teardown removes
  // every installed plugin. Both need the device's klipper config paths (PRINTER_CFG/MOONRAKER_CFG),
  // which is why the harness deploys the real adapter jinni (deployAdapterJinni) instead of the generic
  // fallback that lacks them. They share /oem/printer_data/config/moonraker.conf (each rewrites it as
  // its own setup, last-writer-wins); the --rm container is dropped in afterAll, so the file need not
  // be restored. Ordering matters (a test after these would see a stripped include / global marker /
  // removed plugins), so the in-vitro vitest config pins sequence.shuffle:false.
  it('deactivateAll neutralizes an installed plugin and strips the bespok3d include over the wire', async () => {
    const moonrakerCfg = '/oem/printer_data/config/moonraker.conf'
    await device().session().exec('mkdir -p /oem/printer_data/config')
    await device().session().putContent(moonrakerCfg, '[server]\nhost: 0.0.0.0\n[include bespok3d/moonraker/*.cfg]\n')
    await installPlugin(record(), buildPackage({ name: 'invitro-deact' }), 'invitro-deact')
    const linkPath = '/userdata/bespok3d/invitro-deact.cfg'
    const pluginDir = '/userdata/bespok3d/usr/local/plugins/invitro-deact'
    expect((await device().session().exec(`test -L ${linkPath} && echo yes || echo no`)).trim()).toBe('yes')
    try {
      await deactivateAll(record())
      // deactivate_all drops each plugin's symlinks but keeps its files, strips the bespok3d include
      // lines, and writes the GLOBAL deactivated marker (etc/deactivated) - reversible, unlike teardown.
      // It does NOT write a per-plugin deactivated.json (that is the safety-net auto-deactivate path),
      // so the capabilities `deactivated` list stays empty here; the global marker is the signal.
      expect((await device().session().exec(`test -L ${linkPath} && echo yes || echo no`)).trim()).toBe('no')
      expect((await device().session().exec(`test -d ${pluginDir} && echo yes || echo no`)).trim()).toBe('yes')
      expect((await device().session().exec('test -f /userdata/bespok3d/etc/deactivated && echo yes || echo no')).trim()).toBe('yes')
      const cfgAfter = await device().session().getContent(moonrakerCfg)
      expect(cfgAfter).toContain('[server]')
      expect(cfgAfter).not.toContain('[include bespok3d/moonraker')
    } finally {
      await device().session().exec(
        'rm -rf /userdata/bespok3d/usr/local/plugins/invitro-deact /userdata/bespok3d/etc/deactivated',
      ).catch(logCleanup)
    }
  })

  it('teardownDaemon removes all plugins and strips the bespok3d include over the wire', async () => {
    const moonrakerCfg = '/oem/printer_data/config/moonraker.conf'
    await device().session().exec('mkdir -p /oem/printer_data/config')
    await device().session().putContent(moonrakerCfg, '[server]\nhost: 0.0.0.0\n[include bespok3d/moonraker/*.cfg]\n')
    await installPlugin(record(), buildPackage({ name: 'invitro-tear' }), 'invitro-tear')
    expect((await fetchCapabilities(record())).installed).toHaveProperty('invitro-tear')

    await teardownDaemon(record())

    expect((await fetchCapabilities(record())).installed).not.toHaveProperty('invitro-tear')
    const cfgAfter = await device().session().getContent(moonrakerCfg)
    expect(cfgAfter).toContain('[server]')
    expect(cfgAfter).not.toContain('[include bespok3d/moonraker')
  })
})
