// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Printer } from '../types'
import type { PrinterRecord } from '../../env'

// The renderer Printer and the persisted PrinterRecord are the same shape today; these name the two
// roles at the IPC boundary so a future divergence has one place to land.
export function toPrinter(rec: PrinterRecord): Printer {
  return rec
}

export function toRecord(printer: Printer): PrinterRecord {
  return printer
}

// The saved record for one printer, as main last wrote it. Main owns everything the printer itself
// cannot tell us (which listing each installed copy came from, on which channel, the log the install
// wrote), so a live read of the printer can never bring those back: they are re-read from here.
export function savedRecord(printerId: string): Promise<PrinterRecord | undefined> {
  return window.b3d.printers.load().then((records) => records.find((record) => record.id === printerId))
}
