// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { PluginConfigField } from '../types'
import { GLOBAL_SCOPE, localScopeKey, type PluginVarsSave, type ScopeChoice, type ScopedPluginVars } from './types'

export function saveFieldValue(
  scopedVars: ScopedPluginVars,
  scopeKey: string,
  fieldKey: string,
  value: string,
): ScopedPluginVars {
  return { ...scopedVars, [fieldKey]: { ...scopedVars[fieldKey], [scopeKey]: value } }
}

// Clearing an override deletes the entry (resolution then falls back to the next scope); it never
// writes an empty string, which would still shadow global by presence.
export function clearFieldScope(
  scopedVars: ScopedPluginVars,
  scopeKey: string,
  fieldKey: string,
): ScopedPluginVars {
  const { [scopeKey]: _cleared, ...remainingScopes } = scopedVars[fieldKey] ?? {}

  return { ...scopedVars, [fieldKey]: remainingScopes }
}

// The scope the UI shows for a field on a printer. Derived, never stored separately: an existing
// per-printer entry means "this printer" was chosen (or saved) for it; otherwise the manifest hint
// decides, and no hint means global (the app-wide default: what you set today is what the printer
// you buy tomorrow inherits).
export function effectiveScope(
  scopedVars: ScopedPluginVars,
  printerKey: string | undefined,
  field: PluginConfigField,
): ScopeChoice {
  const printerEntry = printerKey === undefined ? undefined : scopedVars[field.key]?.[localScopeKey(printerKey)]
  if (printerEntry !== undefined) return 'printer'

  return field.scope
}

function isLocalScopeKey(scopeKey: string): boolean {
  return scopeKey.startsWith('local:')
}

// A field never has a mixed scope (1st-version simplification, Lucio 2026-07-03): the manifest
// hint or ANY printer holding its own value makes the field per-printer for the whole fleet. This
// is what divides the Settings views: per-printer fields are managed printer by printer, the rest
// are shared.
export function fieldIsPrinterScoped(scopedVars: ScopedPluginVars, field: PluginConfigField): boolean {
  if (field.scope === 'printer') return true

  return Object.keys(scopedVars[field.key] ?? {}).some(isLocalScopeKey)
}

// The variable-level flip back to shared: EVERY printer's own value is dropped so the field
// reclassifies as shared (for a global-hinted field; a 'printer' manifest hint keeps its
// classification regardless). The global slice and any future group entries stay.
export function clearAllPrinterScopes(scopedVars: ScopedPluginVars, fieldKey: string): ScopedPluginVars {
  const keptScopes = Object.fromEntries(
    Object.entries(scopedVars[fieldKey] ?? {}).filter(([scopeKey]) => !isLocalScopeKey(scopeKey)),
  )

  return { ...scopedVars, [fieldKey]: keptScopes }
}

// The scope control's starting position per field: the derived effective scope when a resolver is
// threaded (an existing per-printer entry wins), else the manifest hint. Shared by the detail
// panel's Config tab and the batch capture flows.
export function seedFieldScopes(
  fields: PluginConfigField[],
  scopeFor: ((field: PluginConfigField) => ScopeChoice) | undefined,
): Record<string, ScopeChoice> {
  return Object.fromEntries(fields.map((field) => [field.key, scopeFor ? scopeFor(field) : field.scope]))
}

function saveOneFieldToScope(
  scopedVars: ScopedPluginVars,
  printerKey: string | undefined,
  field: PluginConfigField,
  value: string,
  choice: ScopeChoice,
): ScopedPluginVars {
  if (choice === 'printer' && printerKey !== undefined) {
    return saveFieldValue(scopedVars, localScopeKey(printerKey), field.key, value)
  }
  // A global save also clears this printer's override: choosing "all printers" while a local entry
  // exists means the local entry must stop shadowing the shared value.
  const unshadowed = printerKey === undefined ? scopedVars : clearFieldScope(scopedVars, localScopeKey(printerKey), field.key)

  return saveFieldValue(unshadowed, GLOBAL_SCOPE, field.key, value)
}

// Apply one UI save to the store: each written field lands in its ACTIVE scope, which is the
// explicit choice when the surface offered a scope control, else the derived effective scope
// (an existing per-printer entry, else the manifest hint). Fields the save carries no value for
// are untouched.
export function saveValuesToScopes(
  scopedVars: ScopedPluginVars,
  printerKey: string | undefined,
  save: PluginVarsSave,
): ScopedPluginVars {
  return save.fields
    .filter((field) => save.values[field.key] !== undefined)
    .reduce(
      (vars, field) =>
        saveOneFieldToScope(
          vars,
          printerKey,
          field,
          save.values[field.key],
          save.scopeChoices?.[field.key] ?? effectiveScope(vars, printerKey, field),
        ),
      scopedVars,
    )
}
