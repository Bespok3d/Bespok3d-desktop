import type { ReactNode } from 'react'
import { PrinterDropdown } from '.'
import { PrinterMenuItem } from './menu-item'
import { makePrinter } from '../../../test/fixtures'
import type { Printer } from '../../../data/types'

export default { title: 'Header / Printer dropdown' }

const ADAPTER_JINNI = '0.1.6'
const ADAPTER_JINNI_VERSIONS = { 'snapmaker-u1': ADAPTER_JINNI }

const ENDPOINTS = [
  { label: 'Fluidd', url: 'http://192.0.2.108' },
  { label: 'Mainsail', url: 'http://192.0.2.108:81' },
  { label: 'Spoolman', url: 'http://192.0.2.108:7912' },
]

function noop() {}

function Dropdown({ printer }: { printer: Printer }) {
  return (
    <div style={{ padding: 48 }}>
      <PrinterDropdown
        printers={[printer]}
        selectedId={printer.id}
        adapterIcons={{}}
        adapterJinniVersions={ADAPTER_JINNI_VERSIONS}
        savedPluginVars={{}}
        onSelect={noop}
        onAddPrinter={noop}
        onOpenSettings={noop}
        onUpdateDaemon={noop}
        onUpdateJinni={noop}
        onUpdateAll={noop}
        installingCount={0}
      />
    </div>
  )
}

// The dropdown menu floats absolutely off its trigger; in the catalog we drop its rows into a static
// frame so each row state is visible without opening a real dropdown.
function MenuFrame({ children }: { children: ReactNode }) {
  return (
    <div className="printer-menu" style={{ position: 'static', maxWidth: 420 }}>
      <div className="menu-section-title">My printers</div>
      {children}
    </div>
  )
}

function Row(props: { printer: Printer; selected?: boolean }) {
  return (
    <MenuFrame>
      <PrinterMenuItem
        printer={props.printer}
        adapterJinniVersion={ADAPTER_JINNI}
        isSelected={props.selected ?? false}
        onSelect={noop}
        onUpdateDaemon={noop}
        onUpdateJinni={noop}
      />
    </MenuFrame>
  )
}

// A clean, up-to-date printer: the closed trigger and the open row both show the normal state.
export function FullDropdown() {
  return <Dropdown printer={makePrinter({ nick: 'unU1', status: 'managed', jinniVersion: ADAPTER_JINNI, endpoints: ENDPOINTS, installedIds: Array.from({ length: 23 }, (_unused, index) => `plugin-${index}`) })} />
}

// Plugin updates pending: the closed trigger shows the count badge, the open footer offers "Update all".
// The installed versions are older than the catalog plugins the Ladle provider ships.
export function FullDropdownPluginUpdates() {
  return <Dropdown printer={makePrinter({ nick: 'unU1', status: 'managed', jinniVersion: ADAPTER_JINNI, installedIds: ['spoolman', 'camera-hw-accel', 'fluidd'], installedVersions: { spoolman: '1.0.0', 'camera-hw-accel': '1.0.0', fluidd: '1.3.0' } })} />
}

// Daemon AND adapter both behind: the closed trigger shows an amber daemon badge and a sage adapter
// badge; the open row shows both versions and a single callout that updates them together.
export function FullDropdownDaemonJinniUpdate() {
  return <Dropdown printer={makePrinter({ nick: 'unU1', status: 'managed', daemonVersion: '0.12.9-dev', daemonUpdateAvailable: true, jinniVersion: '0.1.5' })} />
}

export function RowUpToDate() {
  return <Row selected printer={makePrinter({ nick: 'unU1', status: 'managed', jinniVersion: ADAPTER_JINNI, installedIds: ['a', 'b', 'c'] })} />
}

export function RowWithEndpoints() {
  return <Row selected printer={makePrinter({ nick: 'unU1', status: 'managed', jinniVersion: ADAPTER_JINNI, endpoints: ENDPOINTS })} />
}

export function RowDaemonUpdate() {
  return <Row printer={makePrinter({ nick: 'unU1', status: 'managed', daemonVersion: '0.12.9-dev', daemonUpdateAvailable: true, jinniVersion: ADAPTER_JINNI })} />
}

export function RowJinniUpdate() {
  return <Row printer={makePrinter({ nick: 'unU1', status: 'managed', jinniVersion: '0.1.5' })} />
}

export function RowBothUpdate() {
  return <Row printer={makePrinter({ nick: 'unU1', status: 'managed', daemonVersion: '0.12.9-dev', daemonUpdateAvailable: true, jinniVersion: '0.1.5' })} />
}

export function RowMultiInterface() {
  var printer = makePrinter({
    nick: 'unU1', status: 'managed', ip: '192.0.2.108', jinniVersion: ADAPTER_JINNI,
    networkInterfaces: [{ label: 'Wi-Fi', ip: '192.0.2.108' }, { label: 'Ethernet', ip: '10.0.0.5' }, { label: 'VPN', ip: '203.0.113.9' }],
  })

  return <Row printer={printer} />
}

// Sensor (status-dot) states. The dot colour + hover reason change with the connection ladder; the row
// is otherwise quiet (no update callouts) because a non-managed printer cannot be updated.
export function RowOnlineDaemonDown() {
  return <Row printer={makePrinter({ nick: 'unU1', status: 'online' })} />
}

export function RowNeedsRepair() {
  return <Row printer={makePrinter({ nick: 'unU1', status: 'online', connection: { reach: 'recoverable', sshOpen: true } })} />
}

export function RowRootAccessOff() {
  return <Row printer={makePrinter({ nick: 'unU1', status: 'online', connection: { reach: 'alive-no-ssh', sshOpen: false } })} />
}

export function RowChecking() {
  return <Row printer={makePrinter({ nick: 'unU1', status: 'checking' })} />
}

export function RowDeactivated() {
  return <Row printer={makePrinter({ nick: 'unU1', status: 'deactivated' })} />
}

export function RowOffline() {
  return <Row printer={makePrinter({ nick: 'unU1', status: 'offline' })} />
}
