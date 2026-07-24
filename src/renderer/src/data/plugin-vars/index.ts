export { GLOBAL_SCOPE, localScopeKey, printerKeyFor } from './types'
export type { ScopedPluginVars, ScopeChoice, PluginVarsSave, ScopeFlipHandler } from './types'
export { resolveFieldValue, resolveFormValues, printerVarsView, typeDefault } from './resolve'
export { saveFieldValue, clearFieldScope, clearAllPrinterScopes, effectiveScope, fieldIsPrinterScoped, seedFieldScopes, saveValuesToScopes } from './store'
export {
  SCHEMA_VERSION_KEY,
  CURRENT_SCHEMA_VERSION,
  PLUGIN_VARS_KEY,
  LEGACY_VARS_KEY,
  migrateFlatVars,
  globalSlice,
  mergeDowngradeEdits,
  persistScopedVars,
  runVarsMigrations,
} from './migrate'
export type { SchemaStorage } from './migrate'
export { remapPrinterScope } from './remap'
