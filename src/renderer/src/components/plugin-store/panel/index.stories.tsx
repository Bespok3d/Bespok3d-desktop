import { useState } from 'react'
import { PluginPanel } from '.'
import { makePlugin, makeSource, makePrinter, makeInstallLog } from '../../../test/fixtures'
import type { Plugin, Printer, PluginConfigField } from '../../../data/types'
import { migrateFlatVars, printerVarsView, saveValuesToScopes, effectiveScope, printerKeyFor } from '../../../data/plugin-vars'
import type { ScopedPluginVars } from '../../../data/plugin-vars'
import '../plugin-store.css'

export default { title: 'Store / Plugin detail' }

const PRINTER = makePrinter({ id: 'printer-1', status: 'managed' })

function noop() {}

const BASIC_PLUGIN = makePlugin({
  id: 'cpu-temp', name: 'cpu-temp', title: 'CPU Temperature', category: 'sensors',
  tagline: 'Rockchip CPU temp sensor',
  description: 'Adds a temperature_sensor for the Rockchip SoC so it shows up in Fluidd/Mainsail.',
})

const SPOOLMAN_FIELDS: PluginConfigField[] = [
  { key: 'SPOOLMAN_SERVER', label: 'Server URL', type: 'text', scope: 'global', required: true, placeholder: 'http://host:7912', hint: 'Moonraker reads spool data from this address.' },
  { key: 'SPOOLMAN_MODE', label: 'Mode', type: 'select', options: ['auto', 'manual'], default: 'auto', scope: 'global' },
  { key: 'SPOOLMAN_LOCATION', label: 'Location', type: 'text', scope: 'printer', hint: 'Where THIS printer files its spools in Spoolman.' },
]
const SPOOLMAN_PLUGIN = makePlugin({
  id: 'spoolman', name: 'spoolman', title: 'Spoolman', category: 'filament',
  tagline: 'Track the active spool', description: 'Zero-patch Moonraker integration with Spoolman.',
  config: SPOOLMAN_FIELDS,
})

// A config plugin whose id the catalog stub's pluginConfig does NOT answer (only spoolman does), so
// the panel exercises the applied/unknown tiers of the truth ladder via the printer record alone.
const AUTH_PLUGIN = makePlugin({
  id: 'moonraker-auth', name: 'moonraker-auth', title: 'Moonraker Login', category: 'system',
  tagline: 'Require a login on the printer web UIs',
  description: 'Turns on Moonraker force_logins so Fluidd/Mainsail ask for credentials.',
  config: [{ key: 'FORCE_LOGINS', label: 'Require login', type: 'toggle', onValue: 'true', offValue: 'false', default: 'false', scope: 'global' }],
})

const CAMERA_PLUGIN = makePlugin({
  id: 'camera-hw-accel', name: 'camera-hw-accel', title: 'HW Camera', category: 'camera', version: '1.2.0',
  tagline: 'Hardware-accelerated MIPI + USB camera',
  description: 'Hardware-accelerated camera streaming with snapshot + MJPEG endpoints.',
  changelog: '# Changelog\n\n## 1.2.0\n- Teardown now SIGKILLs the display compositor instead of SIGTERM, fixing a freeze on install/uninstall.\n\n## 1.1.0\n- Initial hardware-accelerated pipeline.\n',
  sources: [makeSource({ version: '1.2.0' })],
})

const WLED_PLUGIN = makePlugin({
  id: 'wled', name: 'wled', title: 'WLED', category: 'ui', tagline: 'Addressable LED control',
  description: 'Control WLED-driven addressable LEDs from the printer.',
  sources: [
    makeSource({ channel: 'lts', version: '0.9.0' }),
    makeSource({ channel: 'stable', version: '1.0.0' }),
    makeSource({ channel: 'experiment', version: '1.4.0-exp.1' }),
  ],
})

const ORPHAN_PLUGIN = makePlugin({
  id: 'old-thing', name: 'old-thing', title: 'Retired Plugin',
  tagline: 'No longer offered by any source', sources: [],
})

const DOC_PLUGIN = makePlugin({
  id: 'status-feed', name: 'status-feed', title: 'Status Feed', category: 'system',
  tagline: 'Publishes printer status to a small HTTP endpoint',
  description: 'A tiny own-service plugin: a worked example for declarative Python deps.',
  doc: '# Status Feed\n\nExposes a small JSON status endpoint on the printer for other tools to poll.\n',
  log: {},
})

