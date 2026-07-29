// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useAsyncResource } from './useAsyncResource'

describe('useAsyncResource', () => {
  it('exposes the loaded value once the fetch resolves', async () => {
    const load = vi.fn().mockResolvedValue(['fluidd', 'mainsail'])
    const { result } = renderHook(() => useAsyncResource(load, []))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.value).toEqual(['fluidd', 'mainsail'])
    expect(result.current.error).toBeNull()
  })

  it('captures a rejection as error instead of swallowing it (and stops loading)', async () => {
    const load = vi.fn().mockRejectedValue(new Error('registry unreachable'))
    const { result } = renderHook(() => useAsyncResource(load, []))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe('registry unreachable')
    expect(result.current.value).toBeNull()
  })

  it('re-runs the fetch when reload is called', async () => {
    const load = vi.fn().mockResolvedValue('readme')
    const { result } = renderHook(() => useAsyncResource(load, []))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(load).toHaveBeenCalledTimes(1)
    await act(async () => { result.current.reload() })
    await waitFor(() => expect(load).toHaveBeenCalledTimes(2))
  })
})
