// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { PrinterProblemBanner } from './PrinterProblemBanner'

export default { title: 'App / Printer problem banner' }

function noop() {}

// A plugin's files were removed but its folder was left behind.
export function PluginHalfRemoved() {
  return <PrinterProblemBanner printerName="Example U1" problems={[{ kind: 'plugin_half_removed', detail: 'spoolman', pluginId: 'spoolman' }]} onAction={noop} />
}

// A firmware update came and this plugin could not be put back.
export function PluginRecoveryFailed() {
  return <PrinterProblemBanner printerName="Example U1" problems={[{ kind: 'plugin_recovery_failed', detail: 'camera', pluginId: 'camera' }]} onAction={noop} />
}

// Bespok3d itself is not set up: it outranks a plugin problem on the same printer.
export function Bespok3dNotSetUp() {
  return (
    <PrinterProblemBanner
      printerName="Example U1"
      problems={[{ kind: 'includes_missing', detail: 'printer.cfg', pluginId: null }, { kind: 'directory_missing', detail: 'etc', pluginId: null }, { kind: 'plugin_half_removed', detail: 'spoolman', pluginId: 'spoolman' }]}
      onAction={noop}
    />
  )
}
