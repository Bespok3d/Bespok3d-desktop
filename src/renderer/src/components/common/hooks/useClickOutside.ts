// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useEffect, useRef, type RefObject } from 'react'

// Closes a popover/menu when a pointer press lands outside `ref`. `enabled` gates the listener so a
// closed menu keeps no document-level handler attached: the hand-rolled copies that skipped this guard
// (PrinterForceMenu, PrinterDropdown) left a listener live for the component's whole lifetime, drifting
// from the ones that gated on the open flag (Flyout, the icon picker, PurposeChip). The latest callback
// is held in a ref so passing an inline `() => setOpen(false)` does not re-attach the listener each render.
export function useClickOutside(ref: RefObject<HTMLElement | null>, onOutside: () => void, enabled = true): void {
  const latest = useRef(onOutside)
  latest.current = onOutside

  function trackOutsidePress() {
    if (!enabled) return
    function onPress(event: MouseEvent) {
      if (!ref.current?.contains(event.target as Node)) latest.current()
    }
    document.addEventListener('mousedown', onPress)

    return () => document.removeEventListener('mousedown', onPress)
  }
  useEffect(trackOutsidePress, [ref, enabled])
}
