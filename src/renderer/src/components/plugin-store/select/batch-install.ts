import type { Plugin, PluginConfigField } from '../../../data/types'
import type { PluginVarsSave } from '../../../data/plugin-vars'
import { resolveMissingDeps } from '../../../data/deps'
import { initialConfigValues, configComplete } from '../config/config-form'
import { pluginInstallVars } from '../update-all'

// The inputs a batch (or collection) install needs: the catalog, the printer's installed ids, the
// target printer's resolved config values, and the callbacks to persist vars (scope-aware, bound to
// that printer by App) + run the one-restart batch. Shared by the multi-select batch flow and the
// collection install-all flow.
export interface BatchInstallContext {
  catalogPlugins: Plugin[]
  installedIds: string[]
  savedVars: Record<string, string>
  printerId?: string
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

// One batch spec per selected plugin: its config values (saved or captured) plus the deps a fresh
// install needs. The daemon's update_batch applies these with a single service restart.
export function buildInstallSpecs(
  plugins: Plugin[],
  selectedIds: string[],
  installedIds: string[],
  savedVars: Record<string, string>,
): PluginUpdateSpec[] {
  return plugins
    .filter((plugin) => selectedIds.includes(plugin.id))
    .map((plugin) => ({
      pluginId: plugin.id,
      vars: pluginInstallVars(plugin, savedVars),
      depIds: resolveMissingDeps(plugins, plugin.id, installedIds),
    }))
}
