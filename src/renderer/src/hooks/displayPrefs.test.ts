// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useDisplayPrefs } from './displayPrefs'

const getSettings = vi.fn()
const setSettings = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  getSettings.mockResolvedValue({ theme: 'dark', density: 'compact', storeGrouped: true })
  setSettings.mockResolvedValue({})
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
  vi.stubGlobal('b3d', { settings: { get: getSettings, set: setSettings } })
})

describe('useDisplayPrefs', () => {
  it('loads the persisted theme, density and store grouping from the settings store on mount', async () => {
    const { result } = renderHook(() => useDisplayPrefs())
    await waitFor(() => expect(result.current.theme).toBe('dark'))
    expect(result.current.density).toBe('compact')
    expect(result.current.storeGrouped).toBe(true)
  })

  it('persists a changed preference to the settings store so it survives a reload', async () => {
    const { result } = renderHook(() => useDisplayPrefs())
    await waitFor(() => expect(result.current.theme).toBe('dark'))
    act(() => result.current.setStoreGrouped(false))
    expect(setSettings).toHaveBeenCalledWith({ storeGrouped: false })
  })
})
