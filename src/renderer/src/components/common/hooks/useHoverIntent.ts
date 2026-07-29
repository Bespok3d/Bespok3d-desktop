// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useState, useRef, useEffect } from 'react'

interface HoverIntent {
  active: boolean
  open: () => void
  scheduleClose: () => void
}

// Open-on-enter, close-after-a-grace-period hover state for a sub-flyout: moving the pointer from the
// trigger across a small gap to the flyout must not dismiss it. The pending close timer is cleared on
// reopen and on unmount, so a late timeout never toggles state on an unmounted component (the leak the
// hand-rolled dropdown copy had).
export function useHoverIntent(delayMs: number): HoverIntent {
  const [active, setActive] = useState(false)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function cancelClose() {
    if (closeTimer.current) clearTimeout(closeTimer.current)
  }
  function open() {
    cancelClose()
    setActive(true)
  }
  function scheduleClose() {
    closeTimer.current = setTimeout(() => setActive(false), delayMs)
  }
  function cancelCloseOnUnmount() {
    return cancelClose
  }
  useEffect(cancelCloseOnUnmount, [])

  return { active, open, scheduleClose }
}
