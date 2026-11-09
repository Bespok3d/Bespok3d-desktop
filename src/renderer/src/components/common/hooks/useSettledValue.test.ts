// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useSettledValue } from './useSettledValue'

const PAUSE_MS = 50

// The pause is timed on the test's own clock. On the real one, a busy machine that stalls the test
// between two steps lets the pause run out early and settle on a value that was still moving.
function after(ms: number) {
  act(() => { vi.advanceTimersByTime(ms) })
}

describe('useSettledValue', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('hands back what it was given while nothing has moved yet', () => {
    var { result } = renderHook(() => useSettledValue('192.0.2.50:8000', PAUSE_MS))

    expect(result.current).toBe('192.0.2.50:8000')
  })

  it('holds the old value while the new one is still moving, then settles on the last one', () => {
    var { result, rerender } = renderHook(({ typed }) => useSettledValue(typed, PAUSE_MS), {
      initialProps: { typed: 'http://' },
    })

    rerender({ typed: 'http://192.0.2' })
    after(PAUSE_MS - 1)
    rerender({ typed: 'http://192.0.2.50:8000' })
    after(PAUSE_MS - 1)

    expect(result.current).toBe('http://')

    after(1)

    expect(result.current).toBe('http://192.0.2.50:8000')
  })
})
