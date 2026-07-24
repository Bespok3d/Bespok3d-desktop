// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useClipboard } from './useClipboard'

describe('useClipboard', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn() } })
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('writes the text and flips copied on, then resets it after the feedback window', () => {
    const { result } = renderHook(() => useClipboard())
    act(() => { result.current.copy('one-time link') })
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('one-time link')
    expect(result.current.copied).toBe(true)

    act(() => { vi.advanceTimersByTime(2000) })
    expect(result.current.copied).toBe(false)
  })

  it('restarts the reset window when copied again before it elapses', () => {
    const { result } = renderHook(() => useClipboard())
    act(() => { result.current.copy('a') })
    act(() => { vi.advanceTimersByTime(1500) })
    act(() => { result.current.copy('b') })
    act(() => { vi.advanceTimersByTime(1500) })
    expect(result.current.copied).toBe(true)
    act(() => { vi.advanceTimersByTime(500) })
    expect(result.current.copied).toBe(false)
  })
})
