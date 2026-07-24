import { useState } from 'react'

const RING_CENTER = 60
const RING_RADIUS = 48

function hueFromPointerEvent(event: React.PointerEvent<HTMLDivElement>): number {
  const rect = event.currentTarget.getBoundingClientRect()
  const dx = event.clientX - rect.left - rect.width / 2
  const dy = event.clientY - rect.top - rect.height / 2

  return ((Math.atan2(dy, dx) * 180) / Math.PI + 90 + 360) % 360
}

interface HueRingProps {
  hue: number
  onChange: (hue: number) => void
}

export function HueRing({ hue, onChange }: HueRingProps) {
  const [dragging, setDragging] = useState(false)
  const [dragHue, setDragHue] = useState<number | null>(null)

  const activeHue = dragHue ?? hue
  const thumbX = RING_CENTER + RING_RADIUS * Math.cos(((activeHue - 90) * Math.PI) / 180)
  const thumbY = RING_CENTER + RING_RADIUS * Math.sin(((activeHue - 90) * Math.PI) / 180)

  function updateHue(event: React.PointerEvent<HTMLDivElement>) {
    const nextHue = hueFromPointerEvent(event)
    setDragHue(nextHue)
    onChange(nextHue)
  }

  return (
    <div
      className="hue-ring"
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId)
        setDragging(true)
        updateHue(event)
      }}
      onPointerMove={(event) => {
        if (dragging) updateHue(event)
      }}
      onPointerUp={(event) => {
        event.currentTarget.releasePointerCapture(event.pointerId)
        setDragging(false)
        setDragHue(null)
      }}
    >
      <div className="hue-thumb" style={{ left: thumbX, top: thumbY }} />
    </div>
  )
}
