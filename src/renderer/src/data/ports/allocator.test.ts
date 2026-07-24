import { describe, it, expect } from 'vitest'
import { assignPort, makePrimary, portConflict, PRIMARY_PORT } from './allocator'

describe('assignPort', () => {
  it('gives the first UI port 80 (it becomes primary)', () => {
    expect(assignPort([])).toBe(PRIMARY_PORT)
  })

  it('gives the next UI port 81 once 80 is taken', () => {
    expect(assignPort([80])).toBe(81)
  })

  it('fills the next free port in sequence', () => {
    expect(assignPort([80, 81, 82])).toBe(83)
  })

  it('never assigns a reserved port', () => {
    expect(assignPort([7125])).toBe(PRIMARY_PORT)
  })
})

describe('makePrimary', () => {
  it('swaps the new primary onto 80 and reflows the displaced UI to 81', () => {
    expect(makePrimary({ fluidd: 80, mainsail: 81 }, 'mainsail')).toEqual({
      fluidd: 81,
      mainsail: 80,
    })
  })

  it('is a no-op when the target already holds 80', () => {
    expect(makePrimary({ fluidd: 80 }, 'fluidd')).toEqual({ fluidd: 80 })
  })

  it('reflows the displaced UI past every occupied port', () => {
    expect(makePrimary({ fluidd: 80, mainsail: 81, foo: 82 }, 'foo')).toEqual({
      foo: 80,
      mainsail: 81,
      fluidd: 82,
    })
  })
})

describe('portConflict', () => {
  it('rejects a port below 80', () => {
    expect(portConflict(79, [])).toContain('80 or higher')
  })

  it('rejects a reserved port', () => {
    expect(portConflict(7125, [])).toContain('reserved')
  })

  it('rejects a port already held by another UI', () => {
    expect(portConflict(81, [80, 81])).toContain('already used')
  })

  it('accepts a free, allowed port', () => {
    expect(portConflict(82, [80, 81])).toBeNull()
  })
})
