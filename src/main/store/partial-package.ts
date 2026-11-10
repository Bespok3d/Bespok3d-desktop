// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// An install or an update sends only the files the printer does not already hold as signed. The
// printer checks every file left out against the new manifest's hash before it writes anything, so a
// file that changed between this read and the upload is refused, never silently kept.
import type { PrinterRecord } from '../printers'
import { fetchFileHashesOrNone } from '../daemon-client/client'
import { archiveKeeping, filesHeldAsSigned, signedFileHashes } from './signed-files'

// Applied after the package verified, so its trust is always earned by the whole signed package.
export async function withoutFilesThePrinterHolds(record: PrinterRecord, pluginId: string, archiveBytes: Buffer): Promise<Buffer> {
  const printerHashes = await fetchFileHashesOrNone(record, pluginId)
  if (printerHashes === null) return archiveBytes
  const heldAsSigned = filesHeldAsSigned(signedFileHashes(archiveBytes, pluginId), printerHashes)
  if (heldAsSigned.size === 0) return archiveBytes

  return archiveKeeping(archiveBytes, pluginId, (memberName) => !heldAsSigned.has(memberName))
}
