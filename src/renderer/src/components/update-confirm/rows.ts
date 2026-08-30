// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Plugin, PluginSource } from '../../data/types'
import type { InstalledOnPrinter } from '../../data/channels/updates'
import type { Collection } from '../../data/collections'
import type { PluginMigration } from '../plugin-store/migrations'
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

// One line of "this is not an ordinary update": the plugin is changing shape. Either it is not a
// single plugin any more, so it comes off and the plugins that took over its job go on, or it keeps
// its place and starts working differently, bringing whatever its new shape needs with it. The user
// reads that BEFORE it runs, because neither is something to discover afterwards.
export interface ReplacedRow {
  migratingPluginId: string
  name: string
  fromVersion: string
  toVersion: string
  arrivingCount: number
  comingOffThePrinter: boolean
}

function retiringRow(collection: Collection, migration: PluginMigration, installed: InstalledOnPrinter): ReplacedRow {
  return {
    migratingPluginId: migration.migratingPluginId,
    name: collection.title || collection.name,
    fromVersion: installed.versions[migration.migratingPluginId] ?? '',
    toVersion: collection.version,
    arrivingCount: migration.arrivingSpecs.length,
    comingOffThePrinter: true,
  }
}

// The plugin stays, so its own update spec is the line: the version it becomes is the one that spec
// would send, and what arrives alongside it is the dependencies its new shape brought with it.
function changingRow(plugin: Plugin, migration: PluginMigration, installed: InstalledOnPrinter): ReplacedRow {
  const spec = migration.arrivingSpecs.find((candidate) => candidate.pluginId === plugin.id)
  const offered = spec ? sourceOfSpec(plugin, spec, installed) : undefined

  return {
    migratingPluginId: migration.migratingPluginId,
    name: plugin.name ?? plugin.id,
    fromVersion: installed.versions[migration.migratingPluginId] ?? '',
    toVersion: offered?.version ?? plugin.version,
    arrivingCount: spec?.depIds?.length ?? 0,
    comingOffThePrinter: false,
  }
}

function rowOfMigration(migration: PluginMigration, collections: Collection[], plugins: Plugin[], installed: InstalledOnPrinter): ReplacedRow[] {
  const collection = collections.find((candidate) => candidate.id === migration.migratingPluginId)
  if (collection) return [retiringRow(collection, migration, installed)]
  const plugin = plugins.find((candidate) => candidate.id === migration.migratingPluginId)

  return plugin ? [changingRow(plugin, migration, installed)] : []
}

// A change of shape the catalog knows nothing about has nothing to read back, so it is left out of
// the reading rather than shown as a blank line.
export function replacedRows(migrations: PluginMigration[], collections: Collection[], plugins: Plugin[], installed: InstalledOnPrinter): ReplacedRow[] {
  return migrations.flatMap((migration) => rowOfMigration(migration, collections, plugins, installed))
}

// Which sentence the line ends with. A plugin that retires reads one way, a plugin that stays and
// starts working differently reads another, and one that changes on its own brings no count to say.
export function replacedSentenceKey(row: ReplacedRow): string {
  if (row.comingOffThePrinter) return 'store.update_confirm.replaced'

  return row.arrivingCount > 0 ? 'store.update_confirm.changed_in_place' : 'store.update_confirm.changed_alone'
}
