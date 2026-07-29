// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { BrowserWindow } from 'electron'
import { updatePrinter } from '../printers'
import type { RecoverResult } from '@bespok3d/contract'
import { fetchCapabilities, uninstallPlugin, uninstallBatch } from '../daemon-client/client'
import { getManagedRecord, parseCaps, DAEMON_QUERY_TIMEOUT_MS } from '../daemon-client/status'
import { daemonGuardMessage } from '../daemon-client/guard'
import { sendProgress } from './progress'
import { retainRemovalProvenance } from './record-sync'

export async function runStoreUninstall(
  win: BrowserWindow,
  printerId: string,
  pluginId: string,
  cascade?: boolean,
): Promise<string[]> {
  const record = getManagedRecord(printerId)
  sendProgress(win, printerId, pluginId, 'Removing plugin…')
  try {
    await uninstallPlugin(record, pluginId, cascade)
  } catch (error) {
    const message = daemonGuardMessage(error)
    throw message ? new Error(message) : error
  }
  sendProgress(win, printerId, pluginId, 'Refreshing installed list…')
  const parsed = parseCaps(await fetchCapabilities(record, DAEMON_QUERY_TIMEOUT_MS), record.ip)
  updatePrinter(printerId, (current) => ({ ...parsed, ...retainRemovalProvenance(current, parsed.installedIds) }))

  return parsed.installedIds
}

// Remove several plugins in one daemon batch (one deferred restart through the safety net), then prune
// each removed plugin's provenance to the still-installed set. The renderer resolves cascade dependents
// locally and passes cascade=true; the daemon's dependents 409 is the backstop, surfaced readably.
export async function runStoreUninstallBatch(printerId: string, pluginIds: string[], cascade: boolean): Promise<RecoverResult> {
  const record = getManagedRecord(printerId)
  const result = await uninstallBatch(record, pluginIds, cascade).catch((error) => {
    const message = daemonGuardMessage(error)
    throw message ? new Error(message) : error
  })
  const parsed = parseCaps(await fetchCapabilities(record, DAEMON_QUERY_TIMEOUT_MS), record.ip)
  updatePrinter(printerId, (current) => ({ ...parsed, ...retainRemovalProvenance(current, parsed.installedIds) }))

  return result
}
