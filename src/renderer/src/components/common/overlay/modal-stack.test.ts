// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect, vi } from 'vitest'
import { acquireModalLevel, releaseModalLevel, anyModalOpen, subscribeToOpenModals, MODAL_BASE_LEVEL, MODAL_TOP_LEVEL } from './modal-stack'

// Acquire `count` levels, return them, then release them all so the shared counter is left empty for the
// next test (releasing back to zero resets the band to its base).
function acquireThenRelease(count: number): number[] {
  const levels = Array.from({ length: count }, acquireModalLevel)
  levels.forEach(releaseModalLevel)

  return levels
}

describe('modal open-order stacking', () => {
  it('puts the first modal at the base level', () => {
    expect(acquireThenRelease(1)).toEqual([MODAL_BASE_LEVEL])
  })

  it('lifts each modal opened on top to a strictly higher level than the one below it', () => {
    const [first, second, third] = acquireThenRelease(3)
    expect(second).toBeGreaterThan(first)
    expect(third).toBeGreaterThan(second)
  })

  it('resets to the base level once every modal has closed', () => {
    acquireModalLevel()
    acquireModalLevel()
    releaseModalLevel()
    releaseModalLevel()
    expect(acquireThenRelease(1)).toEqual([MODAL_BASE_LEVEL])
  })

  it('never lets the band reach the header: levels clamp at the ceiling', () => {
    const overflowing = MODAL_TOP_LEVEL - MODAL_BASE_LEVEL + 5
    const levels = acquireThenRelease(overflowing)
    expect(Math.max(...levels)).toBe(MODAL_TOP_LEVEL)
    levels.forEach((level) => expect(level).toBeLessThanOrEqual(MODAL_TOP_LEVEL))
  })
})

describe('whether any modal is open', () => {
  it('is told to a listener as modals open and close', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeToOpenModals(listener)
    acquireModalLevel()
    expect(anyModalOpen()).toBe(true)
    releaseModalLevel()
    expect(anyModalOpen()).toBe(false)
    unsubscribe()
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it('is not told to a listener that unsubscribed', () => {
    const listener = vi.fn()
    subscribeToOpenModals(listener)()
    acquireThenRelease(1)
    expect(listener).not.toHaveBeenCalled()
  })
})
