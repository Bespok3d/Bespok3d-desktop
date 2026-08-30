// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { BrowserWindow } from 'electron'
import { updatePrinter } from '../printers'
import type { PrinterRecord } from '../printers'
import type { MergedEntry, PackageTrust } from '../registry/model'
import type { ReleaseChannel } from '../settings'
import type { PluginRecoveryResult } from '@bespok3d/contract'
import type { BatchResult } from '../daemon-client/batch-result'
import type { BatchUpdatePackage, UploadProgressFn } from '../daemon-client/client'
import { updateBatchPackages, installBatchPackages } from '../daemon-client/client'
import { loadCatalog } from '../registry'
import { getManagedRecord } from '../daemon-client/status'
import { daemonGuardMessage } from '../daemon-client/guard'
import type { ReportedPair } from '../compat'
import { askPrinterCompat, assertPackageFitsPair } from '../compat'
import { findCatalogVariant, resolveArchiveBytes } from './catalog-archive'
import { verifiedPackageTrustOrDiscard } from './package-check'
import { streamBatchProgress } from './batch-progress'
import { recordBatchOutcome, batchOkVersions } from './batch-install'
import { batchResultWithUnsent, pluginsLeftOut, pluginsStillSent, unsentPluginRows } from './batch-settlement'
import type { UnsentPackage } from './batch-settlement'
import { failedLogsAfter, refusalSentence, refusedAttempt } from './failed-installs'
import { sendUpload } from './progress'
import { capsOrFallback } from './record-sync'
import { missingDependencyIds } from './missing-deps'
import type { PackageOrigin } from './catalog-variant'
import { reportEvent } from '../analytics'

// One batch daemon call: update-batch or install-batch. Both take the resolved packages and an upload
// callback and return per-plugin results; the store orchestration around them is identical.
type BatchPoster = (record: PrinterRecord, packages: BatchUpdatePackage[], onUploadProgress?: UploadProgressFn) => Promise<BatchResult>

export interface PluginUpdateSpec {
  pluginId: string
  vars?: Record<string, string>
  depIds?: string[]
  // The variant this update was offered from: the source the copy on the printer came from. Absent for
  // a plugin whose source was never recorded, and for the deps a batch adds on its own, and those fall
  // back to the catalog winner.
  sourceUrl?: string
  channel?: ReleaseChannel
}

// The source and channel this update was offered from, which is what the catalog has to be asked
// about: the package that goes to the printer and the requirements it is weighed against must come
// from the same entry.
function originOf(spec: PluginUpdateSpec): PackageOrigin {
  return { sourceUrl: spec.sourceUrl, channel: spec.channel }
}

