// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// What the printer itself says about a long job it is running. The printer offers no "busy" status to
// ask for: its live progress feed is the only word it gives while it works. Every open feed reports
// here, and a long request that has heard nothing for a while asks here before it gives up.
interface WorkReporter {
  printerId: string
  printerIsAtWork: () => boolean
}

const workReporters = new Set<WorkReporter>()

// Returns the function that withdraws the report, run when its feed closes.
export function reportPrinterWork(printerId: string, printerIsAtWork: () => boolean): () => void {
  const reporter = { printerId, printerIsAtWork }
  workReporters.add(reporter)

  return () => { workReporters.delete(reporter) }
}

export function printerSaysItIsAtWork(printerId: string): boolean {
  return [...workReporters].some((reporter) => reporter.printerId === printerId && reporter.printerIsAtWork())
}
