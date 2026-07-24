import { useState, useRef } from 'react'
import { useClickOutside } from '../hooks/useClickOutside'
import './flyout.css'

interface FlyoutProps {
  anchor: React.ReactNode
  children: React.ReactNode
}

export function Flyout({ anchor, children }: FlyoutProps) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  useClickOutside(wrapRef, () => setOpen(false), open)

  return (
    <div ref={wrapRef} className="u-relative">
      <div onClick={() => setOpen((prev) => !prev)}>{anchor}</div>
      {open && (
        <div className="flyout" onClick={() => setOpen(false)}>
          {children}
        </div>
      )}
    </div>
  )
}
