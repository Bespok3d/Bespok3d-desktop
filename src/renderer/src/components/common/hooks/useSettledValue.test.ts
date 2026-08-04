// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useSettledValue } from './useSettledValue'

const PAUSE_MS = 50

async function after(ms: number): Promise<void> {
  await act(async () => { await new Promise((elapsed) => setTimeout(elapsed, ms)) })
}

describe('useSettledValue', () => {
  it('hands back what it was given while nothing has moved yet', () => {
    var { result } = renderHook(() => useSettledValue('192.0.2.50:8000', PAUSE_MS))

    expect(result.current).toBe('192.0.2.50:8000')
  })

  it('holds the old value while the new one is still moving, then settles on the last one', async () => {
    var { result, rerender } = renderHook(({ typed }) => useSettledValue(typed, PAUSE_MS), {
      initialProps: { typed: 'http://' },
    })

    rerender({ typed: 'http://192.0.2' })
    await after(PAUSE_MS / 2)
    rerender({ typed: 'http://192.0.2.50:8000' })

    expect(result.current).toBe('http://')

    await after(PAUSE_MS * 2)

    expect(result.current).toBe('http://192.0.2.50:8000')
  })
})
