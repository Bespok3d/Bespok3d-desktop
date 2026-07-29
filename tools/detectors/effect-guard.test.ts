// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect } from 'vitest'
// @ts-expect-error - gate detector, plain JS with no type declarations
import { isUnguardedFetchEffect, unguardedEffectsInText, extractCallbackBody } from './effect-guard-detector.mjs'

function flaggedCount(code: string): number {
  return unguardedEffectsInText(code).length
}

const FETCH_AND_SET = `function Pane() {
  const [data, setData] = useState(null)
  useEffect(() => {
    window.b3d.things.get().then((value) => setData(value))
  }, [])
}`

describe('effect-guard detector: what counts as an unguarded fetch effect', () => {
  it('flags a raw useEffect that fetches and sets state with no guard', () => {
    expect(flaggedCount(FETCH_AND_SET)).toBe(1)
  })

  it('does not flag an effect with a `return () =>` cleanup', () => {
    const code = `useEffect(() => {
      const id = window.b3d.poll.start()
      setData(1)
      return () => window.b3d.poll.stop(id)
    }, [])`
    expect(flaggedCount(code)).toBe(0)
  })

  it('does not flag an effect that uses an AbortController', () => {
    const code = `useEffect(() => {
      const controller = new AbortController()
      fetch('/x', { signal: controller.signal }).then((response) => setData(response))
    }, [])`
    expect(flaggedCount(code)).toBe(0)
  })

  it('does not flag an effect that fetches but never sets state', () => {
    const code = `useEffect(() => {
      window.b3d.things.get().then((value) => console.log(value))
    }, [])`
    expect(flaggedCount(code)).toBe(0)
  })

  it('does not flag a useAsyncEffect block (not a useEffect)', () => {
    const code = `useAsyncEffect(async () => {
      const value = await window.b3d.things.get()
      setData(value)
    }, [])`
    expect(flaggedCount(code)).toBe(0)
  })
})

describe('effect-guard detector: false-positive classes fixed in the detector', () => {
  it('does not flag a referenced callback, even when a downstream arrow fetches and sets', () => {
    const code = `function Pane() {
      function loadData() {}
      useEffect(loadData, [])
    }
    function Other() {
      const subscription = window.b3d.bus.on((value) => setData(value))
    }`
    expect(flaggedCount(code)).toBe(0)
  })

  it('does not flag an effect that returns a body-declared cleanup variable', () => {
    const code = `useEffect(() => {
      const unsubscribe = window.b3d.bus.onChange((value) => setData(value))
      return unsubscribe
    }, [state.phase])`
    expect(flaggedCount(code)).toBe(0)
  })

  it('bounds the inline body to the useEffect call (a referenced callback has no inline body)', () => {
    const text = `useEffect(loadData, [])\nconst handler = (value) => setData(value)`
    expect(extractCallbackBody(text, 'useEffect('.length)).toBe('')
  })

  it('captures an inline arrow body and reports it unguarded', () => {
    const body = extractCallbackBody(FETCH_AND_SET, FETCH_AND_SET.indexOf('useEffect(') + 'useEffect('.length)
    expect(body).toContain('setData')
    expect(isUnguardedFetchEffect(body)).toBe(true)
  })
})

describe('effect-guard detector: gate-allow', () => {
  it('honors a gate-allow on the preceding line', () => {
    const code = `// gate-allow unguarded_fetch_effects: settings.get is instant and idempotent, no late-resolve race
    useEffect(() => {
      window.b3d.settings.get().then((settings) => setOn(settings.on))
    }, [])`
    expect(flaggedCount(code)).toBe(0)
  })

  it('requires a reason: a bare gate-allow does not exempt', () => {
    const code = `// gate-allow unguarded_fetch_effects
    useEffect(() => {
      window.b3d.settings.get().then((settings) => setOn(settings.on))
    }, [])`
    expect(flaggedCount(code)).toBe(1)
  })
})
