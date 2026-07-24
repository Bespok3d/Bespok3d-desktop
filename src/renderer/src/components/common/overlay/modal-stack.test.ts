import { describe, it, expect } from 'vitest'
import { acquireModalLevel, releaseModalLevel, MODAL_BASE_LEVEL, MODAL_TOP_LEVEL } from './modal-stack'

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
