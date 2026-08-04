// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useState } from 'react'
import { PluginConfigSection } from './config-section'
import type { PluginConfigField } from '../../../data/types'
import type { ScopeChoice } from '../../../data/plugin-vars'
import type { PortClaim } from '../../../data/ports'
import '../plugin-store.css'

export default { title: 'Store / Config / PluginConfigSection' }

const SPOOLMAN_FIELDS: PluginConfigField[] = [
  { key: 'SPOOLMAN_SERVER', label: 'Server URL', type: 'text', scope: 'global', required: true, placeholder: 'http://host:7912', hint: 'Moonraker reads spool data from this address.' },
  { key: 'SPOOLMAN_MODE', label: 'Mode', type: 'select', options: ['auto', 'manual'], default: 'auto', scope: 'global' },
  { key: 'SPOOLMAN_LOGGING', label: 'Verbose logging', type: 'toggle', onValue: 'true', offValue: 'false', default: 'false', scope: 'global' },
]

const PORT_FIELDS: PluginConfigField[] = [
  { key: 'FLUIDD_PORT', label: 'Web UI port', type: 'http-port', default: '80', scope: 'global', hint: 'Only one plugin can serve on port 80 at a time.' },
]

// The other web UI in the catalog for these stories: Mainsail, sitting on port 80, so typing 80 shows
// the note that says it will be moved.
const MAINSAIL_ON_80: PortClaim = {
  swapNote: (claimedPort: number) => (claimedPort === 80 ? { name: 'Mainsail', port: 81 } : null),
  steppedDownPort: () => 81,
  claim: () => Promise.resolve(),
}

// Mainsail as the OTHER UI when this one already holds 80: standing down to 81 hands Mainsail the
// primary port, which is what the note says.
const MAINSAIL_ON_81: PortClaim = {
  swapNote: (claimedPort: number) => (claimedPort === 81 ? { name: 'Mainsail', port: 80 } : null),
  steppedDownPort: () => 81,
  claim: () => Promise.resolve(),
}

// Wraps the section with the local draft state a real detail panel would own (PanelConfigArea), so
// typing/toggling and the Apply flow behave exactly as they do in the real panel.
function Section({ fields, current, installed, printerId, portClaim }: {
  fields: PluginConfigField[]; current: Record<string, string>; installed: boolean
  printerId?: string; portClaim?: PortClaim
}) {
  const [values, setValues] = useState(current)

  return (
    <PluginConfigSection
      fields={fields} current={values} installed={installed} printerId={printerId} pluginId="demo"
      portClaim={portClaim} onValuesChange={setValues} onApplied={setValues}
    />
  )
}

// Not yet installed: every field is a live editable form (no click-to-edit gate), feeding the
// install-time vars. The required Server URL is empty, which is what blocks Install on the panel.
export function NotInstalledRequiredEmpty() {
  return <Section fields={SPOOLMAN_FIELDS} current={{ SPOOLMAN_MODE: 'auto', SPOOLMAN_LOGGING: 'false' }} installed={false} />
}

export function NotInstalledFilled() {
  return (
    <Section
      fields={SPOOLMAN_FIELDS}
      current={{ SPOOLMAN_SERVER: 'http://192.0.2.108:7912', SPOOLMAN_MODE: 'auto', SPOOLMAN_LOGGING: 'false' }}
      installed={false}
    />
  )
}

// Installed: values render read-only until the user clicks a value to edit it, then Cancel/Update
// appear once the draft actually differs from what's saved. Update calls the real reconfigure stub.
export function InstalledReadOnly() {
  return (
    <Section
      fields={SPOOLMAN_FIELDS}
      current={{ SPOOLMAN_SERVER: 'http://192.0.2.108:7912', SPOOLMAN_MODE: 'auto', SPOOLMAN_LOGGING: 'false' }}
      installed printerId="printer-1"
    />
  )
}

// Truth-ladder tier 1: the values came from the daemon's live config read moments ago, so they show
// unbadged, exactly like InstalledReadOnly (which predates the ladder and stays the live look).
export function InstalledLiveValues() {
  return (
    <PluginConfigSection
      fields={SPOOLMAN_FIELDS} tier="live"
      current={{ SPOOLMAN_SERVER: 'http://192.0.2.108:7912', SPOOLMAN_MODE: 'auto', SPOOLMAN_LOGGING: 'false' }}
      installed printerId="printer-1" pluginId="spoolman"
    />
  )
}

// Truth-ladder tier 2: the daemon could not be read (or predates the config route), so the values are
// what THIS computer last sent, marked with the send date. Another computer may have changed them since.
export function InstalledLastKnownFromThisComputer() {
  return (
    <PluginConfigSection
      fields={SPOOLMAN_FIELDS} tier="applied" appliedAt="2026-07-01T09:30:00.000Z"
      current={{ SPOOLMAN_SERVER: 'http://192.0.2.108:7912', SPOOLMAN_MODE: 'auto', SPOOLMAN_LOGGING: 'false' }}
      installed printerId="printer-1" pluginId="spoolman"
    />
  )
}

