// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Plugin } from '../../data/types'
import { resolveMissingDeps } from '../../data/deps'
import type { InstalledOnPrinter } from '../../data/channels/updates'
import { hasUpdate, updateVariant } from '../../data/channels/updates'

// Plugins with a newer build waiting on the source their installed copy came from (a real update). An
// installed version ahead of what that source offers is NOT an update (no downgrade prompts).
//
// The printer's machinery is left out of the SET even when it has one: updating the daemon restarts the
// service the rest of the batch is talking to, so a batch carrying it would strand every plugin behind
// it, and the printer's own tile already announces that update. Its store card still offers it, one at
// a time, which is the only safe way to take it.
export function updatablePlugins(plugins: Plugin[], installed: InstalledOnPrinter): Plugin[] {
  return plugins.filter((plugin) => plugin.systemPackage !== true && hasUpdate(plugin, installed))
}

// The config values an install/update should carry: each declared field's saved value or its default,
// dropping blanks so a plugin without config sends nothing.
export function pluginInstallVars(plugin: Plugin, savedVars: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    (plugin.config ?? [])
      .map((field) => [field.key, savedVars[field.key] ?? field.default ?? ''])
      .filter(([, value]) => value !== ''),
  )
}

// One plugin's update: its saved config vars, the deps a new version may need, and the source the offer
// was computed from. The source travels with the spec because the printer must be sent the build the
// user was offered, not whichever list happens to hold a higher number for that plugin.
function updateSpec(plugin: Plugin, catalog: Plugin[], installedIds: string[], installed: InstalledOnPrinter, savedVars: Record<string, string>): PluginUpdateSpec {
  const offered = updateVariant(plugin, installed)

  return {
    pluginId: plugin.id,
    vars: pluginInstallVars(plugin, savedVars),
    depIds: resolveMissingDeps(catalog, plugin.id, installedIds),
    sourceUrl: offered?.registryUrl,
    channel: offered?.channel,
  }
}

export function buildUpdateSpecs(
  plugins: Plugin[],
  installedIds: string[],
  installed: InstalledOnPrinter,
  savedVars: Record<string, string>,
): PluginUpdateSpec[] {
  return updatablePlugins(plugins, installed).map((plugin) => updateSpec(plugin, plugins, installedIds, installed, savedVars))
}
