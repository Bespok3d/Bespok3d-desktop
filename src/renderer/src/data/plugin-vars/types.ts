import type { PluginConfigField } from '../plugin-config'

// The user's saved plugin config values: field key, then scope key, then value. A scope key is
// 'global' (shared by every printer), 'local:<printerKey>' (one printer's own value), or a future
// 'group:<groupId>' (fleet scope, storage-ready but unused). The printerKey is the daemon-held
// printer UUID when known, else the app-local record id until the UUID is first reported (see
// remap.ts). Scoping is app-side only: the daemon always receives flat vars.
export type ScopedPluginVars = Record<string, Record<string, string>>

// The choice a user (or a manifest hint) makes for one field: shared everywhere, or this printer's.
export type ScopeChoice = 'global' | 'printer'

export const GLOBAL_SCOPE = 'global'

export function localScopeKey(printerKey: string): string {
  return `local:${printerKey}`
}

// The printer identity scope keys are built from: the daemon-held UUID once a managed ping has
// reported it, else the app-local record id (remap.ts moves entries over when the UUID appears).
export function printerKeyFor(printer: { id: string; printerUuid?: string }): string {
  return printer.printerUuid ?? printer.id
}

// One save from a UI surface: the just-changed values with their field defs (the scope hint comes
// from the def), plus any explicit per-field scope choices made in the UI. A field without an
// explicit choice lands in its derived effective scope.
export interface PluginVarsSave {
  values: Record<string, string>
  fields: PluginConfigField[]
  scopeChoices?: Record<string, ScopeChoice>
}

// A scope flip reported by a config surface: the field, the chosen scope, and the field's currently
// shown value, so the flip can persist immediately (the shown value lands in the chosen scope the
// moment the user flips, never waiting for an Apply that a value-less flip cannot reach).
export type ScopeFlipHandler = (fieldKey: string, choice: ScopeChoice, shownValue: string) => void
