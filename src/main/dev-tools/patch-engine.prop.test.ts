import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import type { HunkLine } from './types'
import { parseUnifiedDiff, buildSession } from './patch-engine'

// Alphanumeric text that, prefixed by a diff tag, can never look like a +++/--- file header or a
// blank context line, so a serialized hunk parses back to exactly the lines it was built from.
const safeTextArb = fc.nat().map((value) => `x${value.toString(36)}`)
const lineArb = fc.record({ tag: fc.constantFrom(' ', '+', '-'), text: safeTextArb })
const offsetArb = fc.integer({ min: 1, max: 9999 })
const linesArb = fc.array(lineArb, { minLength: 1, maxLength: 8 })

function buildDiff(offset: number, lines: HunkLine[]): string {
  const header = `@@ -${offset},${lines.length} +${offset},${lines.length} @@`

  return [header, ...lines.map((line) => `${line.tag}${line.text}`)].join('\n')
}

describe('parseUnifiedDiff properties', () => {
  it('round-trips a serialized hunk back to its lines and suggested offset', () => {
    fc.assert(fc.property(offsetArb, linesArb, (offset, lines) => {
      const hunks = parseUnifiedDiff(buildDiff(offset, lines))
      expect(hunks).toHaveLength(1)
      expect(hunks[0].lines).toEqual(lines)
      expect(hunks[0].suggestedOffset).toBe(offset)
    }))
  })
})

const contentArb = fc.array(safeTextArb, { maxLength: 20 }).map((lines) => lines.join('\n'))

describe('buildSession properties', () => {
  it('keeps every confidence an integer in [0,100], offsets >= 1, and one analysis per hunk', () => {
    fc.assert(fc.property(contentArb, offsetArb, linesArb, (content, offset, lines) => {
      const session = buildSession('patch', { id: 'target', name: 'target', content }, buildDiff(offset, lines))
      expect(session.analyses).toHaveLength(session.hunks.length)
      session.analyses.forEach((analysis) => {
        analysis.confidenceProfile.forEach((point) => {
          expect(Number.isInteger(point.confidence)).toBe(true)
          expect(point.confidence).toBeGreaterThanOrEqual(0)
          expect(point.confidence).toBeLessThanOrEqual(100)
          expect(point.offset).toBeGreaterThanOrEqual(1)
        })
        if (analysis.state === 'snapped') expect(analysis.candidates).toHaveLength(1)
      })
    }))
  })
})
