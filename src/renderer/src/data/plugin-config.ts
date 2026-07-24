// The plugin config-field types: what a manifest's `config[]` declares, passed through the
// index untouched and consumed by the store's config forms. Split from types.ts by concern.

export type PluginConfigType = 'text' | 'number' | 'select' | 'toggle' | 'http-port'

// Which scope a config value sensibly lives in: shared across every printer, or one value per
// printer. A manifest declares it per field as a HINT (it presets the scope control, never locks
// it). Required on the domain type: legacy manifests get an explicit 'global' stamped at the one
// wire boundary (withExplicitScope, called by entryToPlugin), so absence never propagates past it.
export type PluginConfigScope = 'global' | 'printer'

export interface PluginConfigField {
  key: string
  label: string
  type: PluginConfigType
  scope: PluginConfigScope
  options?: string[]
  default?: string
  placeholder?: string
  hint?: string
  required?: boolean
  userEditable?: boolean
  onValue?: string
  offValue?: string
}

// The wire shape of a config field as an index entry carries it: `scope` stays optional there
// because published manifests predate the key. Normalized to the strict domain shape below.
export type IndexConfigField = Omit<PluginConfigField, 'scope'> & { scope?: PluginConfigScope }

export function withExplicitScope(wireField: IndexConfigField): PluginConfigField {
  return { ...wireField, scope: wireField.scope ?? 'global' }
}
