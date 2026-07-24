// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePluginVars } from './plugin-vars'
import { saveFieldValue, GLOBAL_SCOPE } from '../data/plugin-vars'
import { makePrinter } from '../test/fixtures'

const FAKE_UUID = 'aaaaaaaa-1111-2222-3333-444444444444'

describe('usePluginVars', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('migrates the v1 flat map into the global slice at boot and stamps the schema version', () => {
    localStorage.setItem('b3d.savedPluginVars', JSON.stringify({ SPOOLMAN_SERVER: 'shared:8000' }))
    const { result } = renderHook(() => usePluginVars([]))
    expect(result.current.scopedVars).toEqual({ SPOOLMAN_SERVER: { global: 'shared:8000' } })
    expect(JSON.parse(localStorage.getItem('b3d.pluginVars') ?? 'null')).toEqual({ SPOOLMAN_SERVER: { global: 'shared:8000' } })
    expect(localStorage.getItem('b3d.schemaVersion')).toBe('2')
  })

  it('a scope-aware save persists the store AND mirrors the global slice to the legacy key', () => {
    const { result } = renderHook(() => usePluginVars([]))
    act(() => {
      result.current.saveFor('uuid-a', {
        values: { SPOOLMAN_SERVER: 'mine:8000', SPOOLMAN_LOCATION: 'OG U1' },
        fields: [
          { key: 'SPOOLMAN_SERVER', label: 'Server', type: 'text', scope: 'global' },
          { key: 'SPOOLMAN_LOCATION', label: 'Location', type: 'text', scope: 'printer' },
        ],
      })
    })
    expect(result.current.viewFor('uuid-a')).toEqual({ SPOOLMAN_SERVER: 'mine:8000', SPOOLMAN_LOCATION: 'OG U1' })
    expect(result.current.viewFor('uuid-b')).toEqual({ SPOOLMAN_SERVER: 'mine:8000' })
    expect(JSON.parse(localStorage.getItem('b3d.savedPluginVars') ?? 'null')).toEqual({ SPOOLMAN_SERVER: 'mine:8000' })
  })
})

describe('usePluginVars remap and Settings writes', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('remaps a printer\'s record-id entries onto its daemon UUID once a ping reports it', () => {
    localStorage.setItem('b3d.pluginVars', JSON.stringify({ SPOOLMAN_LOCATION: { 'local:p-1': 'OG U1' } }))
    const { result } = renderHook(() => usePluginVars([makePrinter({ id: 'p-1', printerUuid: FAKE_UUID })]))
    expect(result.current.viewFor(FAKE_UUID)).toEqual({ SPOOLMAN_LOCATION: 'OG U1' })
    expect(JSON.parse(localStorage.getItem('b3d.pluginVars') ?? 'null')).toEqual({
      SPOOLMAN_LOCATION: { [`local:${FAKE_UUID}`]: 'OG U1' },
    })
  })

  it('a Settings pane edit through setScopedVars keeps per-printer entries and the downgrade mirror', () => {
    localStorage.setItem('b3d.pluginVars', JSON.stringify({ SPOOLMAN_SERVER: { global: 'old:8000', 'local:uuid-a': 'mine:8000' } }))
    const { result } = renderHook(() => usePluginVars([]))
    act(() => {
      result.current.setScopedVars(saveFieldValue(result.current.scopedVars, GLOBAL_SCOPE, 'SPOOLMAN_SERVER', 'new:8000'))
    })
    expect(result.current.viewFor(undefined)).toEqual({ SPOOLMAN_SERVER: 'new:8000' })
    expect(result.current.viewFor('uuid-a')).toEqual({ SPOOLMAN_SERVER: 'mine:8000' })
    expect(JSON.parse(localStorage.getItem('b3d.savedPluginVars') ?? 'null')).toEqual({ SPOOLMAN_SERVER: 'new:8000' })
  })
})
