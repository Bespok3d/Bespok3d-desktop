// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { isDaemonVersionAtLeast } from '@bespok3d/contract'
import type { MigrationTerms, Plugin, Printer } from '../../data/types'
import type { Collection } from '../../data/collections'
import { offeredMigrationTerms } from '../../data/collections'
import type { InstalledOnPrinter } from '../../data/channels/updates'
import type { PluginMigration } from '../plugin-store/migrations'
import { pendingMigrations } from '../plugin-store/migrations'
import { recoverBannerCondition, rebootBannerCondition, repairBannerCondition, rootAccessBannerCondition, driftBannerCondition, printerProblemBannerCondition } from '../printer-banners'

// A change of shape this printer is carrying, in the words the user reads it in: the plugin that is
// changing, what goes on with it, and whether the printer is ready for it yet. A migration is never the
// user's to decline, so this is not an offer they accept or ignore: it is what the app has to finish
// before the printer is on the version the rest of the app assumes it is on.
export interface MigrationOffer {
  migratingPluginId: string
  migratingName: string
  comingOffThePrinter: boolean
  summary: string
  arrivingNames: string[]
  requiredDaemon?: string
  daemonReady: boolean
  migration: PluginMigration
}

// What has to be on the printer before the change can run: what the publisher declared, and failing
// that the newest daemon any arriving plugin asks for. The arriving plugins are the ones that carry
// the new shape, so their own floor is the migration's floor when nobody wrote one down.
function daemonFloorOf(terms: MigrationTerms | undefined, arriving: Plugin[]): string | undefined {
  const declared = terms?.requiresDaemon
  if (declared) return declared
  const floors = arriving.map((plugin) => plugin.minDaemonVersion).filter((floor): floor is string => !!floor)

  return floors.reduce<string | undefined>(
    (highest, floor) => (!highest || isDaemonVersionAtLeast(floor, highest) ? floor : highest),
    undefined,
  )
}

// Everything the change puts on the printer: the packages it sends, and the plugins those packages
// need that are not there yet. A plugin changing in place needs its new dependencies as much as a
// retiring one needs the plugins taking over, and the daemon floor has to clear all of them.
function arrivingPlugins(migration: PluginMigration, plugins: Plugin[]): Plugin[] {
  const arrivingIds = migration.arrivingSpecs.flatMap((spec) => [spec.pluginId, ...(spec.depIds ?? [])])
  const seenIds = new Set<string>()

  return arrivingIds.flatMap((arrivingId) => {
    const plugin = plugins.find((candidate) => candidate.id === arrivingId)
    if (!plugin || seenIds.has(arrivingId)) return []
    seenIds.add(arrivingId)

    return [plugin]
  })
}

// Who the user is being told about. A retiring id names the collection that took over its job; an id
// changing in place names the plugin itself, which is still there afterwards under the same name.
interface MigrationSubject {
  name: string
  summary: string
  terms: MigrationTerms | undefined
}

function subjectChangingInPlace(migration: PluginMigration, plugins: Plugin[]): MigrationSubject | undefined {
  const plugin = plugins.find((candidate) => candidate.id === migration.migratingPluginId)
  if (!plugin) return undefined
  const terms = offeredMigrationTerms(plugin, migration.arrivingSpecs[0]?.sourceUrl)

  return { name: plugin.title || plugin.name, summary: terms?.summary ?? plugin.description, terms }
}

function subjectOfMigration(migration: PluginMigration, collections: Collection[], plugins: Plugin[]): MigrationSubject | undefined {
  const collection = collections.find((candidate) => candidate.id === migration.migratingPluginId)
  if (migration.comingOffThePrinter) {
    return collection && { name: collection.title || collection.name, summary: collection.migration?.summary ?? collection.description, terms: collection.migration }
  }

  return subjectChangingInPlace(migration, plugins)
}

function offerOfMigration(migration: PluginMigration, collections: Collection[], plugins: Plugin[], daemonVersion: string | undefined): MigrationOffer | null {
  const subject = subjectOfMigration(migration, collections, plugins)
  if (!subject) return null
  const arriving = arrivingPlugins(migration, plugins)
  const requiredDaemon = daemonFloorOf(subject.terms, arriving)

  return {
    migratingPluginId: migration.migratingPluginId,
    migratingName: subject.name,
    comingOffThePrinter: migration.comingOffThePrinter,
    summary: subject.summary,
    arrivingNames: arriving.filter((plugin) => plugin.id !== migration.migratingPluginId).map((plugin) => plugin.title || plugin.name || plugin.id),
    requiredDaemon,
    daemonReady: !requiredDaemon || isDaemonVersionAtLeast(daemonVersion ?? '', requiredDaemon),
    migration,
  }
}

// The one change to put in front of the user. More than one plugin can be mid-change at the same
// time, and they are shown one at a time in catalog order: each one restarts the printer's services,
// so stacking them into a single press hides which of them was the one that went wrong.
export function migrationOffer(printer: Printer | null, collections: Collection[], plugins: Plugin[], installed: InstalledOnPrinter, savedVars: Record<string, string>): MigrationOffer | null {
  if (!printer) return null
  const migrations = pendingMigrations(collections, plugins, printer.installedIds ?? [], installed, savedVars)
  const offers = migrations.flatMap((migration) => {
    const offer = offerOfMigration(migration, collections, plugins, printer.daemonVersion)

    return offer ? [offer] : []
  })

  return offers[0] ?? null
}

// A printer that already carries plugins reports itself as `managed`; `online` is the same reachable
// printer with nothing installed yet. A change of shape always has a plugin installed, so `managed` is
// the state it is normally read in, and both belong here.
const REACHABLE: Printer['status'][] = ['online', 'managed']

// A printer that is unreachable, switched off in the app, asking to be recovered or repaired, waiting
// on a power cycle, or reporting files that no longer match what was installed is not in a state to
// change a plugin. Those notices come first and the change waits behind them; nothing is lost,
// because the change is still waiting once the printer is well again.
export function migrationNoticeShows(printer: Printer): boolean {
  const unwell = !REACHABLE.includes(printer.status)
    || recoverBannerCondition(printer)
    || repairBannerCondition(printer)
    || rootAccessBannerCondition(printer)
    || rebootBannerCondition(printer)
    || printerProblemBannerCondition(printer)
    || driftBannerCondition(printer)

  return !unwell
}
