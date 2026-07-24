import type { KeyboardEvent } from 'react'

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function focusableWithin(surface: HTMLElement): HTMLElement[] {
  return Array.from(surface.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
}

// Keep Tab focus inside the open surface: wrap from the last focusable back to the first (and the
// reverse on Shift+Tab), so keyboard focus never escapes the modal into the page behind the scrim.
export function trapTab(surface: HTMLElement | null, event: KeyboardEvent): void {
  if (!surface) return
  const focusables = focusableWithin(surface)
  if (focusables.length === 0) { event.preventDefault();

 return }
  const first = focusables[0]
  const last = focusables[focusables.length - 1]
  const focused = document.activeElement
  const leavingStart = event.shiftKey && (focused === first || focused === surface)
  const leavingEnd = !event.shiftKey && focused === last
  if (leavingStart) { last.focus(); event.preventDefault();

 return }
  if (leavingEnd) { first.focus(); event.preventDefault() }
}
