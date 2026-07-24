import type { PluginConfigField } from '../types'
import { GLOBAL_SCOPE, localScopeKey, type ScopedPluginVars } from './types'

// The field type's natural default: what a value means when nothing was ever chosen. Single-sourced
// here for every consumer of the fallback chain (scope resolution here, form seeding in the store UI).
export function typeDefault(field: PluginConfigField): string {
  if (field.type === 'toggle') return field.offValue ?? 'false'
  if (field.type === 'select') return field.options?.[0] ?? ''

  return ''
}

// Most-restrictive scope wins: the printer's own value, then the shared global value, then the
// manifest default, then the field type's natural default. A per-printer entry shadows global by
// PRESENCE (an empty string counts); clearing an override means deleting the entry, not emptying it.
export function resolveFieldValue(
  scopedVars: ScopedPluginVars,
  printerKey: string | undefined,
  field: PluginConfigField,
): string {
  const fieldScopes = scopedVars[field.key] ?? {}
  const printerValue = printerKey === undefined ? undefined : fieldScopes[localScopeKey(printerKey)]

  return printerValue ?? fieldScopes[GLOBAL_SCOPE] ?? field.default ?? typeDefault(field)
}

export function resolveFormValues(
  scopedVars: ScopedPluginVars,
  printerKey: string | undefined,
  fields: PluginConfigField[],
): Record<string, string> {
  return Object.fromEntries(fields.map((field) => [field.key, resolveFieldValue(scopedVars, printerKey, field)]))
}

function scopeValueForPrinter(fieldScopes: Record<string, string>, printerKey: string | undefined): string | undefined {
  const printerValue = printerKey === undefined ? undefined : fieldScopes[localScopeKey(printerKey)]

  return printerValue ?? fieldScopes[GLOBAL_SCOPE]
}

// One printer's flat view of the whole store: each field's own value when present, else the shared
// global one. This is what drops into every legacy `savedVars[key] ?? field.default ?? ...` read
// site: entry PRESENCE carries through the flatten, so the resolution order is preserved without
// the reader knowing about scopes.
export function printerVarsView(
  scopedVars: ScopedPluginVars,
  printerKey: string | undefined,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(scopedVars)
      .map(([fieldKey, fieldScopes]): [string, string | undefined] => [fieldKey, scopeValueForPrinter(fieldScopes, printerKey)])
      .filter((viewEntry): viewEntry is [string, string] => viewEntry[1] !== undefined),
  )
}
