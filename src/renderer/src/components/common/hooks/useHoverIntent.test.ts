// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useHoverIntent } from './useHoverIntent'

describe('useHoverIntent', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('opens immediately and closes only after the grace period elapses', () => {
    const { result } = renderHook(() => useHoverIntent(200))
    act(() => { result.current.open() })
    expect(result.current.active).toBe(true)

    act(() => { result.current.scheduleClose() })
    expect(result.current.active).toBe(true)
    act(() => { vi.advanceTimersByTime(200) })
    expect(result.current.active).toBe(false)
  })

  it('cancels a pending close when reopened within the grace period', () => {
    const { result } = renderHook(() => useHoverIntent(200))
    act(() => { result.current.open() })
    act(() => { result.current.scheduleClose() })
    act(() => { vi.advanceTimersByTime(100) })
    act(() => { result.current.open() })
    act(() => { vi.advanceTimersByTime(200) })
    expect(result.current.active).toBe(true)
  })

  it('clears a pending close timer on unmount so it never fires on a dead tree', () => {
    const { result, unmount } = renderHook(() => useHoverIntent(200))
    act(() => { result.current.open() })
    act(() => { result.current.scheduleClose() })
    unmount()
    expect(() => vi.advanceTimersByTime(200)).not.toThrow()
    expect(vi.getTimerCount()).toBe(0)
  })
})
