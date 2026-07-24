import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { isDaemonVersionAtLeast } from './version'

const partsArb = fc.array(fc.integer({ min: 0, max: 999 }), { minLength: 1, maxLength: 4 })

// Independent (lexicographic) restatement of "current >= required" over zero-padded numeric slots,
// used to cross-check the implementation rather than mirror it.
function numericAtLeast(current: number[], required: number[]): boolean {
  const slots = Math.max(current.length, required.length)
  function padded(parts: number[]): number[] {
    return Array.from({ length: slots }, (_, slot) => parts[slot] ?? 0)
  }
  const left = padded(current)
  const right = padded(required)
  const firstDiff = left.findIndex((value, slot) => value !== right[slot])

  return firstDiff === -1 ? true : left[firstDiff] > right[firstDiff]
}

describe('isDaemonVersionAtLeast properties', () => {
  it('matches lexicographic numeric comparison', () => {
    fc.assert(fc.property(partsArb, partsArb, (current, required) => {
      expect(isDaemonVersionAtLeast(current.join('.'), required.join('.'))).toBe(numericAtLeast(current, required))
    }))
  })

  it('is reflexive', () => {
    fc.assert(fc.property(partsArb, (parts) => {
      expect(isDaemonVersionAtLeast(parts.join('.'), parts.join('.'))).toBe(true)
    }))
  })

  it('holds in at least one direction for any pair (total order)', () => {
    fc.assert(fc.property(partsArb, partsArb, (current, required) => {
      const forward = isDaemonVersionAtLeast(current.join('.'), required.join('.'))
      const backward = isDaemonVersionAtLeast(required.join('.'), current.join('.'))
      expect(forward || backward).toBe(true)
    }))
  })
})
