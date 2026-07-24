import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { assignPort, makePrimary, PRIMARY_PORT, RESERVED_PORTS } from './allocator'

const portArb = fc.integer({ min: 1, max: 65535 })

describe('assignPort properties', () => {
  it('never returns a reserved port, an already-taken port, or anything below the primary port', () => {
    fc.assert(fc.property(fc.array(portArb), (taken) => {
      const assigned = assignPort(taken)
      expect(assigned).toBeGreaterThanOrEqual(PRIMARY_PORT)
      expect(RESERVED_PORTS).not.toContain(assigned)
      expect(taken).not.toContain(assigned)
    }))
  })
})

const idsArb = fc.uniqueArray(fc.string({ minLength: 1 }), { minLength: 1, maxLength: 5 })
const distinctPortsArb = fc.uniqueArray(fc.integer({ min: 80, max: 300 }), { minLength: 5, maxLength: 5 })

function recordFrom(ids: string[], ports: number[]): Record<string, number> {
  return Object.fromEntries(ids.map((id, slot) => [id, ports[slot]]))
}

describe('makePrimary properties', () => {
  it('puts the chosen plugin on the primary port while keeping every port distinct', () => {
    fc.assert(fc.property(idsArb, distinctPortsArb, (ids, ports) => {
      const result = makePrimary(recordFrom(ids, ports), ids[0])
      expect(result[ids[0]]).toBe(PRIMARY_PORT)
      const assigned = Object.values(result)
      expect(new Set(assigned).size).toBe(assigned.length)
      expect(Object.keys(result).sort()).toEqual([...ids].sort())
    }))
  })

  it('is idempotent once a plugin is already primary', () => {
    fc.assert(fc.property(idsArb, distinctPortsArb, (ids, ports) => {
      const once = makePrimary(recordFrom(ids, ports), ids[0])
      expect(makePrimary(once, ids[0])).toEqual(once)
    }))
  })
})
