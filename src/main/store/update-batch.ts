// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { BrowserWindow } from 'electron'
import { updatePrinter } from '../printers'
import type { PrinterRecord } from '../printers'
import type { MergedEntry, PackageTrust } from '../registry/model'
import type { PluginRecoveryResult, RecoverResult } from '@bespok3d/contract'
import type { BatchUpdatePackage, UploadProgressFn } from '../daemon-client/client'
import { fetchCapabilities, updateBatchPackages, installBatchPackages } from '../daemon-client/client'
import { loadCatalog } from '../registry'
import { getManagedRecord, parseCaps } from '../daemon-client/status'
import { daemonGuardMessage } from '../daemon-client/guard'
import { findCatalogEntry, resolveArchiveBytes } from './catalog-archive'
import { verifiedPackageTrustOrDiscard } from './package-check'
import { streamBatchProgress } from './batch-progress'
import { recordBatchOutcome, batchOkVersions } from './batch-install'
import { batchResultWithUnsent, pluginsLeftOut, pluginsStillSent, unsentPluginRows } from './batch-settlement'
import type { UnsentPackage } from './batch-settlement'
import { failedLogsAfter, refusalSentence, refusedAttempt } from './failed-installs'
import { sendUpload } from './progress'
import { capsOrFallback } from './record-sync'

// One batch daemon call: update-batch or install-batch. Both take the resolved packages and an upload
// callback and return per-plugin results; the store orchestration around them is identical.
type BatchPoster = (record: PrinterRecord, packages: BatchUpdatePackage[], onUploadProgress?: UploadProgressFn) => Promise<RecoverResult>

export interface PluginUpdateSpec {
  pluginId: string
  vars?: Record<string, string>
  depIds?: string[]
}

// Ordered, deduped plugin ids for a batch update: each update's still-missing deps (a new version
// may add one) come first, then the target. Deps-first matters because update_batch applies in order
// and does not topo-sort.
export function orderedBatchPluginIds(updates: PluginUpdateSpec[], installed: string[]): string[] {
  const ids: string[] = []
  function add(pluginId: string) {
    if (!ids.includes(pluginId)) ids.push(pluginId)
  }
  function addWithMissingDeps(update: PluginUpdateSpec) {
    (update.depIds ?? []).filter((depId) => !installed.includes(depId)).forEach(add)
    add(update.pluginId)
  }
  updates.forEach(addWithMissingDeps)

  return ids
}

// A resolved package plus the two things install time proves about it: the catalog entry its bytes were
// bound to, and the trust its own signature earned. Both are per-plugin evidence the batch has to carry
// to the record, and both are worthless if recomputed later from a re-read of the archive.
interface VerifiedBatchPackage {
  archive: BatchUpdatePackage
  entry: MergedEntry
  trust: PackageTrust
}

async function resolveVerifiedPackage(catalog: readonly MergedEntry[], pluginId: string, vars?: Record<string, string>): Promise<VerifiedBatchPackage> {
  const entry = findCatalogEntry(catalog, pluginId)
  const bytes = await resolveArchiveBytes(entry)

  return { archive: { pluginId, bytes, vars }, entry, trust: await verifiedPackageTrustOrDiscard(bytes, entry) }
}

// Each package answers for itself and never for the batch: whatever this one turns out to be, the rest
// are still installed. A refused package, or one that cannot be fetched, costs its own plugin only.
function settlePackage(
  catalog: readonly MergedEntry[],
  pluginId: string,
  vars?: Record<string, string>,
): Promise<VerifiedBatchPackage | UnsentPackage> {
  return resolveVerifiedPackage(catalog, pluginId, vars).catch((error) => ({ pluginId, reason: refusalSentence(error) }))
}

function isVerified(settled: VerifiedBatchPackage | UnsentPackage): settled is VerifiedBatchPackage {
  return 'archive' in settled
}

function isUnsent(settled: VerifiedBatchPackage | UnsentPackage): settled is UnsentPackage {
  return !isVerified(settled)
}

// What the batch will post, and what it is leaving behind. Every package is verified on its own first;
// then the plugins that need one that was left behind are pulled out too, because installing a plugin
// whose dependency never arrived is worse than not installing it.
interface SettledBatch {
  toSend: VerifiedBatchPackage[]
  unsentRows: PluginRecoveryResult[]
}

async function settleBatch(catalog: readonly MergedEntry[], specs: PluginUpdateSpec[], installed: string[]): Promise<SettledBatch> {
  const varsById = new Map(specs.map((spec) => [spec.pluginId, spec.vars]))
  const pluginIds = orderedBatchPluginIds(specs, installed)
  const settled = await Promise.all(pluginIds.map((pluginId) => settlePackage(catalog, pluginId, varsById.get(pluginId))))
  const leftOutIds = pluginsLeftOut(specs, new Set(settled.filter(isUnsent).map((item) => item.pluginId)))
  const stillSentIds = pluginsStillSent(specs, leftOutIds)

  return {
    toSend: settled.filter(isVerified).filter((item) => stillSentIds.has(item.archive.pluginId)),
    unsentRows: unsentPluginRows(specs, settled.filter(isUnsent)),
  }
}

// The printer answers for the packages it was sent and, alongside them, for the one restart of the
// services they share. That restart is not a plugin, so it never becomes a plugin's failed install.
function pluginsThatDidNotInstall(rows: readonly PluginRecoveryResult[], sentPluginIds: Set<string>): PluginRecoveryResult[] {
  return rows.filter((row) => !row.ok && sentPluginIds.has(row.pluginId))
}

