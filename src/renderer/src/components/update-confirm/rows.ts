// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Plugin, PluginSource } from '../../data/types'
import type { InstalledOnPrinter } from '../../data/channels/updates'
import { updateVariant } from '../../data/channels/updates'

// One line of "here is what updating would do": the plugin, the two versions, and the source the new
// build comes from. `otherSources` is everything else that offers the same plugin, which is what the
// user opens when the offered build is not the one they want.
export interface UpdateConfirmRow {
  pluginId: string
  name: string
  fromVersion: string
  toVersion: string
  source?: PluginSource
  // The copy on the printer came from somewhere the catalog no longer carries, so this update comes
  // from a different place than the installed build did. Shown, never done silently.
  movedSource: boolean
  otherSources: PluginSource[]
}

function sourceOfSpec(plugin: Plugin, spec: PluginUpdateSpec, installed: InstalledOnPrinter): PluginSource | undefined {
  const picked = (plugin.sources ?? []).find((source) => source.registryUrl === spec.sourceUrl && source.channel === spec.channel)

  return picked ?? updateVariant(plugin, installed)
}

function rowOfSpec(plugin: Plugin, spec: PluginUpdateSpec, installed: InstalledOnPrinter): UpdateConfirmRow {
  const offered = sourceOfSpec(plugin, spec, installed)
  const installedSource = installed.sources?.[plugin.id]

  return {
    pluginId: plugin.id,
    name: plugin.name ?? plugin.id,
    fromVersion: installed.versions[plugin.id] ?? '',
    toVersion: offered?.version ?? plugin.version,
    source: offered,
    movedSource: !!installedSource && !!offered && offered.registryUrl !== installedSource,
    otherSources: plugin.sources ?? [],
  }
}

// The batch as the user should read it before it runs. A spec whose plugin is not in the catalog at
// all has nothing to show and nothing to pick, so it is left out of the reading, not invented.
export function updateConfirmRows(specs: PluginUpdateSpec[], plugins: Plugin[], installed: InstalledOnPrinter): UpdateConfirmRow[] {
  return specs.flatMap((spec) => {
    const plugin = plugins.find((candidate) => candidate.id === spec.pluginId)

    return plugin ? [rowOfSpec(plugin, spec, installed)] : []
  })
}

// The user picked a different build for one plugin in the dialog: that plugin's update is sent from
// the source they picked, and every other plugin in the batch is left exactly as it was offered.
export function specsWithPickedSource(specs: PluginUpdateSpec[], pluginId: string, source: PluginSource): PluginUpdateSpec[] {
  return specs.map((spec) => (spec.pluginId === pluginId ? { ...spec, sourceUrl: source.registryUrl, channel: source.channel } : spec))
}
