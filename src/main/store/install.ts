// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { BrowserWindow } from 'electron'
import type { PrinterRecord } from '../printers'
import { updatePrinter } from '../printers'
import type { ReleaseChannel } from '../settings'
import type { MergedEntry, PackageTrust } from '../registry/model'
import type { InstallLog } from '@bespok3d/contract'
import { fetchCapabilities, installPlugin } from '../daemon-client/client'
import { loadCatalog } from '../registry'
import { getManagedRecord, parseCaps } from '../daemon-client/status'
import { withFreshestRelease } from '../registry/resolve/refresh-entry'
import { discardCachedArchive, findCatalogVariant, resolveArchiveBytes } from './catalog-archive'
import { MALFORMED_PACKAGE_PREFIX } from './malformed-package'
import { verifiedPackageTrustOrDiscard } from './package-check'
import { DependencyDidNotInstall, failedLogsAfter, refusedAttempt, whyItDidNotInstall } from './failed-installs'
import { watchInstallProgress, installPhaseMessage } from '../daemon-client/feeds/install-progress'
import { daemonGuardMessage } from '../daemon-client/guard'
import { sendProgress, sendUpload } from './progress'
import { capsAfterInstall, recordAppliedVars } from './record-sync'

// Deps install one at a time, in order (a dependency must be on the printer before the plugin that
// needs it), so this walks the list head-then-tail by recursion rather than firing them concurrently.
async function installDepsInOrder(
  win: BrowserWindow,
  record: PrinterRecord,
  catalog: readonly MergedEntry[],
  pluginId: string,
  channel: ReleaseChannel | undefined,
  remaining: readonly string[],
): Promise<void> {
  const [depId, ...rest] = remaining
  if (depId === undefined) return

  sendProgress(win, record.id, pluginId, `Installing dependency ${depId}…`)
  // A dependency is a package like any other and reaches the printer the same way, so it faces the
  // same verification. Its derived tier is not recorded: provenance is tracked for what the user chose
  // to install, and a refusal here aborts the whole install before anything of the plugin itself lands.
  const depEntry = findCatalogVariant(catalog, depId, undefined, channel)
  const depArchive = await resolveArchiveBytes(depEntry)
  // The dependency is the plugin that did not install here, so it keeps its own failed attempt, the
  // way it would if the user had installed it first by hand; the plugin waiting on it fails right after.
  await verifiedPackageTrustOrDiscard(depArchive, depEntry)
    .then(() => installPlugin(record, depArchive, depId))
    .catch((error) => {
      recordFailedInstall(record.id, depId, error)
      throw new DependencyDidNotInstall(depId, error)
    })

  return installDepsInOrder(win, record, catalog, pluginId, channel, rest)
}

// Returns the dependencies this install put on the printer: a dependency that installed here is a
// plugin that just installed, so an earlier failed attempt of it is no longer about anything.
async function installMissingDeps(
  win: BrowserWindow,
  record: PrinterRecord,
  catalog: readonly MergedEntry[],
  pluginId: string,
  depIds?: string[],
  channel?: ReleaseChannel,
): Promise<string[]> {
  const alreadyInstalled = parseCaps(await fetchCapabilities(record), record.ip).installedIds
  const missingDeps = (depIds ?? []).filter((depId) => !alreadyInstalled.includes(depId))
  await installDepsInOrder(win, record, catalog, pluginId, channel, missingDeps)

  return missingDeps
}

interface SentPackage {
  log: InstallLog
  packageTrust: PackageTrust
}

async function sendPackageOnce(
  win: BrowserWindow,
  record: PrinterRecord,
  entry: MergedEntry,
  pluginId: string,
  vars?: Record<string, string>,
): Promise<SentPackage> {
  const b3Data = await resolveArchiveBytes(entry)
  // Verification sits between resolution and upload so it covers every way the bytes arrived: a
  // bundled read, a fresh download, and a cache hit alike. The cache is ordinary local disk, so a
  // buffer that verified when it was written proves nothing about the file being read back now.
  const packageTrust = await verifiedPackageTrustOrDiscard(b3Data, entry)
  const closeProgress = await watchInstallProgress(record, (event) => {
    if (event.type === 'phase' && event.phase) sendProgress(win, record.id, pluginId, installPhaseMessage(event.phase))
  })
  const log: InstallLog = await installPlugin(record, b3Data, pluginId, vars, (sent, total) => sendUpload(win, record.id, sent, total)).finally(closeProgress)

  return { log, packageTrust }
}

