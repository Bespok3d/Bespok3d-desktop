// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Plugin } from '../../data/types'
import type { Collection } from '../../data/collections'
import type { InstalledOnPrinter } from '../../data/channels/updates'
import { becameCollectionIds, migrationCovers, offeredMigrationTerms, splitMembers } from '../../data/collections'
import { buildInstallSpecs } from './select/batch-install'
import { buildUpdateSpecs } from './update-all'

// A plugin whose next version is not just a newer build but a change to what sits on the printer. It
// happens two ways, and the publisher declares both the same way. Either the plugin retires into a
// collection under the same id (klipper-motion was a patch plugin through 0.1.3; since 0.1.4 the base
// layer owns the patching and the id names a collection), and then it comes off the printer while the
// plugins that took over its job go on. Or it keeps its id and changes what it does, and then it stays,
// updated in place, bringing the plugins its new shape needs with it.
export interface PluginMigration {
  migratingPluginId: string
  comingOffThePrinter: boolean
  arrivingSpecs: PluginUpdateSpec[]
}

// Everything one press of Update should do: the plugins with a newer build, and the plugins that are
// changing shape. Both travel together so the user is never left holding a plugin that no longer works
// the way the rest of the printer expects.
export interface UpdateAllPlan {
  updates: PluginUpdateSpec[]
  migrations: PluginMigration[]
}

function takeoverOfCollection(collection: Collection, plugins: Plugin[], collections: Collection[], installedIds: string[], savedVars: Record<string, string>): PluginMigration {
  const stillToInstall = splitMembers(collection, plugins, collections, installedIds).missing

  return {
    migratingPluginId: collection.id,
    comingOffThePrinter: true,
    arrivingSpecs: buildInstallSpecs(plugins, stillToInstall.map((member) => member.id), installedIds, savedVars),
  }
}

// The ids now naming a collection whose takeover was declared for the version this printer carries.
function pendingTakeovers(collections: Collection[], plugins: Plugin[], installedIds: string[], installed: InstalledOnPrinter, savedVars: Record<string, string>): PluginMigration[] {
  return becameCollectionIds(collections, installedIds).flatMap((migratingId) => {
    const collection = collections.find((candidate) => candidate.id === migratingId)
    if (!collection || !migrationCovers(collection.migration, installed.versions[migratingId])) return []

    return [takeoverOfCollection(collection, plugins, collections, installedIds, savedVars)]
  })
}

// A plugin changing in place travels as its own ordinary update spec, so it carries the source the
// user's channel ceiling allows and the dependencies its new shape needs, and nothing about the
// update path has to be re-derived here.
function changeInPlace(plugins: Plugin[], spec: PluginUpdateSpec, installed: InstalledOnPrinter): PluginMigration[] {
  const plugin = plugins.find((candidate) => candidate.id === spec.pluginId)
  const terms = plugin && offeredMigrationTerms(plugin, spec.sourceUrl)
  if (!plugin || !terms || !migrationCovers(terms, installed.versions[spec.pluginId])) return []

  return [{ migratingPluginId: plugin.id, comingOffThePrinter: false, arrivingSpecs: [spec] }]
}

// The changes of shape this printer is carrying, both kinds together.
export function pendingMigrations(collections: Collection[], plugins: Plugin[], installedIds: string[], installed: InstalledOnPrinter, savedVars: Record<string, string>): PluginMigration[] {
  const updates = buildUpdateSpecs(plugins, installedIds, installed, savedVars)

  return [
    ...pendingTakeovers(collections, plugins, installedIds, installed, savedVars),
    ...updates.flatMap((spec) => changeInPlace(plugins, spec, installed)),
  ]
}

// A plugin that is changing shape is never also an ordinary update: whichever way it moves, the
// migration is what sends it, so nothing is sent twice.
export function buildUpdatePlan(plugins: Plugin[], collections: Collection[], installedIds: string[], installed: InstalledOnPrinter, savedVars: Record<string, string>): UpdateAllPlan {
  const migrations = pendingMigrations(collections, plugins, installedIds, installed, savedVars)
  const migratingIds = migrations.map((migration) => migration.migratingPluginId)

  return {
    updates: buildUpdateSpecs(plugins, installedIds, installed, savedVars).filter((spec) => !migratingIds.includes(spec.pluginId)),
    migrations,
  }
}

// What the Update button counts: a plugin to update and a plugin to change are each one thing the
// press will do.
export function updateAllCount(plan: UpdateAllPlan): number {
  return plan.updates.length + plan.migrations.length
}

export function planIsEmpty(plan: UpdateAllPlan): boolean {
  return updateAllCount(plan) === 0
}
