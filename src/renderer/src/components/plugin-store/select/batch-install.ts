// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Plugin, PluginConfigField } from '../../../data/types'
import type { PluginVarsSave } from '../../../data/plugin-vars'
import type { TFunction } from '../../../i18n'
import { resolveMissingDeps } from '../../../data/deps'
import { assignPort, httpPortField, uiPorts } from '../../../data/ports'
import { initialConfigValues, configComplete } from '../config/config-form'
import { pluginInstallVars } from '../update-all'
import { splitByBatchGate } from '../batch-gate'
import type { BatchMemberContext } from '../batch-gate'

// The inputs a batch (or collection) install needs: what a single install is judged against
// (BatchMemberContext: the catalog, the printer, whether it is printing, the resolved config values),
// plus the callbacks to persist vars (scope-aware, bound to that printer by App) + run the one-restart
// batch. Shared by the multi-select batch flow and the collection install-all flow.
export interface BatchInstallContext extends BatchMemberContext {
  onSaveVars?: (save: PluginVarsSave) => void
  onInstallSelected?: (printerId: string, specs: PluginUpdateSpec[]) => void
}

// Every config field of the plugins a batch capture collected values for, so the save can land
// each value in its chosen scope (the modal's explicit per-field choice, else the manifest hint).
export function capturedConfigFields(plugins: Plugin[]): PluginConfigField[] {
  return plugins.flatMap((plugin) => plugin.config ?? [])
}

// A plugin the user can add to a batch install: in the catalog, not already installed, and not merely
// deactivated (those are re-enabled, not installed). Config readiness is NOT a gate here; plugins that
// still need a value are captured on the batch config screen before the install runs.
export function batchInstallable(plugin: Plugin, installedIds: string[], deactivatedIds: string[]): boolean {
  return !installedIds.includes(plugin.id) && !deactivatedIds.includes(plugin.id)
}

export function installablePlugins(plugins: Plugin[], installedIds: string[], deactivatedIds: string[]): Plugin[] {
  return plugins.filter((plugin) => batchInstallable(plugin, installedIds, deactivatedIds))
}

// Selected plugins that still need a required value the batch must capture first: those whose declared
// config is not already satisfied by the user's saved values or the fields' own defaults.
export function pluginsNeedingConfig(selected: Plugin[], savedVars: Record<string, string>): Plugin[] {
  return selected.filter((plugin) => {
    const fields = plugin.config ?? []

    return fields.length > 0 && !configComplete(fields, initialConfigValues(fields, savedVars))
  })
}

// The capture screen's starting values: every field of every needing-config plugin pre-filled with its
// saved value or default, in one map keyed by field key (the same global shape as savedPluginVars).
export function initialBatchValues(plugins: Plugin[], savedVars: Record<string, string>): Record<string, string> {
  return plugins.reduce(
    (values, plugin) => ({ ...values, ...initialConfigValues(plugin.config ?? [], savedVars) }),
    {} as Record<string, string>,
  )
}

// The specs for the members that pass the same checks a single install passes, built with the values
// the batch will actually install with (saved plus anything just captured). Every batch path builds
// its specs here, so a plugin the panel would have refused cannot reach the printer by riding a
// collection or a multi-select instead. A refused member is left out and the rest install.
export function gatedInstallSpecs(t: TFunction, memberIds: string[], context: BatchMemberContext): PluginUpdateSpec[] {
  const members = context.catalogPlugins.filter((plugin) => memberIds.includes(plugin.id))
  const eligible = splitByBatchGate(t, members, context).eligible

  return buildInstallSpecs(context.catalogPlugins, eligible.map((plugin) => plugin.id), context.installedIds, context.savedVars)
}

// One batch spec per selected plugin: its config values (saved or captured) plus the deps a fresh
// install needs. The daemon's update_batch applies these with a single service restart.
export function buildInstallSpecs(
  plugins: Plugin[],
  selectedIds: string[],
  installedIds: string[],
  savedVars: Record<string, string>,
): PluginUpdateSpec[] {
  const members = plugins.filter((plugin) => selectedIds.includes(plugin.id))
  const portsHeldByInstalledUis = Object.values(uiPorts(plugins, installedIds, savedVars))
  const built = members.reduce((state: BatchSpecs, plugin: Plugin) => {
    const vars = installVarsOnAFreePort(plugin, savedVars, state.portsTaken)
    const spec = { pluginId: plugin.id, vars, depIds: resolveMissingDeps(plugins, plugin.id, installedIds) }

    return { specs: [...state.specs, spec], portsTaken: [...state.portsTaken, ...specPort(plugin, vars)] }
  }, { specs: [], portsTaken: portsHeldByInstalledUis })

  return built.specs
}

interface BatchSpecs {
  specs: PluginUpdateSpec[]
  portsTaken: number[]
}

// A batch member's web port: the one it would install with while that port is free, otherwise the
// next free one. A single install is seeded the same way by the panel's form; a batch has no form,
// so it is done here, and no member ever lands on a port another web UI already holds.
function installVarsOnAFreePort(
  plugin: Plugin,
  savedVars: Record<string, string>,
  portsTaken: number[],
): Record<string, string> {
  const vars = pluginInstallVars(plugin, savedVars)
  const portField = httpPortField(plugin)
  if (!portField) return vars
  const wanted = Number(vars[portField.key])
  const port = Number.isFinite(wanted) && wanted > 0 && !portsTaken.includes(wanted) ? wanted : assignPort(portsTaken)

  return { ...vars, [portField.key]: String(port) }
}

function specPort(plugin: Plugin, vars: Record<string, string>): number[] {
  const portField = httpPortField(plugin)
  if (!portField) return []

  return [Number(vars[portField.key])]
}
