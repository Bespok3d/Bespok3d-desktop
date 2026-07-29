// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useEffect, useState } from 'react'
import type { Printer, PluginConfigField } from '../data/types'
import {
  runVarsMigrations,
  persistScopedVars,
  printerVarsView,
  remapPrinterScope,
  saveValuesToScopes,
  effectiveScope,
} from '../data/plugin-vars'
import type { ScopedPluginVars, ScopeChoice, PluginVarsSave, SchemaStorage } from '../data/plugin-vars'

// The browser adapter for the persistence seam: every migration/dual-write path above it is pure
// and unit-tested against a fake storage; this is the only place localStorage is touched.
const browserVarsStorage: SchemaStorage = {
  read: (key) => localStorage.getItem(key),
  write: (key, value) => localStorage.setItem(key, value),
}

export interface PluginVarsStore {
  // The flat resolved view for one printer, dropping into every legacy savedVars read signature.
  viewFor: (printerKey: string | undefined) => Record<string, string>
  scopeFor: (printerKey: string | undefined, field: PluginConfigField) => ScopeChoice
  saveFor: (printerKey: string | undefined, save: PluginVarsSave) => void
  // The raw scoped store and its setter, for the Settings defaults manager (it computes each next
  // store with the pure data fns). The persist effect dual-writes on ANY state change, so pane
  // edits keep the legacy downgrade mirror in sync like every other write path.
  scopedVars: ScopedPluginVars
  setScopedVars: (next: ScopedPluginVars) => void
}

// The renderer's one owner of the scoped plugin-vars store: boot migration (v1 flat map to v2
// scoped), dual-write persistence on every change (the legacy key mirrors the global slice so a
// downgraded build keeps working), and the one-shot remap of a printer's entries onto its
// daemon-held UUID when a managed ping first reports it.
export function usePluginVars(printers: Printer[]): PluginVarsStore {
  const [scopedVars, setScopedVars] = useState<ScopedPluginVars>(() => runVarsMigrations(browserVarsStorage))
  function persistOnChange() {
    persistScopedVars(browserVarsStorage, scopedVars)
  }
  useEffect(persistOnChange, [scopedVars])
  // remapPrinterScope returns its input reference when nothing moves, so this converges (React
  // bails out on an identical state reference) instead of looping on every printers ping.
  function remapLearnedUuids() {
    setScopedVars((current) =>
      printers.reduce(
        (vars, printer) => (printer.printerUuid ? remapPrinterScope(vars, printer.id, printer.printerUuid) : vars),
        current,
      ),
    )
  }
  useEffect(remapLearnedUuids, [printers])

  return {
    viewFor: (printerKey) => printerVarsView(scopedVars, printerKey),
    scopeFor: (printerKey, field) => effectiveScope(scopedVars, printerKey, field),
    saveFor: (printerKey, save) => setScopedVars((current) => saveValuesToScopes(current, printerKey, save)),
    scopedVars,
    setScopedVars,
  }
}
