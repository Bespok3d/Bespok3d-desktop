import { describe, it, expect } from 'vitest'
// @ts-expect-error - gate detector, plain JS with no type declarations
import { isWeakIdentifier, weakIdentifiersInText } from './identifier-meaning-detector.mjs'

function weakNames(text: string): string[] {
  return weakIdentifiersInText(text).map((hit: { name: string }) => hit.name)
}

describe('identifier-meaning detector: what counts as a weak identifier', () => {
  it('flags a positional suffix (lineA / keyB)', () => {
    expect(isWeakIdentifier('lineA')).toBe(true)
    expect(isWeakIdentifier('keyB')).toBe(true)
  })

  it('does not flag an axis suffix X/Y/Z (the axis IS the meaning)', () => {
    expect(isWeakIdentifier('thumbX')).toBe(false)
    expect(isWeakIdentifier('deltaY')).toBe(false)
    expect(isWeakIdentifier('offsetZ')).toBe(false)
  })

  it('flags a doubled single letter (aa)', () => {
    expect(isWeakIdentifier('aa')).toBe(true)
    expect(isWeakIdentifier('vv')).toBe(true)
  })

  it('flags a role-free abbreviation (ev / an)', () => {
    expect(isWeakIdentifier('ev')).toBe(true)
    expect(isWeakIdentifier('an')).toBe(true)
  })

  it('flags a type-only name (str / obj / val)', () => {
    expect(isWeakIdentifier('str')).toBe(true)
    expect(isWeakIdentifier('obj')).toBe(true)
    expect(isWeakIdentifier('val')).toBe(true)
  })

  it('flags a positional trailing digit (arg1)', () => {
    expect(isWeakIdentifier('arg1')).toBe(true)
    expect(isWeakIdentifier('item2')).toBe(true)
  })

  it('does not flag a trailing-digit tech token (mp4 / sha256 / IPv4)', () => {
    expect(isWeakIdentifier('mp4')).toBe(false)
    expect(isWeakIdentifier('sha256')).toBe(false)
    expect(isWeakIdentifier('IPv4')).toBe(false)
    expect(isWeakIdentifier('oauth2')).toBe(false)
  })

  it('does not flag a clean domain name', () => {
    expect(isWeakIdentifier('patchLine')).toBe(false)
    expect(isWeakIdentifier('sourceLine')).toBe(false)
    expect(isWeakIdentifier('namespace')).toBe(false)
  })
})

describe('identifier-meaning detector: what it inspects', () => {
  it('flags a weak function parameter and a weak local declaration, never a clean name', () => {
    const code = `function lineSimilarity(patchLine, sourceLine) { return 0 }
function fetchStatus(ev) { const obj = parse(ev); return obj }`
    expect(weakNames(code).sort()).toEqual(['ev', 'obj'])
  })

  it('does not flag destructuring patterns', () => {
    const code = `const { ev } = props
const [el, an] = pair`
    expect(weakNames(code)).toEqual([])
  })

  it('does not flag an object-literal key', () => {
    const code = `const config = { ev: 1, an: 2, val: 3 }`
    expect(weakNames(code)).toEqual([])
  })
})

describe('identifier-meaning detector: gate-allow', () => {
  it('honors a gate-allow on the declaration line', () => {
    const code = `const obj = parse(data) // gate-allow weak_identifiers: raw json shim, shape unknown until narrowed`
    expect(weakNames(code)).toEqual([])
  })

  it('requires a reason: a bare gate-allow does not exempt', () => {
    const code = `// gate-allow weak_identifiers
const obj = parse(data)`
    expect(weakNames(code)).toEqual(['obj'])
  })
})
