// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { batchSources } from './sources'
import type { GatedInstall } from '../../hooks/installGate'
import type { BatchFailure, BatchVariant } from './variant'
import type { BatchProgressState } from './progress'
import type { BatchResult } from '../../../../main/daemon-client/batch-result'
import type { PluginMigration, UpdateAllPlan } from '../plugin-store/migrations'

// The slots of useBatchOps one Update All drives. It is a single click for the user, so it is a
// single busy flag and a single report no matter how many legs it takes on the printer.
export interface UpdateAllOpDeps {
  gatedInstall: GatedInstall
  batchDidNotRun: (variant: BatchVariant, printerId: string, setBusy: (busy: boolean) => void) => (error: unknown) => void
  setUpdatingAll: (busy: boolean) => void
  setUpdateAllResult: (result: BatchResult | null) => void
  setBatchProgress: (progress: BatchProgressState | null) => void
  setBatchFailure: (failure: BatchFailure | null) => void
  refreshAfterBatch: (printerId: string) => void
}

// A leg with nothing to do. It is not a call to the printer and it is not a row in the report: it is
// the empty answer the merge reads as "this leg had no work", so no leg needs a caller-side branch.
const NOTHING_TO_DO: BatchResult = { ok: true, results: [] }

// Every spec the click will send, from both legs, so the install gate weighs the whole thing once.
function planSources(plan: UpdateAllPlan): Array<string | undefined> {
  return batchSources([...plan.updates, ...plan.migrations.flatMap((migration) => migration.arrivingSpecs)])
}

function removeRetired(printerId: string, migrations: PluginMigration[]): Promise<BatchResult> {
  const migratingIds = migrations.map((migration) => migration.migratingPluginId)

  return migratingIds.length === 0 ? Promise.resolve(NOTHING_TO_DO) : window.b3d.store.uninstallBatch(printerId, migratingIds, false)
}

// Members go on only where the plugin they replace actually came off. Putting the base-layer plugins
// on top of files a still-installed predecessor has already patched is the one way this corrupts a
// printer, so a removal that did not hold takes its own members out of the batch and keeps its row.
function arrivingSpecs(migrations: PluginMigration[], removal: BatchResult): PluginUpdateSpec[] {
  return migrations
    .filter((migration) => removal.results.some((row) => row.pluginId === migration.migratingPluginId && row.ok))
    .flatMap((migration) => migration.arrivingSpecs)
}

function installArriving(printerId: string, specs: PluginUpdateSpec[]): Promise<BatchResult> {
  return specs.length === 0 ? Promise.resolve(NOTHING_TO_DO) : window.b3d.store.installBatch(printerId, specs)
}

function sendUpdates(printerId: string, updates: PluginUpdateSpec[]): Promise<BatchResult> {
  return updates.length === 0 ? Promise.resolve(NOTHING_TO_DO) : window.b3d.store.updateBatch(printerId, updates)
}

// One report for one click. The plan never puts a migrating plugin in the update list twice, so the legs
// cannot both speak for the same plugin and every row in here is a different plugin's own outcome.
function oneReport(legs: BatchResult[]): BatchResult {
  const warnings = legs.flatMap((leg) => leg.manifestWarnings ?? [])

  return {
    ok: legs.every((leg) => leg.ok),
    results: legs.flatMap((leg) => leg.results),
    manifestWarnings: warnings.length === 0 ? undefined : warnings,
  }
}

// Retiring plugins off, their replacements on, then everything that is simply a newer version. The
// order is the whole point: a plugin that became a set has to leave before its members arrive. A
// plugin changing in place is not in that dance at all: it is sent as an ordinary update, because
// that is exactly what it is, and it brings the plugins its new shape needs with it.
async function runEveryLeg(printerId: string, plan: UpdateAllPlan): Promise<BatchResult> {
  const retiring = plan.migrations.filter((migration) => migration.comingOffThePrinter)
  const changingInPlace = plan.migrations.filter((migration) => !migration.comingOffThePrinter)
  const removal = await removeRetired(printerId, retiring)
  const arrival = await installArriving(printerId, arrivingSpecs(retiring, removal))
  const updates = await sendUpdates(printerId, [...plan.updates, ...changingInPlace.flatMap((migration) => migration.arrivingSpecs)])

  return oneReport([removal, arrival, updates])
}

// Update All, whatever the catalog has done to the plugins since they were installed. A plugin with a
// newer version is updated; a plugin that is not a plugin any more is replaced by the plugins that
// took over its job; and whatever went wrong is one row per plugin in the report, each with its own
// way out, rather than a batch that stops at the first thing it cannot do.
export function updateAllRunner(deps: UpdateAllOpDeps) {
  return function runUpdateAll(printerId: string, plan: UpdateAllPlan) {
    deps.gatedInstall(function replaceRetiredThenUpdate() {
      deps.setUpdatingAll(true)
      deps.setBatchProgress(null)
      deps.setBatchFailure(null)
      runEveryLeg(printerId, plan)
        .then((report) => {
          deps.setUpdatingAll(false)
          deps.setUpdateAllResult(report)
          deps.refreshAfterBatch(printerId)
        })
        .catch(deps.batchDidNotRun('update', printerId, deps.setUpdatingAll))
    }, planSources(plan))
  }
}
