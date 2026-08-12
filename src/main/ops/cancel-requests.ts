// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A device operation runs step by step over one SSH session, and a step already sent to the printer
// cannot be taken back. Cancelling therefore means: finish the step in flight, then stop before the
// next one. The renderer asks here; the step runners read it between steps.
const printersAskedToStop = new Set<string>()

export function requestCancel(printerId: string): void {
  printersAskedToStop.add(printerId)
}

export function cancelWasRequested(printerId: string): boolean {
  return printersAskedToStop.has(printerId)
}

// Cleared when an operation starts and when it ends, so a cancel from a finished operation can never
// stop the next one.
export function clearCancelRequest(printerId: string): void {
  printersAskedToStop.delete(printerId)
}
