// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { applyToId, savedRecord } from '../../data/printers'
import type { Printer } from '../../data/types'
import type { PrinterRecord } from '../../env'

type OnPrinterUpdate = (updater: (prev: Printer[]) => Printer[]) => void

// A missing record means the read told us nothing, so the sources already on screen stay: patching
// them to undefined would blank where every installed copy came from.
function applyInstallProvenance(printerId: string, onPrinterUpdate: OnPrinterUpdate | undefined, record: PrinterRecord | undefined) {
  if (!record) return
  onPrinterUpdate?.(applyToId(printerId, {
    installedSources: record.installedSources,
    installedChannels: record.installedChannels,
    installLogs: record.installLogs,
    failedInstallLogs: record.failedInstallLogs,
  }))
}

// Which listing each installed copy came from, and on which channel, is written to the printer record
// by main and is nowhere on the printer, so a live read of the printer cannot carry it. Without this
// re-read the running app keeps the sources it loaded at start-up: a plugin just installed from a
// locally packed build still counts as the published one, and the store goes on offering that build
// (and update-all pushes it onto the printer) until the app is closed and reopened.
export function refreshInstallProvenance(printerId: string, onPrinterUpdate: OnPrinterUpdate | undefined): void {
  savedRecord(printerId)
    .then((record) => applyInstallProvenance(printerId, onPrinterUpdate, record))
    .catch((error) => console.warn('[store] could not re-read the saved printer record', error))
}