function pluginsThatInstalled(rows: readonly PluginRecoveryResult[]): string[] {
  return rows.filter((row) => row.ok).map((row) => row.pluginId)
}

// Written before the printer is called at all: these plugins have already not installed, and that stays
// true whether the call that follows succeeds, fails, or is never made because nothing survived.
function recordPluginsNeverSent(printerId: string, unsentRows: PluginRecoveryResult[]): void {
  if (unsentRows.length === 0) return

  updatePrinter(printerId, (current) => ({ failedInstallLogs: failedLogsAfter(current, unsentRows, [], Date.now()) }))
}

// The printer refused the call itself (busy printing, off the network), so every package that was sent
// is a plugin that did not install and keeps that reason. Written here because the failure skips the
// write that follows the call: installing these one at a time, each would have kept the same reason.
function keptIfTheCallFails(printerId: string, sentPluginIds: string[], posting: Promise<RecoverResult>): Promise<RecoverResult> {
  return posting.catch((error: unknown) => {
    const attempts = sentPluginIds.map((pluginId) => refusedAttempt(pluginId, refusalSentence(error)))

    updatePrinter(printerId, (current) => ({ failedInstallLogs: failedLogsAfter(current, attempts, [], Date.now()) }))
    throw error
  })
}

// A printer that refuses the whole call answers with a daemon 4xx whose body is JSON. Both batches post
// through here so the user reads the same sentence either way: "Update all" refused while a print is
// running says what "Install selected" refused while a print is running says.
function guardedPoster(post: BatchPoster): BatchPoster {
  return function postAndNameTheRefusal(record, packages, onUploadProgress) {
    return post(record, packages, onUploadProgress).catch((error: unknown) => {
      const message = daemonGuardMessage(error)

      throw message ? new Error(message) : error
    })
  }
}

async function runStoreBatch(win: BrowserWindow, printerId: string, specs: PluginUpdateSpec[], post: BatchPoster): Promise<RecoverResult> {
  const record = getManagedRecord(printerId)
  const catalog = (await loadCatalog()).plugins
  const installed = parseCaps(await fetchCapabilities(record), record.ip).installedIds
  // The ordered plan (deps first) is decided here; the renderer renders every row up front, then ticks
  // each as streamBatchProgress mirrors the daemon's live feed, so a batch is never an opaque spinner.
  const { toSend, unsentRows } = await settleBatch(catalog, specs, installed)
  recordPluginsNeverSent(printerId, unsentRows)
  if (toSend.length === 0) return batchResultWithUnsent(null, unsentRows)
  const packages = toSend.map((item) => item.archive)
  const entryById = new Map(toSend.map((item) => [item.archive.pluginId, item.entry]))
  const trustById = new Map(toSend.map((item) => [item.archive.pluginId, item.trust]))
  const sentPluginIds = packages.map((entry) => entry.pluginId)
  const closeProgress = await streamBatchProgress(win, printerId, record, sentPluginIds)
  const posting = post(record, packages, (sent, total) => sendUpload(win, printerId, sent, total)).finally(closeProgress)
  const result = await keptIfTheCallFails(printerId, sentPluginIds, posting)
  // Record each OK plugin's log/source/channel (the detail Log tab + endpoints + provenance, parity
  // with a single install); fall back to the result's installed set if the capabilities fetch hiccups.
  // Provenance merges onto the freshly read record so a status ping that landed during the batch is kept.
  const parsed = await capsOrFallback(record, batchOkVersions(result, entryById))
  // Applied vars are recorded for the user-picked specs only, keyed off the specs (not the resolved
  // package list, which also carries auto-added deps sent without vars).
  const varsBySpecId = new Map(specs.map((spec) => [spec.pluginId, spec.vars]))
  const attemptedAt = Date.now()
  // Every plugin the printer could not install keeps its attempt, exactly as it would have installing
  // alone, while provenance is still fed the printer's rows only so a plugin left behind cannot reach it.
  updatePrinter(printerId, (current) => ({
    ...parsed,
    ...recordBatchOutcome(current, result, { entryById, trustById }, attemptedAt, varsBySpecId),
    failedInstallLogs: failedLogsAfter(current, pluginsThatDidNotInstall(result.results, new Set(sentPluginIds)), pluginsThatInstalled(result.results), attemptedAt),
  }))

  // The batch as the user sees it: the printer's own rows plus the plugins that never left the app.
  return batchResultWithUnsent(result, unsentRows)
}

export function runStoreUpdateBatch(win: BrowserWindow, printerId: string, updates: PluginUpdateSpec[]): Promise<RecoverResult> {
  return runStoreBatch(win, printerId, updates, guardedPoster(updateBatchPackages))
}

// Install several plugins in one daemon call (one deferred restart of the affected services). Routing
// "install selected" here instead of N sequential single installs is the Bug A fix: on the U1 it bounces
// the display compositor once for the whole set, not once per display plugin. A daemon conflict 409 is
// surfaced readably (the renderer pre-checks, the daemon backstops two mutually-exclusive picks).
export function runStoreInstallBatch(win: BrowserWindow, printerId: string, specs: PluginUpdateSpec[]): Promise<RecoverResult> {
  return runStoreBatch(win, printerId, specs, guardedPoster(installBatchPackages))
}
