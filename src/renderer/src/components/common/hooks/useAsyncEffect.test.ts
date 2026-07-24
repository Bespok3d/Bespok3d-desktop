// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useAsyncEffect } from './useAsyncEffect'

function noop() {}

// Mounts a probe whose async effect records `ran=true` only when not stale, gated on a promise we
// resolve by hand. When unmountBeforeRelease, the component is gone before the gate settles, so the
// guard must keep `ran` false. Returns whether the continuation ran.
async function runProbe(unmountBeforeRelease: boolean): Promise<boolean> {
  var ran = false
  var release: () => void = noop
  const gate = new Promise<void>((resolve) => { release = resolve })
  function useProbe() {
    useAsyncEffect(async (stale) => {
      await gate
      if (!stale()) ran = true
    }, [])
  }
  const view = renderHook(useProbe)
  if (unmountBeforeRelease) view.unmount()
  release()
  await gate
  await Promise.resolve()

  return ran
}

describe('useAsyncEffect', () => {
  it('skips the guarded continuation when the component unmounts before the async work settles', async () => {
    expect(await runProbe(true)).toBe(false)
  })

  it('runs the continuation when the component is still mounted', async () => {
    expect(await runProbe(false)).toBe(true)
  })
})
