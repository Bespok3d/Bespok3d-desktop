import { useState, useEffect, useRef } from 'react'

import type { Printer } from '../../data/types'

// How long a feed value is trusted before the feed is re-subscribed to re-verify it. The feed pushes
// the jinni's blocked-action token set on change AND delivers the current set on connect, so silence
// normally means "unchanged". This only re-verifies a feed that has gone silent on a half-open
// connection; the daemon re-checks live at actuation regardless, so this governs only the UI lock.
const STALE_MS = 20000
const STALE_TICK_MS = 8000

// Truly-live blocked-action state for the open managed printer: watch only while the store is showing
// it (on-demand, not polled). The daemon's feed pushes the token set on change and emits the current
// set the instant the socket connects (the fallback-on-open: the lock is right without a separate
// pull). A feed gone stale past STALE_MS is re-subscribed so the lock is never shown stale.
export function usePrintState(printer: Printer | null | undefined): { printActive: boolean; blockedActions: string[] } {
  const [blockedActions, setBlockedActions] = useState<string[]>([])
  const lastAt = useRef(0)
  useEffect(() => {
    if (printer?.status !== 'managed' || !printer.id) {
      setBlockedActions([])
      lastAt.current = 0

      return
    }
    const printerId = printer.id
    const live = { current: true }
    function apply(event: PrintStateEvent): void {
      if (!live.current || event.printerId !== printerId) return
      lastAt.current = event.at
      setBlockedActions(event.blockedActions)
    }
    window.b3d.printers.watchPrintState(printerId)
    const unsubscribe = window.b3d.printers.onPrintState(apply)
    const tick = setInterval(() => {
      if (lastAt.current > 0 && Date.now() - lastAt.current > STALE_MS) {
        window.b3d.printers.unwatchPrintState(printerId)
        window.b3d.printers.watchPrintState(printerId)
      }
    }, STALE_TICK_MS)

    return () => {
      live.current = false
      clearInterval(tick)
      unsubscribe()
      window.b3d.printers.unwatchPrintState(printerId)
      setBlockedActions([])
      lastAt.current = 0
    }
  }, [printer?.id, printer?.status])

  return { printActive: blockedActions.length > 0, blockedActions }
}