// Truth-ladder tier 3: nothing can vouch for the printer's values (no live read, never configured from
// this computer), so every field is explicitly unknown instead of a default that may not match reality.
export function InstalledValuesUnknown() {
  return (
    <PluginConfigSection
      fields={SPOOLMAN_FIELDS} tier="unknown"
      current={{}}
      installed printerId="printer-1" pluginId="spoolman"
    />
  )
}

export function HttpPortSecondaryUi() {
  return (
    <Section fields={PORT_FIELDS} current={{ FLUIDD_PORT: '81' }} installed printerId="printer-1" portClaim={MAINSAIL_ON_80} />
  )
}

// The UI that already holds port 80: Make primary is spent, and Make secondary offers to hand 80 to
// Mainsail. Both only change what the field shows, until Update config is clicked.
export function HttpPortPrimaryUi() {
  return (
    <Section fields={PORT_FIELDS} current={{ FLUIDD_PORT: '80' }} installed printerId="printer-1" portClaim={MAINSAIL_ON_81} />
  )
}

// A field whose manifest hints per-printer scope: where THIS printer files its spools, not the fleet.
const LOCATION_FIELD: PluginConfigField = {
  key: 'SPOOLMAN_LOCATION', label: 'Location', type: 'text', scope: 'printer',
  hint: 'Where this printer files its spools in Spoolman.',
}

// Owns the per-field scope choices the real panel keeps (usePanelConfigState), so flipping the
// control here behaves exactly as it does in the app: preset by the hint, live to change.
function ScopedSection({ fields, current, initialScopes, printerId = 'printer-1', printerSelected, installed = false }: {
  fields: PluginConfigField[]; current: Record<string, string>
  initialScopes?: Record<string, ScopeChoice>
  printerId?: string; printerSelected?: boolean; installed?: boolean
}) {
  const [values, setValues] = useState(current)
  const [scopes, setScopes] = useState<Record<string, ScopeChoice>>(
    () => initialScopes ?? Object.fromEntries(fields.map((field) => [field.key, field.scope])),
  )

  return (
    <PluginConfigSection
      fields={fields} current={values} installed={installed} printerId={printerId} printerSelected={printerSelected} pluginId="demo"
      scopes={scopes} onScopeChange={(fieldKey, choice) => setScopes((chosen) => ({ ...chosen, [fieldKey]: choice }))}
      onValuesChange={setValues} onApplied={setValues}
    />
  )
}

// Edit mode with the scope control under every editable field: All printers / This printer segments
// preset by each field's manifest hint (server + mode global, location per-printer).
export function EditWithScopeControls() {
  return (
    <ScopedSection
      fields={[...SPOOLMAN_FIELDS, LOCATION_FIELD]}
      current={{ SPOOLMAN_SERVER: 'http://spoolman.example:7912', SPOOLMAN_MODE: 'auto', SPOOLMAN_LOGGING: 'false', SPOOLMAN_LOCATION: 'Shelf A' }}
    />
  )
}

// Choices flipped away from their hints: the one-line microcopy says where the next save will land
// (the server only on this printer, the location shared with the whole fleet).
export function ScopeFlippedFromHint() {
  return (
    <ScopedSection
      fields={[...SPOOLMAN_FIELDS, LOCATION_FIELD]}
      current={{ SPOOLMAN_SERVER: 'http://spoolman.example:7912', SPOOLMAN_MODE: 'auto', SPOOLMAN_LOGGING: 'false', SPOOLMAN_LOCATION: 'Shelf A' }}
      initialScopes={{ SPOOLMAN_SERVER: 'printer', SPOOLMAN_MODE: 'global', SPOOLMAN_LOGGING: 'global', SPOOLMAN_LOCATION: 'global' }}
    />
  )
}

// No printer behind the panel (browsing the store before selecting one): the scope control stays
// visible so it never silently vanishes, "This printer" is disabled, and the section note says why.
export function ScopeNoPrinterSelected() {
  return (
    <ScopedSection
      fields={[...SPOOLMAN_FIELDS, LOCATION_FIELD]}
      current={{ SPOOLMAN_SERVER: 'http://spoolman.example:7912', SPOOLMAN_MODE: 'auto', SPOOLMAN_LOGGING: 'false', SPOOLMAN_LOCATION: 'Shelf A' }}
      printerId={undefined}
    />
  )
}

// A selected printer that is currently offline: scoping still works (it edits preferences, bound to
// this printer), the note explains when the printer actually gets the changes, and Apply is blocked.
export function ScopeOfflinePrinter() {
  return (
    <ScopedSection
      fields={[...SPOOLMAN_FIELDS, LOCATION_FIELD]}
      current={{ SPOOLMAN_SERVER: 'http://spoolman.example:7912', SPOOLMAN_MODE: 'auto', SPOOLMAN_LOGGING: 'false', SPOOLMAN_LOCATION: 'Shelf A' }}
      printerId={undefined} printerSelected installed
    />
  )
}
