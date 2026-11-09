// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useEffect, useRef } from 'react'
import type { BatchResult } from '../../../../main/daemon-client/batch-result'

// Restarting the plugins answers which ones it left off before the printer's reboot even starts, and
// this window stays up on that reboot, so a report shown at once opens over a reboot still under way.
// It is held until the window is gone, whichever way it goes; one that answers later is shown at once.
// The window can go long after its first render, so the report goes to the listener of that moment.
export function useReportOnceTheWindowCloses(onPluginsLeftOff?: (reapplied: BatchResult) => void): (reapplied: BatchResult) => void {
  const heldReport = useRef<BatchResult | null>(null)
  const windowGone = useRef(false)
  const latestListener = useRef(onPluginsLeftOff)
  latestListener.current = onPluginsLeftOff

  function showTheReport(reapplied: BatchResult | null) {
    if (reapplied && latestListener.current) latestListener.current(reapplied)
  }
  function showTheHeldReport() {
    windowGone.current = true
    showTheReport(heldReport.current)
    heldReport.current = null
  }
  // A development remount runs the cleanup once before the window is really up.
  useEffect(function showTheHeldReportOnceTheWindowIsGone() {
    windowGone.current = false

    return showTheHeldReport
  }, [])

  return function holdTheReport(reapplied: BatchResult) {
    if (windowGone.current) showTheReport(reapplied)
    else heldReport.current = reapplied
  }
}