function isMalformedPackageRefusal(failure: unknown): boolean {
  return daemonGuardMessage(failure)?.startsWith(MALFORMED_PACKAGE_PREFIX) ?? false
}

// Send the package to the printer, and when the printer refuses the bytes as malformed, send the
// freshly downloaded copy instead. The download cache is keyed by plugin name and version, so a
// package rebuilt and re-released at the same version is handed back from the cache for good: the
// user would be stuck on a refusal the current release does not have, with no way to reach it. The
// printer's refusal is the proof that copy is wrong, so it is thrown away and the download happens
// again, once. A freshly downloaded package refused the same way is a defect in the release itself
// and propagates, and so does a refusal of a package that was never downloaded (a bundled one).
function sendPackage(
  win: BrowserWindow,
  record: PrinterRecord,
  entry: MergedEntry,
  pluginId: string,
  vars?: Record<string, string>,
): Promise<SentPackage> {
  return sendPackageOnce(win, record, entry, pluginId, vars).catch((refusal) => {
    if (!isMalformedPackageRefusal(refusal)) throw refusal
    if (!discardCachedArchive(entry)) throw refusal

    return sendPackageOnce(win, record, entry, pluginId, vars)
  })
}

async function runStoreInstall(
  win: BrowserWindow,
  printerId: string,
  pluginId: string,
  vars?: Record<string, string>,
  depIds?: string[],
  sourceUrl?: string,
  channel?: ReleaseChannel,
): Promise<{ installedIds: string[]; log: InstallLog }> {
  const record = getManagedRecord(printerId)
  const catalog = (await loadCatalog()).plugins
  const installedDepIds = await installMissingDeps(win, record, catalog, pluginId, depIds, channel)
  // Asked afresh, not taken from the list: the store page showed whatever this plugin's repo last
  // released, so the install has to fetch that same release or the owner gets an older build than the
  // number he clicked. A repo that cannot answer leaves the listed entry as it was.
  const entry = await withFreshestRelease(findCatalogVariant(catalog, pluginId, sourceUrl, channel))
  sendProgress(win, printerId, pluginId, 'Sending to printer…')
  const { log, packageTrust } = await sendPackage(win, record, entry, pluginId, vars)
  sendProgress(win, printerId, pluginId, 'Updating plugin list…')
  // The install succeeded on the device, so its source/channel provenance is now true regardless of
  // whether the follow-up capabilities fetch works. Record it independently: a transient post-install
  // fetch failure (a service the plugin restarted is still settling) must never strand the plugin as
  // "not from a listed source" with no recorded origin. The provenance merges onto the freshly read
  // record so a status ping that landed during this install (a separate field) is not clobbered.
  const parsed = await capsAfterInstall(record, pluginId, entry.version)
  updatePrinter(printerId, (current) => ({
    ...parsed,
    installedSources: { ...current.installedSources, [pluginId]: entry.registry_url },
    installedChannels: { ...current.installedChannels, [pluginId]: entry.channel as ReleaseChannel },
    installedPackageTrust: { ...current.installedPackageTrust, [pluginId]: packageTrust },
    installLogs: { ...current.installLogs, [pluginId]: log },
    // These installed, so whatever an earlier attempt of them failed at is no longer about anything.
    failedInstallLogs: failedLogsAfter(current, [], [...installedDepIds, pluginId], Date.now()),
    ...recordAppliedVars(current, pluginId, vars, new Date().toISOString()),
  }))

  return { installedIds: parsed.installedIds, log }
}

// A plugin that did not install leaves the same trace whether the user installed it on its own or in a
// batch: the reason it failed, kept on the printer until that plugin installs. The plugin's own install
// log is untouched, so a refused UPDATE never overwrites the log of the version already on the printer.
function recordFailedInstall(printerId: string, pluginId: string, failure: unknown): void {
  const attempt = refusedAttempt(pluginId, whyItDidNotInstall(failure))

  updatePrinter(printerId, (current) => ({ failedInstallLogs: failedLogsAfter(current, [attempt], [], Date.now()) }))
}

export function installGuarded(
  ...args: Parameters<typeof runStoreInstall>
): Promise<{ installedIds: string[]; log: InstallLog }> {
  const [, printerId, pluginId] = args

  return runStoreInstall(...args).catch((error) => {
    const message = daemonGuardMessage(error)
    const failure = message ? new Error(message) : error

    recordFailedInstall(printerId, pluginId, failure)
    throw failure
  })
}
