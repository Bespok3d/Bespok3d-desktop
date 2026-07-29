// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useLayoutEffect, useRef } from 'react'

// FLIP (First-Last-Invert-Play) for the plugin grid: when filtering/sorting reorders the cards, each
// card that moved is animated from its previous spot to its new one. Layout positions come from
// offsetLeft/offsetTop (not getBoundingClientRect) so a card's own entrance transform and the grid's
// scroll never contaminate the measurement.

const FLIP_DURATION_MS = 280
const FLIP_EASING = 'cubic-bezier(0.4, 0, 0.2, 1)'

interface Point {
  left: number
  top: number
}

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function snapshotPlaces(children: HTMLElement[]): Map<string, Point> {
  const places = new Map<string, Point>()
  children.forEach((child) => {
    const key = child.dataset.flipKey
    if (key) places.set(key, { left: child.offsetLeft, top: child.offsetTop })
  })

  return places
}

function slideToPlace(child: HTMLElement, from: Point, to: Point): void {
  const deltaX = from.left - to.left
  const deltaY = from.top - to.top
  if ((!deltaX && !deltaY) || typeof child.animate !== 'function') return
  child.animate(
    [{ transform: `translate(${deltaX}px, ${deltaY}px)` }, { transform: 'translate(0, 0)' }],
    { duration: FLIP_DURATION_MS, easing: FLIP_EASING },
  )
}

function playReflow(child: HTMLElement, before: Map<string, Point>, after: Map<string, Point>): void {
  const key = child.dataset.flipKey
  const from = key ? before.get(key) : undefined
  const to = key ? after.get(key) : undefined
  if (from && to) slideToPlace(child, from, to)
}

// `signature` changes whenever the grid's membership or order does; that drives the FLIP pass.
export function useGridFlip(signature: string) {
  const containerRef = useRef<HTMLDivElement>(null)
  const places = useRef<Map<string, Point>>(new Map())
  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) return
    const children = Array.from(container.children) as HTMLElement[]
    const next = snapshotPlaces(children)
    if (!prefersReducedMotion()) children.forEach((child) => playReflow(child, places.current, next))
    places.current = next
  }, [signature])

  return containerRef
}
