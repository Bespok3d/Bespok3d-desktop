// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useEffect, useRef } from 'react'
import type { BatchResult } from '../../../../main/daemon-client/batch-result'
import { HELD_REPORTS_KEY, forgetFor, keepFor } from '../batch-ops/kept-over-a-quit'

// Restarting the plugins answers which ones it left off before the printer's reboot even starts, and
// this window stays up on that reboot, so a report shown at once opens over a reboot still under way.
// It is held until the window is gone, whichever way it goes; one that answers later is shown at once.
// The window can go long after its first render, so the report goes to the listener of that moment.
//
// The user may quit the app while the window is up, so a held report is also kept where it outlives
// the app, and the next launch shows it. The window that hands it over forgets that copy. A newer
// report of the printer, held or shown at once, replaces the copy an earlier run kept; a window that
// got none leaves that copy alone.
export function useReportOnceTheWindowCloses(printerId: string, onPluginsLeftOff?: (printerId: string, reapplied: BatchResult) => void): (reapplied: BatchResult) => void {
  const heldReport = useRef<BatchResult | null>(null)
  const windowGone = useRef(false)
  const latestListener = useRef(onPluginsLeftOff)
  latestListener.current = onPluginsLeftOff

  function showTheReport(reapplied: BatchResult) {
    if (latestListener.current) latestListener.current(printerId, reapplied)
  }
  function showTheHeldReport() {
    windowGone.current = true
    if (!heldReport.current) return
    forgetFor(HELD_REPORTS_KEY, printerId)
    showTheReport(heldReport.current)
    heldReport.current = null
  }
  // A development remount runs the cleanup once before the window is really up.
  useEffect(function showTheHeldReportOnceTheWindowIsGone() {
    windowGone.current = false

    return showTheHeldReport
  }, [])

  return function holdTheReport(reapplied: BatchResult) {
    if (windowGone.current) {
      forgetFor(HELD_REPORTS_KEY, printerId)
      showTheReport(reapplied)

      return
    }
    heldReport.current = reapplied
    keepFor(HELD_REPORTS_KEY, printerId, { reapplied, heldAt: Date.now() })
  }
}
