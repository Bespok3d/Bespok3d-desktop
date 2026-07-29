// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useEffect, useRef } from 'react'
import type { PointerEvent } from 'react'

// A backdrop press that lands as the app window regains focus (clicking back into the app after an
// app switch) should refocus, not dismiss the modal underneath. Ignore a press within this window.
const FOCUS_GRACE_MS = 200

// Dismiss only when a pointer gesture BOTH starts and ends on the backdrop itself. A bare onClick on
// the scrim also fires when the press began inside the modal (selecting text in a field, dragging)
// and was released on the backdrop, because the click targets their common ancestor: the scrim. That
// closed modals the user never meant to dismiss.
export function shouldDismissScrim(pressedScrim: boolean, releasedOnScrim: boolean): boolean {
  return pressedScrim && releasedOnScrim
}

export function useScrimDismiss(onClose?: () => void) {
  const pressedScrim = useRef(false)
  const focusedAt = useRef(0)

  function trackWindowFocus() {
    function markFocus() { focusedAt.current = Date.now() }
    window.addEventListener('focus', markFocus)

    return () => window.removeEventListener('focus', markFocus)
  }
  useEffect(trackWindowFocus, [])

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    const justRefocused = Date.now() - focusedAt.current < FOCUS_GRACE_MS
    pressedScrim.current = event.target === event.currentTarget && !justRefocused
  }
  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    const dismiss = shouldDismissScrim(pressedScrim.current, event.target === event.currentTarget)
    pressedScrim.current = false
    if (dismiss) onClose?.()
  }

  return { onPointerDown, onPointerUp }
}
