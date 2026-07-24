import type { Plugin, PluginConfigField, Printer } from '../../../data/types'
import type { ScopedPluginVars } from '../../../data/plugin-vars'

// One configurable row of the Plugin defaults pane: a plugin's user-editable field.
export interface DefaultsEntry {
  plugin: Plugin
  field: PluginConfigField
}

// The pane's controlled value store, threaded into every row.
export interface ScopedDefaultsStore {
  scopedVars: ScopedPluginVars
  onScopedVarsChange: (next: ScopedPluginVars) => void
}

// A by-plugin section of the pane: the plugin heading plus its rows, in catalog order.
export interface PluginDefaultsGroup {
  plugin: Plugin
  entries: DefaultsEntry[]
}

// Anything that knows which plugins it runs: a full printer record or a story fixture.
type InstalledPluginSource = Pick<Printer, 'installedVersions'>

export function editableDefaults(plugins: Plugin[]): DefaultsEntry[] {
  return plugins.flatMap((plugin) =>
    (plugin.config ?? [])
      .filter((field) => field.userEditable !== false)
      .map((field) => ({ plugin, field })),
  )
}

// The plugin ids installed on at least one of the given printers. All-printers view passes the
// whole fleet (union); the Per-printer view passes just the selected printer.
export function installedPluginIds(printers: InstalledPluginSource[]): Set<string> {
  return new Set(printers.flatMap((printer) => Object.keys(printer.installedVersions ?? {})))
}

function matchesDefaultsQuery(entry: DefaultsEntry, query: string): boolean {
  const normalizedQuery = query.trim().toLowerCase()
  if (normalizedQuery === '') return true

  return entry.plugin.title.toLowerCase().includes(normalizedQuery)
    || entry.field.label.toLowerCase().includes(normalizedQuery)
}

// The rows the pane shows: constrained to installed plugins when a set is given (null = the
// "All plugins" position, no constraint), then narrowed by the search query.
export function visibleDefaults(entries: DefaultsEntry[], installedIds: Set<string> | null, query: string): DefaultsEntry[] {
  return entries
    .filter((entry) => installedIds === null || installedIds.has(entry.plugin.id))
    .filter((entry) => matchesDefaultsQuery(entry, query))
}

export function groupDefaultsByPlugin(entries: DefaultsEntry[]): PluginDefaultsGroup[] {
  const pluginsInOrder = [...new Map(entries.map((entry) => [entry.plugin.id, entry.plugin])).values()]

  return pluginsInOrder.map((plugin) => ({
    plugin,
    entries: entries.filter((entry) => entry.plugin.id === plugin.id),
  }))
}

// The flat-list row label; the by-plugin organization drops the prefix because the section head
// already names the plugin.
export function defaultsRowLabel(entry: DefaultsEntry): string {
  return `${entry.plugin.title}: ${entry.field.label}`
}

// Field keys are un-namespaced by design (cross-plugin sharing), so a React row key needs both ids.
export function defaultsRowKey(entry: DefaultsEntry): string {
  return `${entry.plugin.id}:${entry.field.key}`
}
