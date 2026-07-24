import { useState, useEffect, useRef } from 'react'
import { useClickOutside } from '../hooks/useClickOutside'

export const PICKER_W = 164
export const PICKER_H = 196

export function usePickerBehavior(open: boolean, setOpen: (open: boolean) => void) {
  const [pickerCoords, setPickerCoords] = useState({ x: 0, y: 0 })
  const wrapRef = useRef<HTMLDivElement>(null)
  useClickOutside(wrapRef, () => setOpen(false), open)

  function positionPickerOnOpen() {
    if (!open || !wrapRef.current) return
    const rect = wrapRef.current.getBoundingClientRect()
    const xPos = Math.max(8, Math.min(window.innerWidth - PICKER_W - 8, rect.left + rect.width / 2 - PICKER_W / 2))
    const yPos = rect.top > PICKER_H + 16 ? rect.top - PICKER_H - 8 : rect.bottom + 8
    setPickerCoords({ x: xPos, y: yPos })
  }

  useEffect(positionPickerOnOpen, [open])

  return { pickerCoords, wrapRef }
}