// Ordered, deduped plugin ids for a batch update: each update's still-missing deps (a new version
// may add one) come first, then the target. Deps-first matters because update_batch applies in order
// and does not topo-sort.
//
// The dependencies are worked out from the catalog by the same resolver a single install uses, not
// from the list the window sent: a new version can require a service the copy on the printer never
// needed, and the window built its list around the plugin the user was looking at.
export function orderedBatchPluginIds(
  catalog: readonly MergedEntry[],
  updates: PluginUpdateSpec[],
  installed: string[],
): string[] {
  const ids: string[] = []
  function add(pluginId: string) {
    if (!ids.includes(pluginId)) ids.push(pluginId)
  }
  function addWithMissingDeps(update: PluginUpdateSpec) {
    missingDependencyIds(catalog, update.pluginId, update.depIds ?? [], installed, originOf(update)).forEach(add)
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

async function resolveVerifiedPackage(
  catalog: readonly MergedEntry[],
  spec: PluginUpdateSpec,
  pair: ReportedPair,
): Promise<VerifiedBatchPackage> {
  const { pluginId, vars } = spec
  // Resolved from the source the update was offered from: a plugin running a locally packed build is
  // updated from that same local source, never from the published copy that carries a higher number.
  const entry = findCatalogVariant(catalog, pluginId, spec.sourceUrl, spec.channel)
  // An update faces the compatibility floors a first install faces. A new version can raise the
  // daemon it needs, and the printer being updated is the one running the old one: without this the
  // batch posts a package the printer cannot run, and the plugin comes back broken rather than newer.
  assertPackageFitsPair(entry, pair)
  const bytes = await resolveArchiveBytes(entry)

  return { archive: { pluginId, bytes, vars }, entry, trust: await verifiedPackageTrustOrDiscard(bytes, entry) }
}

// Each package answers for itself and never for the batch: whatever this one turns out to be, the rest
// are still installed. A refused package, or one that cannot be fetched, costs its own plugin only.
function settlePackage(
  catalog: readonly MergedEntry[],
  spec: PluginUpdateSpec,
  pair: ReportedPair,
): Promise<VerifiedBatchPackage | UnsentPackage> {
  return resolveVerifiedPackage(catalog, spec, pair).catch((error) => ({ pluginId: spec.pluginId, reason: refusalSentence(error) }))
}

function isVerified(settled: VerifiedBatchPackage | UnsentPackage): settled is VerifiedBatchPackage {
  return 'archive' in settled
}

function isUnsent(settled: VerifiedBatchPackage | UnsentPackage): settled is UnsentPackage {
  return !isVerified(settled)
}

// What this printer already has and what it is running, read once for the whole batch: asking it per
// package would be the same two reads over and over. Both halves are allowed to fail, the way the
// single install's reads are, because they happen before a byte is sent: a printer that will not say
// what it has must not abort a batch that has not started, and a version it will not report refuses
// nothing.
interface PrinterAsItStands {
  // The plugins that already answer a dependency: installed AND switched on. A deactivated plugin is
  // on the printer serving nothing, and the printer refuses a package whose requirement only a
  // deactivated plugin would meet, so counting one as present is how an update strands the user with
  // a plugin that cannot be installed and a printer that will not accept it. Sending its package
  // again is the way back: a clean apply switches it on.
  serving: string[]
  pair: ReportedPair
}

async function printerAsItStands(record: PrinterRecord): Promise<PrinterAsItStands> {
  const [caps, compat] = await Promise.all([capsOrFallback(record, {}), askPrinterCompat(record)])
  const switchedOff = new Set(caps.deactivatedIds)

  return { serving: caps.installedIds.filter((pluginId) => !switchedOff.has(pluginId)), pair: compat.pair }
}

// What the batch will post, and what it is leaving behind. Every package is verified on its own first;
// then the plugins that need one that was left behind are pulled out too, because installing a plugin
// whose dependency never arrived is worse than not installing it.
interface SettledBatch {
  toSend: VerifiedBatchPackage[]
  unsentRows: PluginRecoveryResult[]
}

// Each request as the batch will actually carry it: the dependencies the catalog says this plugin needs
// and the printer is not serving, not just the ones the window happened to ask with. Settlement decides
// what is still wanted from this list, so a dependency the batch worked out for itself has to be in it:
// otherwise that package is fetched, verified, dropped without a word, and the printer refuses the
// plugin that needed it.
function requestsWithTheirDependencies(catalog: readonly MergedEntry[], specs: PluginUpdateSpec[], serving: string[]): PluginUpdateSpec[] {
  return specs.map((spec) => ({ ...spec, depIds: missingDependencyIds(catalog, spec.pluginId, spec.depIds ?? [], serving, originOf(spec)) }))
}

async function settleBatch(catalog: readonly MergedEntry[], specs: PluginUpdateSpec[], printer: PrinterAsItStands): Promise<SettledBatch> {
  const requests = requestsWithTheirDependencies(catalog, specs, printer.serving)
  const specById = new Map(requests.map((spec) => [spec.pluginId, spec]))
  const pluginIds = orderedBatchPluginIds(catalog, requests, printer.serving)
  const settled = await Promise.all(pluginIds.map((pluginId) => settlePackage(catalog, specById.get(pluginId) ?? { pluginId }, printer.pair)))
  const leftOutIds = pluginsLeftOut(requests, new Set(settled.filter(isUnsent).map((item) => item.pluginId)))
  const stillSentIds = pluginsStillSent(requests, leftOutIds)

  return {
    toSend: settled.filter(isVerified).filter((item) => stillSentIds.has(item.archive.pluginId)),
    unsentRows: unsentPluginRows(requests, settled.filter(isUnsent)),
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
function keptIfTheCallFails(printerId: string, sentPluginIds: string[], posting: Promise<BatchResult>): Promise<BatchResult> {
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

async function runStoreBatch(win: BrowserWindow, printerId: string, specs: PluginUpdateSpec[], post: BatchPoster): Promise<BatchResult> {
  const record = getManagedRecord(printerId)
  const catalog = (await loadCatalog()).plugins
  const printer = await printerAsItStands(record)
  // The ordered plan (deps first) is decided here; the renderer renders every row up front, then ticks
  // each as streamBatchProgress mirrors the daemon's live feed, so a batch is never an opaque spinner.
  const { toSend, unsentRows } = await settleBatch(catalog, specs, printer)
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

export function runStoreUpdateBatch(win: BrowserWindow, printerId: string, updates: PluginUpdateSpec[]): Promise<BatchResult> {
  return runStoreBatch(win, printerId, updates, guardedPoster(updateBatchPackages))
}

// Install several plugins in one daemon call (one deferred restart of the affected services). Routing
// "install selected" here instead of N sequential single installs is the Bug A fix: on the U1 it bounces
// the display compositor once for the whole set, not once per display plugin. A daemon conflict 409 is
// surfaced readably (the renderer pre-checks, the daemon backstops two mutually-exclusive picks).
export function runStoreInstallBatch(win: BrowserWindow, printerId: string, specs: PluginUpdateSpec[]): Promise<BatchResult> {
  return runStoreBatch(win, printerId, specs, guardedPoster(installBatchPackages)).then(countPluginsInstalled)
}

// Counted here and not inside runStoreBatch, which the update batch shares: an update is not an
// install. Neither is the OTA recovery that puts twelve plugins back after a firmware update, and
// that one is its own daemon call which passes nowhere near this file.
function countPluginsInstalled(batch: BatchResult): BatchResult {
  // A skipped row is the printer saying it already had that plugin. It counts as a success everywhere
  // else in this file, and it is not somebody installing anything.
  const newlyInstalled = batch.results.filter((row) => row.ok && !row.skipped)

  newlyInstalled.forEach(() => reportEvent('plugin_installed', {}))

  return batch
}