// Owns the bit of state a real parent (App -> PluginStore) threads into every detail panel: whether
// the plugin is installed (so Install/Uninstall actually flip it) and the REAL scoped vars store,
// resolved/saved for the story's printer exactly as App does (view, scope-aware save, scope preset).
function Panel({ plugin, installed: initialInstalled = false, deactivated, hasUpdate = false, installedVersion, initialTab, installedLog, initialSavedVars = {}, printer = PRINTER }: {
  plugin: Plugin; installed?: boolean; deactivated?: boolean; hasUpdate?: boolean; installedVersion?: string
  initialTab?: string; installedLog?: InstallLog; initialSavedVars?: Record<string, string>; printer?: Printer | null
}) {
  const [installed, setInstalled] = useState(initialInstalled)
  const [scopedVars, setScopedVars] = useState<ScopedPluginVars>(() => migrateFlatVars(initialSavedVars))
  const printerKey = printer ? printerKeyFor(printer) : undefined

  return (
    <PluginPanel
      plugin={plugin} printer={printer} installed={installed} deactivated={deactivated}
      hasUpdate={hasUpdate} installedVersion={installedVersion}
      printerId={printer ? 'printer-1' : undefined} allInstalledIds={installed ? [plugin.id] : []}
      savedPluginVars={printerVarsView(scopedVars, printerKey)}
      onSaveVars={(save) => setScopedVars((current) => saveValuesToScopes(current, printerKey, save))}
      scopeFor={(field) => effectiveScope(scopedVars, printerKey, field)}
      appliedVars={printer?.appliedPluginVars?.[plugin.id]} appliedVarsAt={printer?.appliedPluginVarsAt?.[plugin.id]}
      onClose={noop} initialTab={initialTab} installedLog={installedLog}
      onOperationDone={(_ids, _pluginId, action) => setInstalled(action === 'install')}
    />
  )
}

// A plain plugin with nothing to configure: Overview tab only, plain Install.
export function NotInstalled() {
  return <Panel plugin={BASIC_PLUGIN} />
}

// The Config tab pre-selected, required Server URL empty: this is what blocks Install, surfaced via
// the foot's "why is this blocked" note with a jump-to-Config action.
export function ConfigRequiredNotInstalled() {
  return <Panel plugin={SPOOLMAN_PLUGIN} initialTab="config" />
}

// Installed, truth-ladder tier 1: the stub's pluginConfig answers for spoolman, so the values shown
// are the daemon's persisted ones (unbadged). Click-to-edit + Apply run the real reconfigure flow.
export function ConfigInstalledEditable() {
  return (
    <Panel
      plugin={SPOOLMAN_PLUGIN} installed initialTab="config"
      initialSavedVars={{ SPOOLMAN_SERVER: 'http://192.0.2.108:7912', SPOOLMAN_MODE: 'auto' }}
    />
  )
}

// Truth-ladder tier 2: no live read for this plugin, but this computer sent config on a known date,
// so the values show with the visible "as sent from this computer" marker.
export function ConfigInstalledLastKnown() {
  return (
    <Panel
      plugin={AUTH_PLUGIN} installed initialTab="config"
      printer={makePrinter({
        id: 'printer-1', status: 'managed',
        appliedPluginVars: { 'moonraker-auth': { FORCE_LOGINS: 'true' } },
        appliedPluginVarsAt: { 'moonraker-auth': '2026-07-01T09:30:00.000Z' },
      })}
    />
  )
}

// Truth-ladder tier 3: nothing can vouch for the printer's values (no live read, never configured
// from this computer): explicit unknown placeholders, never a default that may not match reality.
export function ConfigInstalledUnknown() {
  return <Panel plugin={AUTH_PLUGIN} installed initialTab="config" />
}

// An update available with a changelog opens straight there (not Overview) so the user sees what
// changed before deciding to update.
export function InstalledWithUpdate() {
  return <Panel plugin={CAMERA_PLUGIN} installed hasUpdate installedVersion="1.1.0" />
}

// More than one channel published: the Versions tab shows the channel chips (ceiling-aware) above the
// source rows.
export function VersionsMultiChannel() {
  return <Panel plugin={WLED_PLUGIN} initialTab="versions" />
}

export function Deactivated() {
  return <Panel plugin={BASIC_PLUGIN} installed deactivated />
}

// Installed but offered by no catalog source anymore (its sideloaded copy was removed): only
// Uninstall remains, no reinstall/switch action.
export function Orphan() {
  return <Panel plugin={ORPHAN_PLUGIN} installed />
}

export function DocTab() {
  return <Panel plugin={DOC_PLUGIN} initialTab="doc" />
}

// Installed with a declared log: the Captured tab watches the daemon's live log feed (stubbed here)
// and the Log tab replays the persisted install log.
export function CapturedAndLogTabs() {
  return <Panel plugin={DOC_PLUGIN} installed initialTab="captured" installedLog={makeInstallLog(DOC_PLUGIN.id)} />
}
