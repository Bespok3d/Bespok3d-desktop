import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { normalizeMac, parseArpTable } from './arp-parse'

const octetArb = fc.integer({ min: 0, max: 255 })
const ipArb = fc.tuple(octetArb, octetArb, octetArb, octetArb).map((octets) => octets.join('.'))
const macOctetsArb = fc.array(octetArb.map((value) => value.toString(16)), { minLength: 6, maxLength: 6 })

describe('normalizeMac properties', () => {
  it('produces a canonical lower-case colon-joined form and is idempotent', () => {
    fc.assert(fc.property(macOctetsArb, fc.constantFrom(':', '-'), (octets, separator) => {
      const normalized = normalizeMac(octets.join(separator))
      expect(normalized).toMatch(/^[0-9a-f]{2}(:[0-9a-f]{2}){5}$/)
      expect(normalizeMac(normalized)).toBe(normalized)
    }))
  })
})

describe('parseArpTable properties', () => {
  it('maps each ipv4 address on a line to the normalized mac on that line', () => {
    fc.assert(fc.property(ipArb, macOctetsArb, (ip, octets) => {
      const mac = octets.join(':')
      const table = parseArpTable(`? (${ip}) at ${mac} on en0 ifscope [ethernet]`)
      expect(table.get(ip)).toBe(normalizeMac(mac))
    }))
  })
})
