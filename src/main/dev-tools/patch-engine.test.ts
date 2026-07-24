import { describe, it, expect } from 'vitest'
import { parseUnifiedDiff, buildSession } from './patch-engine'
import { applyPatch } from './patch-apply'

const SIMPLE_TARGET = `line one
line two
line three
line four
line five
`

const SIMPLE_PATCH = `--- a/file.txt
+++ b/file.txt
@@ -2,3 +2,4 @@
 line two
 line three
+line three-and-a-half
 line four
`

const MULTI_HUNK_PATCH = `--- a/file.txt
+++ b/file.txt
@@ -1,2 +1,3 @@
 line one
+new line
 line two
@@ -4,2 +5,3 @@
 line four
+another new line
 line five
`

describe('parseUnifiedDiff', () => {
  it('parses a single hunk', () => {
    const hunks = parseUnifiedDiff(SIMPLE_PATCH)
    expect(hunks).toHaveLength(1)
    const hunk = hunks[0]
    expect(hunk.suggestedOffset).toBe(2)
    expect(hunk.lines.filter((line) => line.tag === '+')).toHaveLength(1)
    expect(hunk.lines.filter((line) => line.tag === ' ')).toHaveLength(3)
    expect(hunk.lines.find((line) => line.tag === '+')?.text).toBe('line three-and-a-half')
  })

  it('parses multiple hunks', () => {
    const hunks = parseUnifiedDiff(MULTI_HUNK_PATCH)
    expect(hunks).toHaveLength(2)
    expect(hunks[0].suggestedOffset).toBe(1)
    expect(hunks[1].suggestedOffset).toBe(4)
  })

  it('ignores file header lines', () => {
    const hunks = parseUnifiedDiff(SIMPLE_PATCH)
    const valid = new Set([' ', '+', '-'])
    expect(hunks.every((hunk) => hunk.lines.every((line) => valid.has(line.tag)))).toBe(true)
  })
})

describe('buildSession: snapped state', () => {
  it('produces snapped state when context is unique', () => {
    const patch = `--- a/file.txt
+++ b/file.txt
@@ -2,3 +2,4 @@
 line two
 line three
+new content
 line four
`
    const target = { id: 'file', name: 'file.txt', content: SIMPLE_TARGET }
    const session = buildSession('test-patch', target, patch)
    expect(session.hunks).toHaveLength(1)
    expect(session.analyses[0].state).toBe('snapped')
    expect(session.analyses[0].candidates[0].offset).toBe(2)
  })

  it('assigns hunk ids sequentially', () => {
    const target = { id: 'file', name: 'file.txt', content: SIMPLE_TARGET }
    const session = buildSession('test-patch', target, MULTI_HUNK_PATCH)
    expect(session.hunks.map((hunk) => hunk.id)).toEqual(['h1', 'h2'])
  })
})

describe('buildSession: ambiguous state', () => {
  it('produces ambiguous state when the same context appears at multiple offsets', () => {
    const repeatingContent = `repeat line\nrepeat line\nrepeat line\nrepeat line\nrepeat line\n`
    const patch = `--- a/file.txt
+++ b/file.txt
@@ -1,2 +1,3 @@
 repeat line
+inserted
 repeat line
`
    const target = { id: 'file', name: 'file.txt', content: repeatingContent }
    const session = buildSession('test-patch', target, patch)
    expect(session.analyses[0].state).toBe('ambiguous')
    expect(session.analyses[0].candidates.length).toBeGreaterThan(1)
  })
})

describe('buildSession: no_match state', () => {
  it('produces no_match when context does not exist in target', () => {
    const patch = `--- a/file.txt
+++ b/file.txt
@@ -1,3 +1,4 @@
 completely different content A
 completely different content B
+new line
 completely different content C
`
    const target = { id: 'file', name: 'file.txt', content: SIMPLE_TARGET }
    const session = buildSession('test-patch', target, patch)
    expect(session.analyses[0].state).toBe('no_match')
  })
})

describe('applyPatch: auto_snapped', () => {
  it('inserts added lines at the correct offset', () => {
    const target = { id: 'file', name: 'file.txt', content: SIMPLE_TARGET }
    const session = buildSession('test-patch', target, SIMPLE_PATCH)
    const result = applyPatch(SIMPLE_TARGET, {
      patchId: 'test-patch',
      resolutions: [{ hunkId: 'h1', method: 'auto_snapped', finalOffset: 2 }],
    }, session.hunks)
    expect(result).toContain('line three-and-a-half')
    const lines = result.split('\n')
    expect(lines.indexOf('line three-and-a-half')).toBe(3)
    expect(lines[2]).toBe('line three')
    expect(lines[4]).toBe('line four')
  })
})

describe('applyPatch: manual_edit', () => {
  it('replaces the specified range with manual text', () => {
    const result = applyPatch(SIMPLE_TARGET, {
      patchId: 'test-patch',
      resolutions: [{
        hunkId: 'h1',
        method: 'manual_edit',
        finalOffset: null,
        manualText: 'replaced line',
        replaceRange: { start: 2, end: 3 },
      }],
    }, [{ id: 'h1', title: 'test', lines: [], suggestedOffset: 2 }])
    const lines = result.split('\n')
    expect(lines[0]).toBe('line one')
    expect(lines[1]).toBe('replaced line')
    expect(lines[2]).toBe('line four')
  })
})

describe('applyPatch: multiple resolutions', () => {
  it('applies resolutions in reverse offset order', () => {
    const target = `a\nb\nc\nd\ne\n`
    const hunks = [
      { id: 'h1', title: 'first', lines: [{ tag: ' ' as const, text: 'a' }, { tag: '+' as const, text: 'a2' }], suggestedOffset: 1 },
      { id: 'h2', title: 'second', lines: [{ tag: ' ' as const, text: 'c' }, { tag: '+' as const, text: 'c2' }], suggestedOffset: 3 },
    ]
    const result = applyPatch(target, {
      patchId: 'test-patch',
      resolutions: [
        { hunkId: 'h1', method: 'auto_snapped', finalOffset: 1 },
        { hunkId: 'h2', method: 'auto_snapped', finalOffset: 3 },
      ],
    }, hunks)
    const lines = result.split('\n')
    expect(lines).toContain('a2')
    expect(lines).toContain('c2')
  })
})
