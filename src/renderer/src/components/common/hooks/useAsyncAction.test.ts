// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAsyncAction } from './useAsyncAction'

function noop() {}

describe('useAsyncAction', () => {
  it('surfaces a rejected action as an error and returns to idle (not stuck busy)', async () => {
    const action = vi.fn().mockRejectedValue(new Error('reconfigure failed'))
    const { result } = renderHook(() => useAsyncAction(action))
    await act(async () => { await result.current.run() })
    expect(result.current.busy).toBe(false)
    expect(result.current.error).toBe('reconfigure failed')
  })

  it('clears any prior error and stays idle after a run succeeds', async () => {
    const action = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => useAsyncAction(action))
    await act(async () => { await result.current.run() })
    expect(result.current.busy).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('reports busy while the action is in flight and idle once it settles', async () => {
    var release: () => void = noop
    const action = vi.fn(() => new Promise<void>((resolve) => { release = resolve }))
    const { result } = renderHook(() => useAsyncAction(action))
    act(() => { void result.current.run() })
    expect(result.current.busy).toBe(true)
    await act(async () => { release() })
    expect(result.current.busy).toBe(false)
  })
})
