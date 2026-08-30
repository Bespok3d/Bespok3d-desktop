// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { batchSources } from './sources'
import type { GatedInstall } from '../../hooks/installGate'
import type { BatchFailure, BatchVariant } from './variant'
import type { BatchProgressState } from './progress'
import type { BatchResult } from '../../../../main/daemon-client/batch-result'
import type { PluginMigration } from '../plugin-store/migrations'

// The slots of useBatchOps a migration drives. It reuses the install batch's busy flag and result
// modals wholesale: a migration is an install batch with at most one extra leg in front of it, so a
// second set of state would be the same UI duplicated.
export interface MigrateDeps {
  gatedInstall: GatedInstall
  runBatch: (
    variant: BatchVariant,
    printerId: string,
    specs: PluginUpdateSpec[],
    setBusy: (busy: boolean) => void,
    setResult: (result: BatchResult | null) => void,
    post: (printerId: string, specs: PluginUpdateSpec[]) => Promise<BatchResult>,
  ) => void
  batchDidNotRun: (variant: BatchVariant, printerId: string, setBusy: (busy: boolean) => void) => (error: unknown) => void
  setInstallingBatch: (busy: boolean) => void
  setInstallBatchResult: (result: BatchResult | null) => void
  // A migration reuses the install slot, so the slot is told which of the two it is showing: the
  // ending a user reads has to say their plugin moved, not that some plugins were installed.
  setInstallBatchVariant: (variant: BatchVariant) => void
  setBatchProgress: (progress: BatchProgressState | null) => void
  setBatchFailure: (failure: BatchFailure | null) => void
  refreshAfterBatch: (printerId: string) => void
}

// The retiring plugin comes off FIRST: its patches revert while the printer files are the ones they
// were applied to, and only then do the plugins taking over go on. Installing first would stack the members'
// base-layer patching on top of the retired plugin's already-patched files. A removal that did not
// hold (or a migration with nothing left to install) ends here, showing the removal's own report.
function memberInstallAfterRemoval(deps: MigrateDeps, printerId: string, specs: PluginUpdateSpec[]) {
  return function installMembersOrStop(removal: BatchResult) {
    if (!removal.ok || specs.length === 0) {
      deps.setInstallingBatch(false)
      deps.setInstallBatchResult(removal)
      deps.refreshAfterBatch(printerId)

      return
    }
    deps.runBatch('migration', printerId, specs, deps.setInstallingBatch, deps.setInstallBatchResult, window.b3d.store.installBatch)
  }
}

function migrationVariant(migration: PluginMigration): BatchVariant {
  return migration.comingOffThePrinter ? 'migration' : 'migration-in-place'
}

// A plugin that keeps its id changes by having its new version sent over the old one, in one ordinary
// update batch. The printer puts its own files back to stock before it applies a package, so nothing
// of the old shape is left underneath; and a plugin other plugins depend on could not be taken off
// first in any case. A retiring id is the other shape: it has to leave before its replacements arrive.
function sendTheChange(deps: MigrateDeps, printerId: string, migration: PluginMigration) {
  if (!migration.comingOffThePrinter) {
    deps.runBatch('migration-in-place', printerId, migration.arrivingSpecs, deps.setInstallingBatch, deps.setInstallBatchResult, window.b3d.store.updateBatch)

    return
  }
  window.b3d.store.uninstallBatch(printerId, [migration.migratingPluginId], false)
    .then(memberInstallAfterRemoval(deps, printerId, migration.arrivingSpecs))
    .catch(deps.batchDidNotRun('migration', printerId, deps.setInstallingBatch))
}

// A plugin changing shape migrates in one gated run: its config captured up front, then whichever
// passage its declaration calls for. The removal leg never cascades: the retiring plugin's
// dependencies may be exactly the plugins the install leg is about to put back.
export function migrateRunner(deps: MigrateDeps) {
  return function runMigrateBatch(printerId: string, migration: PluginMigration) {
    deps.gatedInstall(function startTheChange() {
      deps.setInstallBatchVariant(migrationVariant(migration))
      deps.setInstallingBatch(true)
      deps.setBatchProgress(null)
      deps.setBatchFailure(null)
      sendTheChange(deps, printerId, migration)
    }, batchSources(migration.arrivingSpecs))
  }
}
