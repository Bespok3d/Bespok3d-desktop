import { useState } from 'react'
import { ScopedPluginDefaultsPane } from './ScopedPluginDefaultsPane'
import { GLOBAL_SCOPE, localScopeKey } from '../../../data/plugin-vars'
import type { ScopedPluginVars } from '../../../data/plugin-vars'
import '../settings.css'

export default { title: 'Settings / Plugin defaults' }

// Obviously-fake printers: patterned uuids, never a real device's minted identity. The fleet runs
// Spoolman but NOT Fluidd, so the installed-only filter has something real to hide.
const WORKSHOP_UUID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const WORKSHOP_PRINTER = { id: 'printer-1', nick: 'Workshop U1', printerUuid: WORKSHOP_UUID, installedVersions: { spoolman: '1.2.0' } }
const OFFICE_UUID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
const OFFICE_PRINTER = { id: 'printer-2', nick: 'Office U1', printerUuid: OFFICE_UUID, installedVersions: { spoolman: '1.2.0' } }
const FLEET = [WORKSHOP_PRINTER, OFFICE_PRINTER]

// The fields come from the loaded catalog (the .ladle stub's Spoolman + Fluidd entries), exactly
// like the real Settings screen; only the value store is story-local. Spoolman's Location is
// printer-hinted, so the view division files it under Per printer, never under All printers.
const SHARED_ONLY_VARS: ScopedPluginVars = {
  SPOOLMAN_SERVER: { [GLOBAL_SCOPE]: 'http://spoolman.example:7912' },
  SPOOLMAN_MODE: { [GLOBAL_SCOPE]: 'auto' },
}

const WORKSHOP_OVERRIDE_VARS: ScopedPluginVars = {
  ...SHARED_ONLY_VARS,
  SPOOLMAN_LOCATION: { [localScopeKey(WORKSHOP_UUID)]: 'Shelf A' },
}

type PaneProps = Parameters<typeof ScopedPluginDefaultsPane>[0]

function Pane({ initialVars, ...paneProps }: Partial<PaneProps> & { initialVars: ScopedPluginVars }) {
  const [scopedVars, setScopedVars] = useState(initialVars)

  return (
    <ScopedPluginDefaultsPane
      printers={FLEET}
      selectedPrinter={WORKSHOP_PRINTER}
      scopedVars={scopedVars}
      onScopedVarsChange={setScopedVars}
      {...paneProps}
    />
  )
}

// The pane as it opens: only shared fields (Location is per-printer, so it lives in the other
// view), only installed plugins (the fleet runs Spoolman, so Fluidd's port stays out of the way),
// sectioned by plugin, searchable.
export function InstalledOnlyDefault() {
  return <Pane initialVars={SHARED_ONLY_VARS} />
}

// The All plugins position: every catalog plugin's shared fields, still sectioned by plugin. This
// is where pre-install defaults for not-yet-installed plugins are browsed and set.
export function AllPlugins() {
  return <Pane initialVars={SHARED_ONLY_VARS} initialFilter="all" />
}

// The flat organization: the classic "Plugin: Field" rows for users who prefer one run of rows.
export function FlatList() {
  return <Pane initialVars={SHARED_ONLY_VARS} initialFilter="all" initialOrganization="flat" />
}

// Search narrows over plugin titles and field labels as you type.
export function SearchWithMatches() {
  return <Pane initialVars={SHARED_ONLY_VARS} initialFilter="all" initialQuery="server" />
}

// A search that matches nothing states so explicitly instead of showing a silent blank.
export function SearchNoMatches() {
  return <Pane initialVars={SHARED_ONLY_VARS} initialFilter="all" initialQuery="heated chamber" />
}

// A fleet with nothing installed: the installed-only default explains itself and points at the
// All plugins position instead of rendering an empty pane.
export function NothingInstalled() {
  const bareFleet = [{ ...WORKSHOP_PRINTER, installedVersions: {} }]

  return <Pane initialVars={{}} printers={bareFleet} selectedPrinter={bareFleet[0]} />
}

// The Per printer view holds ONLY the per-printer fields (a variable never has a mixed scope) and
// has no picker of its own: it follows the printer selected in the app header (here a fixture
// printer stands in for that selection). Workshop U1 owns a Location override (edit it live, or
// clear back to the shared value); Server URL and Mode stay shared, over in All printers.
export function PerPrinterEditClear() {
  return <Pane initialVars={WORKSHOP_OVERRIDE_VARS} initialView="printer" />
}

// The fleet-wide division rule at work: Office U1 took its own Web UI port, so the field is
// per-printer for EVERY printer now. Workshop U1 (selected here) sees it in the Per printer view
// still using the shared value, and it is gone from All printers.
export function SharedFieldTakenPerPrinter() {
  const portTakenVars: ScopedPluginVars = {
    ...SHARED_ONLY_VARS,
    FLUIDD_PORT: { [GLOBAL_SCOPE]: '80', [localScopeKey(OFFICE_UUID)]: '81' },
  }

  return <Pane initialVars={portTakenVars} initialView="printer" initialFilter="all" />
}

// The Per printer view before any per-printer field exists: an explicit note explains how a field
// becomes per-printer.
export function PerPrinterNoFieldsYet() {
  const bareFleet = [{ ...WORKSHOP_PRINTER, installedVersions: {} }]

  return <Pane initialVars={{}} initialView="printer" printers={bareFleet} selectedPrinter={bareFleet[0]} />
}

// The All printers view without a selected printer: every row's scope switch keeps its "This
// printer" position visible but disabled, and the row hint says a printer must be selected first.
export function AllPrintersNoPrinterSelected() {
  return <Pane initialVars={SHARED_ONLY_VARS} initialFilter="all" printers={[]} selectedPrinter={null} />
}

// The Per printer view before any printer exists: an explicit empty state.
export function PerPrinterNoPrinters() {
  return <Pane initialVars={SHARED_ONLY_VARS} initialView="printer" printers={[]} selectedPrinter={null} />
}
