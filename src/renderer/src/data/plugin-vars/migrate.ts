import { GLOBAL_SCOPE, type ScopedPluginVars } from './types'

export const SCHEMA_VERSION_KEY = 'b3d.schemaVersion'
export const CURRENT_SCHEMA_VERSION = 2
export const PLUGIN_VARS_KEY = 'b3d.pluginVars'
export const LEGACY_VARS_KEY = 'b3d.savedPluginVars'

// The persistence seam: pure logic above it, localStorage below it (the browser adapter lands with
// the App boot wiring, relay R4), so every migration path is unit-testable without a browser.
export interface SchemaStorage {
  read: (key: string) => string | null
  write: (key: string, value: string) => void
}

// v1 to v2: every legacy flat value becomes that field's shared global value.
export function migrateFlatVars(legacyFlatVars: Record<string, string>): ScopedPluginVars {
  return Object.fromEntries(
    Object.entries(legacyFlatVars).map(([fieldKey, value]) => [fieldKey, { [GLOBAL_SCOPE]: value }]),
  )
}

// The v2 store's global slice: what the legacy key mirrors (the dual-write) so a downgraded build
// keeps working on the data shape it expects.
export function globalSlice(scopedVars: ScopedPluginVars): Record<string, string> {
  return Object.fromEntries(
    Object.entries(scopedVars)
      .filter(([, fieldScopes]) => fieldScopes[GLOBAL_SCOPE] !== undefined)
      .map(([fieldKey, fieldScopes]) => [fieldKey, fieldScopes[GLOBAL_SCOPE]]),
  )
}

// Under v2 the dual-write keeps the legacy key identical to the global slice at all times, so any
// divergence found at boot can only be an edit made by an older build after a downgrade: the legacy
// value is the newer user intent and wins the global scope. Per-printer entries are untouched.
export function mergeDowngradeEdits(
  scopedVars: ScopedPluginVars,
  legacyFlatVars: Record<string, string>,
): ScopedPluginVars {
  return Object.entries(legacyFlatVars).reduce(
    (merged, [fieldKey, legacyValue]) =>
      merged[fieldKey]?.[GLOBAL_SCOPE] === legacyValue
        ? merged
        : { ...merged, [fieldKey]: { ...merged[fieldKey], [GLOBAL_SCOPE]: legacyValue } },
    scopedVars,
  )
}

function parseJsonRecord<Shape>(raw: string | null, fallback: Shape): Shape {
  if (raw == null) return fallback
  try {
    return JSON.parse(raw) as Shape
  } catch {
    return fallback
  }
}

// Every write to the scoped store goes through here so the dual-write invariant (legacy key ==
// global slice) holds at all times while the new version runs.
export function persistScopedVars(storage: SchemaStorage, scopedVars: ScopedPluginVars): void {
  storage.write(PLUGIN_VARS_KEY, JSON.stringify(scopedVars))
  storage.write(LEGACY_VARS_KEY, JSON.stringify(globalSlice(scopedVars)))
}

// Runs at renderer boot before any consumer reads the store. The first boot on v2 migrates the
// legacy flat map; every later boot reconciles downgrade edits (see mergeDowngradeEdits). A corrupt
// v2 store degrades to the legacy mirror rather than throwing. Idempotent: a second run is a no-op.
export function runVarsMigrations(storage: SchemaStorage): ScopedPluginVars {
  const legacyFlatVars = parseJsonRecord<Record<string, string>>(storage.read(LEGACY_VARS_KEY), {})
  const scopedRaw = storage.read(PLUGIN_VARS_KEY)
  const reconciled = scopedRaw == null
    ? migrateFlatVars(legacyFlatVars)
    : mergeDowngradeEdits(parseJsonRecord<ScopedPluginVars>(scopedRaw, {}), legacyFlatVars)
  persistScopedVars(storage, reconciled)
  storage.write(SCHEMA_VERSION_KEY, String(CURRENT_SCHEMA_VERSION))

  return reconciled
}
