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
