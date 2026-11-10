// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// A repair or a recovery puts back every installed plugin file that no longer matches its signed copy,
// before the printer re-applies its plugins, so what is re-applied is what was installed. Only the
// files that changed travel, and only the files the package lists are ever compared.
import type { PrinterRecord } from '../printers'
import type { MergedEntry } from '../registry/model'
import { loadCatalog } from '../registry'
import type { BatchResult } from '../daemon-client/batch-result'
import { fetchFileHashesOrNone, recoverPackages, repairOrRecover, restoreFiles } from '../daemon-client/client'
import { catalogVariantOrNone } from './catalog-variant'
import { resolveArchiveBytes } from './catalog-archive'
import { verifiedPackageTrustOrDiscard } from './package-check'
import { archiveKeeping, filesChangedOnPrinter, signedFileHashes } from './signed-files'

// The printer checks each file it is sent against the manifest it installed, so only the catalog's
// copy of that same version can repair it: a plugin whose version left the catalog is left as it is.
function installedCopyInCatalog(record: PrinterRecord, catalog: readonly MergedEntry[], pluginId: string): MergedEntry | undefined {
  const origin = { sourceUrl: record.installedSources?.[pluginId], channel: record.installedChannels?.[pluginId] }
  const entry = catalogVariantOrNone(catalog, pluginId, origin)

  return entry?.version === record.installedVersions?.[pluginId] ? entry : undefined
}

async function restoreOnePlugin(record: PrinterRecord, entry: MergedEntry, pluginId: string): Promise<boolean> {
  const archiveBytes = await resolveArchiveBytes(entry)
  await verifiedPackageTrustOrDiscard(archiveBytes, entry)
  const printerHashes = await fetchFileHashesOrNone(record, pluginId)
  if (printerHashes === null) return false
  const changed = filesChangedOnPrinter(signedFileHashes(archiveBytes, pluginId), printerHashes)
  if (changed.size === 0) return false
  await restoreFiles(record, pluginId, archiveKeeping(archiveBytes, pluginId, (memberName) => changed.has(memberName)))

  return true
}

// One plugin that cannot be repaired never stops the others, nor the recovery that follows.
function restoreOrSkip(record: PrinterRecord, catalog: readonly MergedEntry[], pluginId: string): Promise<boolean> {
  const entry = installedCopyInCatalog(record, catalog, pluginId)
  if (!entry) return Promise.resolve(false)

  return restoreOnePlugin(record, entry, pluginId).catch((unrestored: unknown) => {
    console.warn(`[restore-files] could not restore the files of ${pluginId}: ${String(unrestored)}`)

    return false
  })
}

// Answers the plugins that had files put back.
export async function restoreChangedFiles(record: PrinterRecord): Promise<string[]> {
  const catalog = (await loadCatalog()).plugins
  const pluginIds = Object.keys(record.installedVersions ?? {})
  const restored = await Promise.all(pluginIds.map((pluginId) => restoreOrSkip(record, catalog, pluginId)))

  return pluginIds.filter((_pluginId, position) => restored[position])
}

// A plugin whose files were put back is re-applied in full, so the setup-only repair cannot leave the
// restored files sitting under services still running what was there before.
export async function repairWithRestoredFiles(record: PrinterRecord, rebootFollows: boolean): Promise<BatchResult> {
  const restoredIds = await restoreChangedFiles(record)
  if (restoredIds.length > 0) return recoverPackages(record, rebootFollows)

  return repairOrRecover(record, rebootFollows)
}
