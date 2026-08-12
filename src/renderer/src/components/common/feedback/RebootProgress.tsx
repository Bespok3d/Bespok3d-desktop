// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The bar the user watches while a printer restarts. It empties over the time that printer takes to
// come back, which the adapter declares, and takes itself off the screen when it reaches empty: a
// printer still down past its own restart time has nothing left to count, so the bar stops claiming to.
import { useState, useEffect } from 'react'
import './reboot-progress.css'

const TICK_MS = 200
const MS_PER_SECOND = 1000

export function RebootProgress({ restartSeconds }: { restartSeconds: number }) {
  const [elapsedMs, setElapsedMs] = useState(0)
  const restartMs = restartSeconds * MS_PER_SECOND

  function emptyWhileTheUserWaits() {
    var startedAt = Date.now()
    var ticker = setInterval(function tick() {
      const waitedMs = Date.now() - startedAt
      setElapsedMs(Math.min(waitedMs, restartMs))
      if (waitedMs >= restartMs) clearInterval(ticker)
    }, TICK_MS)

    return function stopEmptying() { clearInterval(ticker) }
  }

  useEffect(emptyWhileTheUserWaits, [restartMs])

  const remainingPct = Math.max(0, 100 - Math.round((elapsedMs / restartMs) * 100))
  if (remainingPct === 0) return null

  return (
    <div className="progress u-w-full">
      <div className="progress-bar restarting" style={{ width: `${remainingPct}%` }} />
    </div>
  )
}
