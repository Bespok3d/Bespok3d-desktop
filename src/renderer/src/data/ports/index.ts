// Catalog-aware glue over the pure port allocator: which installed plugins are web UIs
// (they declare an `http-port` config field), what port each currently holds (read from the
// flat saved-vars map by that field's key), and what to reconfigure when one is made primary.
import type { Plugin, PluginConfigField } from '../types'
import { assignPort, makePrimary, portConflict, PRIMARY_PORT } from './allocator'

// Why a UI plugin's pending http-port value is rejected (collides with another UI or a reserved
// port), or null when it is acceptable. Used to gate both install and reconfigure.
export function httpPortError(
  fields: PluginConfigField[],
  values: Record<string, string>,
  otherUiPorts: number[],
): string | null {
  const field = fields.find((candidate) => candidate.type === 'http-port')
  if (!field) return null

  return portConflict(Number(values[field.key]), otherUiPorts)
}

export function httpPortField(plugin: Plugin): PluginConfigField | undefined {
  return plugin.config?.find((field) => field.type === 'http-port')
}

// Every http-port field across the catalog: the field defs behind a make-primary saved patch, so
// its port values can be saved scope-aware (the patch is keyed by field key, one per UI plugin).
export function uiPortFields(plugins: Plugin[]): PluginConfigField[] {
  return plugins.flatMap((plugin) => plugin.config ?? []).filter((field) => field.type === 'http-port')
}

export function isUiPlugin(plugin: Plugin): boolean {
  return httpPortField(plugin) !== undefined
}

function portFromVars(field: PluginConfigField, savedVars: Record<string, string>): number {
  return Number(savedVars[field.key] ?? field.default ?? PRIMARY_PORT)
}

function uiPortEntry(plugin: Plugin, savedVars: Record<string, string>): [string, number] | null {
  const field = httpPortField(plugin)
  if (!field) return null

  return [plugin.id, portFromVars(field, savedVars)]
}

// { pluginId: port } for every installed UI, the source of truth being each UI's saved PORT var.
export function uiPorts(
  plugins: Plugin[],
  installedIds: string[],
  savedVars: Record<string, string>,
): Record<string, number> {
  const entries = installedIds
    .map((id) => plugins.find((plugin) => plugin.id === id))
    .filter((plugin): plugin is Plugin => plugin !== undefined)
    .map((plugin) => uiPortEntry(plugin, savedVars))
    .filter((entry): entry is [string, number] => entry !== null)

  return Object.fromEntries(entries)
}

// The port a UI being configured should take: 80 if it is the first/only UI, else the next free
// port, computed against the other installed UIs.
export function suggestedPort(
  plugins: Plugin[],
  installedIds: string[],
  savedVars: Record<string, string>,
  selfId: string,
): number {
  const ports = uiPorts(plugins, installedIds, savedVars)
  const others = Object.entries(ports)
    .filter(([id]) => id !== selfId)
    .map(([, port]) => port)

  return assignPort(others)
}

export interface PortReassignment {
  pluginId: string
  portKey: string
  port: number
}

// When `primaryId` is made primary, the OTHER installed UIs whose port changes, each with the
// config-field key to write and the new port. Used to reconfigure them on the printer.
export function reflowForPrimary(
  plugins: Plugin[],
  installedIds: string[],
  savedVars: Record<string, string>,
  primaryId: string,
): PortReassignment[] {
  const current = uiPorts(plugins, installedIds, savedVars)
  const next = makePrimary(current, primaryId)

  return Object.keys(next)
    .filter((id) => id !== primaryId && next[id] !== current[id])
    .map((id) => reassignment(plugins, id, next[id]))
    .filter((entry): entry is PortReassignment => entry !== null)
}

function reassignment(plugins: Plugin[], pluginId: string, port: number): PortReassignment | null {
  const plugin = plugins.find((candidate) => candidate.id === pluginId)
  const field = plugin && httpPortField(plugin)
  if (!field) return null

  return { pluginId, portKey: field.key, port }
}

function pluginConfigVars(plugin: Plugin, savedVars: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    (plugin.config ?? []).map((field) => [field.key, savedVars[field.key] ?? field.default ?? '']),
  )
}

export interface MakePrimaryPlan {
  savedPatch: Record<string, string>
  reconfigure: Array<{ pluginId: string; vars: Record<string, string> }>
}

// Everything that changes when `primaryId` becomes primary: the flat saved-vars patch (the new
// primary moves to 80, each displaced UI to its next port) and the per-plugin var sets to push to
// the printer for the UIs that are installed (so their realization is rebuilt on the new port).
export function makePrimaryPlan(
  plugins: Plugin[],
  installedIds: string[],
  savedVars: Record<string, string>,
  primaryId: string,
): MakePrimaryPlan {
  const reassignments = reflowForPrimary(plugins, installedIds, savedVars, primaryId)
  const primary = plugins.find((plugin) => plugin.id === primaryId)
  const primaryField = primary && httpPortField(primary)
  const savedPatch = Object.fromEntries([
    ...(primaryField ? [[primaryField.key, String(PRIMARY_PORT)]] : []),
    ...reassignments.map((entry) => [entry.portKey, String(entry.port)]),
  ])
  const merged = { ...savedVars, ...savedPatch }
  const changedIds = [
    ...(installedIds.includes(primaryId) ? [primaryId] : []),
    ...reassignments.map((entry) => entry.pluginId),
  ]
  const reconfigure = changedIds
    .map((id) => plugins.find((plugin) => plugin.id === id))
    .filter((plugin): plugin is Plugin => plugin !== undefined)
    .map((plugin) => ({ pluginId: plugin.id, vars: pluginConfigVars(plugin, merged) }))

  return { savedPatch, reconfigure }
}
