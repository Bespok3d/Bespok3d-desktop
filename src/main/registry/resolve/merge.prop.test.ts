import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import type { MergedEntry } from '../model'
import { dedupeEntries, collapseToVariants } from './merge'

const versionArb = fc.tuple(fc.nat(9), fc.nat(9), fc.nat(9)).map(([major, minor, patch]) => `${major}.${minor}.${patch}`)
const entryArb: fc.Arbitrary<MergedEntry> = fc.record({
  name: fc.constantFrom('alpha', 'beta', 'gamma', 'delta'),
  version: versionArb,
  trust: fc.constantFrom('any', 'community', 'project', 'manufacturer'),
  signer: fc.constantFrom('Bespok3d', null),
  registry_url: fc.string(),
})
const entriesArb = fc.array(entryArb, { maxLength: 12 })

function distinctNames(entries: MergedEntry[]): string[] {
  return [...new Set(entries.map((entry) => entry.name))]
}

describe('dedupeEntries properties', () => {
  it('collapses to one winner per name, drawn from the input, deterministically', () => {
    fc.assert(fc.property(entriesArb, (entries) => {
      const result = dedupeEntries(entries)
      const names = result.map((entry) => entry.name)
      expect(new Set(names).size).toBe(names.length)
      expect(names.length).toBe(distinctNames(entries).length)
      result.forEach((entry) => expect(entries).toContain(entry))
      expect(dedupeEntries(entries)).toEqual(result)
    }))
  })
})

describe('collapseToVariants properties', () => {
  it('keeps first-seen name order and carries every same-name entry as a variant', () => {
    fc.assert(fc.property(entriesArb, (entries) => {
      const result = collapseToVariants(entries)
      expect(result.map((entry) => entry.name)).toEqual(distinctNames(entries))
      result.forEach((entry) => {
        const sameName = entries.filter((candidate) => candidate.name === entry.name)
        expect(entry.variants).toHaveLength(sameName.length)
      })
    }))
  })
})
