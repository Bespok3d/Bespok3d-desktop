// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// The plugin config-field types: what a manifest's `config[]` declares, passed through the
// index untouched and consumed by the store's config forms. Split from types.ts by concern.

// 'address' is a host and a port; 'url' is a whole address, protocol and all, kept exactly as typed
// because the service may live behind a name and a certificate. A manifest asks for 'url' outright:
// it is what the plugin writes to the printer, so only the plugin knows its own side accepts one.
export type PluginConfigType = 'text' | 'number' | 'select' | 'toggle' | 'http-port' | 'address' | 'url'

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

// Published manifests declare a server address as plain 'text', and a released plugin cannot be
// edited from here, so the key endings we actually ship are what marks a field as an address. '_URL'
// is left out on purpose: an Apprise URL is a whole URL by design and cleaning it would break it.
const ADDRESS_KEY_ENDINGS = ['_SERVER', '_HOST', '_ADDRESS']

function isAddressKey(key: string): boolean {
  return ADDRESS_KEY_ENDINGS.some((ending) => key.toUpperCase().endsWith(ending))
}

function domainType(wireField: IndexConfigField): PluginConfigType {
  if (wireField.type === 'text' && isAddressKey(wireField.key)) return 'address'

  return wireField.type
}

export function withExplicitScope(wireField: IndexConfigField): PluginConfigField {
  return { ...wireField, scope: wireField.scope ?? 'global', type: domainType(wireField) }
}
