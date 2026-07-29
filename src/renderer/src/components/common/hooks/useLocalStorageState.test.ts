// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useLocalStorageState } from './useLocalStorageState'

describe('useLocalStorageState', () => {
  beforeEach(() => localStorage.clear())

  it('uses the fallback when the key is absent', () => {
    const { result } = renderHook(() => useLocalStorageState('k', { count: 1 }))
    expect(result.current[0]).toEqual({ count: 1 })
  })

  it('reads the stored value over the fallback', () => {
    localStorage.setItem('k', JSON.stringify({ count: 9 }))
    const { result } = renderHook(() => useLocalStorageState('k', { count: 1 }))
    expect(result.current[0]).toEqual({ count: 9 })
  })

  it('falls back when the stored json is corrupt', () => {
    localStorage.setItem('k', '{not json')
    const { result } = renderHook(() => useLocalStorageState('k', 'safe'))
    expect(result.current[0]).toBe('safe')
  })

  it('writes through to localStorage on update', () => {
    const { result } = renderHook(() => useLocalStorageState<Record<string, string>>('k', {}))
    act(() => { result.current[1]({ x: 'y' }) })
    expect(result.current[0]).toEqual({ x: 'y' })
    expect(JSON.parse(localStorage.getItem('k') ?? 'null')).toEqual({ x: 'y' })
  })
})
