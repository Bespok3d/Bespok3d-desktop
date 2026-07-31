// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useEffect, useRef, useState } from 'react'

const COPIED_FEEDBACK_MS = 2000

// Copies text to the clipboard and flips `copied` true briefly so a button can show feedback. The
// hand-rolled copies (the bug-report + capture views) set the flag and never cleared it, so the
// "Copied" label stuck forever; this resets after a beat and guards its timer against unmount.
// `copyCount` lets a caller re-key an animated confirmation so a second copy replays it instead of
// riding out the first one's timeline.
export function useClipboard(feedbackMs: number = COPIED_FEEDBACK_MS) {
  const [copied, setCopied] = useState(false)
  const [copyCount, setCopyCount] = useState(0)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  function copy(text: string) {
    void navigator.clipboard?.writeText(text)
    setCopied(true)
    setCopyCount((previousCopies) => previousCopies + 1)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(false), feedbackMs)
  }

  function clearTimerOnUnmount() {
    return () => { if (timer.current) clearTimeout(timer.current) }
  }
  useEffect(clearTimerOnUnmount, [])

  return { copied, copyCount, copy }
}
