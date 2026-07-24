import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import type { Plugin } from '../types'
import { makePlugin } from '../../test/fixtures'
import { resolveMissingDeps } from './index'

interface Scenario {
  plugins: Plugin[]
  target: string
  installed: string[]
}

// Plugins whose deps reference existing ids (possibly cyclic), plus a target and an installed set.
const scenarioArb: fc.Arbitrary<Scenario> = fc
  .uniqueArray(fc.string({ minLength: 1, maxLength: 3 }), { minLength: 1, maxLength: 6 })
  .chain((ids) =>
    fc
      .record({
        deps: fc.tuple(...ids.map(() => fc.subarray(ids))),
        installed: fc.subarray(ids),
        targetIndex: fc.nat(ids.length - 1),
      })
      .map(({ deps, installed, targetIndex }) => ({
        plugins: ids.map((id, slot) => makePlugin({ id, name: id, deps: deps[slot] })),
        target: ids[targetIndex],
        installed,
      })),
  )

describe('resolveMissingDeps properties', () => {
  it('returns no duplicates, excludes installed ids, and is deterministic', () => {
    fc.assert(fc.property(scenarioArb, ({ plugins, target, installed }) => {
      const result = resolveMissingDeps(plugins, target, installed)
      expect(new Set(result).size).toBe(result.length)
      expect(result.some((id) => installed.includes(id))).toBe(false)
      expect(resolveMissingDeps(plugins, target, installed)).toEqual(result)
    }))
  })
})

// Acyclic plugins by construction: plugin i may only depend on plugins 0..i-1.
const acyclicArb: fc.Arbitrary<Plugin[]> = fc.integer({ min: 1, max: 6 }).chain((count) =>
  fc
    .tuple(...Array.from({ length: count }, (_, index) =>
      index === 0 ? fc.constant<number[]>([]) : fc.uniqueArray(fc.integer({ min: 0, max: index - 1 }), { maxLength: index }),
    ))
    .map((depLists) => depLists.map((deps, index) => makePlugin({ id: `p${index}`, name: `p${index}`, deps: deps.map((dep) => `p${dep}`) }))),
)

describe('resolveMissingDeps ordering (acyclic)', () => {
  it('places every dependency before the plugins that depend on it', () => {
    fc.assert(fc.property(acyclicArb, (plugins) => {
      const target = plugins[plugins.length - 1].id
      const result = resolveMissingDeps(plugins, target, [])
      const position = new Map(result.map((id, slot) => [id, slot]))
      result.forEach((id) => {
        const plugin = plugins.find((candidate) => candidate.id === id)
        plugin?.deps.forEach((depId) => {
          if (position.has(depId)) expect(position.get(depId)!).toBeLessThan(position.get(id)!)
        })
      })
    }))
  })
})
