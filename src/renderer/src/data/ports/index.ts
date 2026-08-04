// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// Catalog-aware glue over the pure port allocator: which installed plugins are web UIs
// (they declare an `http-port` config field), what port each currently holds (read from the
// flat saved-vars map by that field's key), and what to reconfigure when one is made primary.
import type { Plugin, PluginConfigField } from '../types'
import type { PortProblem } from './allocator'
import { assignPort, portConflict, takePort, PRIMARY_PORT } from './allocator'
export { assignPort, PRIMARY_PORT } from './allocator'
export type { PortProblem } from './allocator'

// Why a UI plugin's pending http-port value cannot be used (reserved or out of range), or null
// when it can. Used to gate both install and reconfigure. A port another UI holds is not an
// error here: `portClaimPlan` moves that other UI instead.
export function httpPortError(
  fields: PluginConfigField[],
  values: Record<string, string>,
): PortProblem | null {
  const claimed = httpPortValue(fields, values)
  if (claimed === null) return null

  return portConflict(claimed)
}

// The port a form is currently asking for, or null when the form has no http-port field.
export function httpPortValue(
  fields: PluginConfigField[],
  values: Record<string, string>,
): number | null {
  const field = fields.find((candidate) => candidate.type === 'http-port')
  if (!field) return null

  return Number(values[field.key])
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

// What a config form needs to hand a claimed port: what the user is told, the port this UI drops to
// when it stands down from primary, and the move itself.
export interface PortClaim {
  swapNote: (claimedPort: number) => { name: string; port: number } | null
  steppedDownPort: () => number | null
  claim: (claimedPort: number) => Promise<void>
}

// The port a primary UI takes when it stands down: the lowest one another web UI holds above 80, so
// claiming it swaps the two and hands port 80 to that UI instead of leaving the printer's plain
// address serving nothing. When every other UI sits on 80 already (this one is only primary in the
// form, not yet on the printer) standing down is simply taking the next free port back. Null when
// this is the only web UI, where standing down would empty port 80.
export function steppedDownPort(
  plugins: Plugin[],
  installedIds: string[],
  savedVars: Record<string, string>,
  selfId: string,
): number | null {
  const portsHeldByOthers = Object.entries(uiPorts(plugins, installedIds, savedVars))
    .filter(([pluginId]) => pluginId !== selfId)
    .map(([, port]) => port)
  if (portsHeldByOthers.length === 0) return null
  const secondaryPorts = portsHeldByOthers.filter((port) => port > PRIMARY_PORT)

  return secondaryPorts.length > 0 ? Math.min(...secondaryPorts) : assignPort(portsHeldByOthers)
}

export interface PortReassignment {
  pluginId: string
  portKey: string
  port: number
}

// When `claimantId` takes `claimedPort`, the OTHER installed UIs whose port changes, each with
// the config-field key to write and the new port. Used to reconfigure them on the printer.
function reflowForClaim(
  plugins: Plugin[],
  installedIds: string[],
  savedVars: Record<string, string>,
  claimantId: string,
  claimedPort: number,
): PortReassignment[] {
  const current = uiPorts(plugins, installedIds, savedVars)
  const next = takePort(current, claimantId, claimedPort)

  return Object.keys(next)
    .filter((id) => id !== claimantId && next[id] !== current[id])
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

export interface PortClaimPlan {
  savedPatch: Record<string, string>
  reconfigure: Array<{ pluginId: string; vars: Record<string, string> }>
  displaced: Array<{ pluginId: string; name: string; port: number }>
}

// Everything that happens to the OTHER UIs when `claimantId` takes `claimedPort`: which one is
// moved and where to, the flat saved-vars patch for it, and the var set to push to the printer.
// The claimant's own value is saved and sent by the install or Update it came from.
export function portClaimPlan(
  plugins: Plugin[],
  installedIds: string[],
  savedVars: Record<string, string>,
  claimantId: string,
  claimedPort: number,
): PortClaimPlan {
  const reassignments = reflowForClaim(plugins, installedIds, savedVars, claimantId, claimedPort)
  const savedPatch = Object.fromEntries(reassignments.map((entry) => [entry.portKey, String(entry.port)]))
  const merged = { ...savedVars, ...savedPatch }
  const moved = reassignments
    .map((entry) => ({ entry, plugin: plugins.find((candidate) => candidate.id === entry.pluginId) }))
    .filter((pair): pair is { entry: PortReassignment; plugin: Plugin } => pair.plugin !== undefined)

  return {
    savedPatch,
    displaced: moved.map(({ entry, plugin }) => ({ pluginId: plugin.id, name: plugin.title, port: entry.port })),
    reconfigure: moved.map(({ plugin }) => ({ pluginId: plugin.id, vars: pluginConfigVars(plugin, merged) })),
  }
}

// A UI wanting a port a plugin-title carries: what the user is told before they commit to it.
export function portSwapNote(
  plugins: Plugin[],
  installedIds: string[],
  savedVars: Record<string, string>,
  claimantId: string,
  claimedPort: number,
): { name: string; port: number } | null {
  const [first] = portClaimPlan(plugins, installedIds, savedVars, claimantId, claimedPort).displaced

  return first ? { name: first.name, port: first.port } : null
}
