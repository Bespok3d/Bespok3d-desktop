// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// The printer's own view of an installed plugin's files: what each one hashes to now, and the way to put
// back the ones that changed. Both are about the files the installed manifest lists, never any other
// file in the plugin folder, so a plugin's own settings kept beside its files are never named here.
import type { FileHashesResult, RestoreFilesResult } from '@bespok3d/contract'
import type { PrinterRecord } from '../printers'
import { buildMultipart, multipartBoundary } from './packages-client'
import { doRequest, LONG_OP_TIMEOUT_MS } from './transport'

export type PrinterFileHashes = FileHashesResult['files']

// Hashing reads every listed file on the printer, which on a large plugin is no quick status read.
async function fetchFileHashes(record: PrinterRecord, pluginId: string): Promise<PrinterFileHashes> {
  const text = await doRequest(record, 'GET', `/plugins/${pluginId}/file-hashes`, undefined, undefined, LONG_OP_TIMEOUT_MS)

  return (JSON.parse(text) as FileHashesResult).files
}

// Knowing what the printer holds only ever saves work: without it the whole package is sent, or nothing
// is restored, which is exactly what happened before the printer could say. A daemon too old to have the
// route answers 404, so a failed read is logged and stands for "not known", never an error of its own.
export function fetchFileHashesOrNone(record: PrinterRecord, pluginId: string): Promise<PrinterFileHashes | null> {
  return fetchFileHashes(record, pluginId).catch((unreadable: unknown) => {
    console.warn(`[plugin-files] could not read the file hashes of ${pluginId}: ${String(unreadable)}`)

    return null
  })
}

export async function restoreFiles(record: PrinterRecord, pluginId: string, changedFilesArchive: Buffer): Promise<string[]> {
  const boundary = multipartBoundary()
  const body = buildMultipart(boundary, pluginId, changedFilesArchive)
  const text = await doRequest(
    record,
    'POST',
    `/plugins/${pluginId}/restore-files`,
    body,
    `multipart/form-data; boundary=${boundary}`,
    LONG_OP_TIMEOUT_MS,
  )

  return (JSON.parse(text) as RestoreFilesResult).restored
}
