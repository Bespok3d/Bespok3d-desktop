import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent, ReactNode } from 'react'
import cx from '../../../utils/cx'
import { useScrimDismiss } from '../hooks/useScrimDismiss'
import { focusableWithin, trapTab } from './focus-trap'
import { acquireModalLevel, releaseModalLevel, MODAL_BASE_LEVEL } from './modal-stack'

export interface ModalProps {
  onClose?: () => void
  // Backdrop press and Escape both close a dismissable modal. A progress/blocking modal passes
  // dismissable={false} (or no onClose) so neither gesture can close it out from under the user.
  dismissable?: boolean
  scrimClassName?: string
  surfaceClassName?: string
  className?: string
  style?: CSSProperties
  children: ReactNode
}

// Claim a stacking level before the first paint (layout effect, so a modal opened on top never flashes
// underneath the one below it) and hand it back when the modal unmounts.
function claimStackingLevel(setLevel: (level: number) => void) {
  return function holdLevelWhileMounted() {
    setLevel(acquireModalLevel())

    return releaseModalLevel
  }
}

function focusOnOpen(surfaceRef: { current: HTMLDivElement | null }) {
  return function captureAndRestoreFocus() {
    const surface = surfaceRef.current
    if (!surface) return
    const previouslyFocused = document.activeElement as HTMLElement | null
    const focusables = focusableWithin(surface)
    ;(focusables[0] ?? surface).focus()

    return () => previouslyFocused?.focus?.()
  }
}

// The one modal scaffold: a dismiss-aware backdrop wrapping a focus-trapped dialog surface. Callers
// supply only the head/body/foot content and the surface sizing; Escape, backdrop press-and-release,
// focus capture/restore, and Tab trapping live here so every modal behaves the same.
export function Modal({ onClose, dismissable = true, scrimClassName = 'modal-scrim', surfaceClassName = 'modal', className, style, children }: ModalProps) {
  const canDismiss = dismissable && !!onClose
  const scrim = useScrimDismiss(canDismiss ? onClose : undefined)
  const surfaceRef = useRef<HTMLDivElement>(null)
  const [level, setLevel] = useState(MODAL_BASE_LEVEL)
  useEffect(focusOnOpen(surfaceRef), [])
  useLayoutEffect(claimStackingLevel(setLevel), [])

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    // Escape and Tab belong to THIS surface; stop them reaching an ancestor modal (a dialog opened from
    // inside another modal) so the inner one does not also close or re-trap focus on its parent.
    if (event.key !== 'Escape' && event.key !== 'Tab') return
    event.stopPropagation()
    if (event.key === 'Tab') { trapTab(surfaceRef.current, event);

 return }
    if (canDismiss) onClose?.()
  }

  return (
    <div className={scrimClassName} style={{ zIndex: level }} onKeyDown={onKeyDown} {...scrim}>
      <div
        ref={surfaceRef}
        className={cx(surfaceClassName, className)}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        style={style}
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}
