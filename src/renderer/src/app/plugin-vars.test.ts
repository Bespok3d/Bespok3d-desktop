// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePluginVars } from './plugin-vars'
import { saveFieldValue, GLOBAL_SCOPE } from '../data/plugin-vars'
import type { Printer } from '../data/types'
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
    expect(localStorage.getItem('b3d.schemaVersion')).toBe('3')
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

  it('carries a printer\'s UUID-keyed entries an older build saved onto its app record id', () => {
    localStorage.setItem('b3d.pluginVars', JSON.stringify({ SPOOLMAN_LOCATION: { [`local:${FAKE_UUID}`]: 'OG U1' } }))
    const { result } = renderHook(() => usePluginVars([makePrinter({ id: 'p-1', printerUuid: FAKE_UUID })]))
    expect(result.current.viewFor('p-1')).toEqual({ SPOOLMAN_LOCATION: 'OG U1' })
    expect(JSON.parse(localStorage.getItem('b3d.pluginVars') ?? 'null')).toEqual({
      SPOOLMAN_LOCATION: { 'local:p-1': 'OG U1' },
    })
  })

  // R-4 at the hook: the printer reports a different UUID after a reflash or daemon reinstall, and the
  // value the user saved for that printer is still what the pane reads back for it.
  it('still reads back a saved value after the printer reports a fresh UUID', () => {
    const beforeReflash = makePrinter({ id: 'p-1', printerUuid: FAKE_UUID })
    const { result, rerender } = renderHook((printers: Printer[]) => usePluginVars(printers), {
      initialProps: [beforeReflash],
    })
    act(() => {
      result.current.saveFor('p-1', {
        values: { SPOOLMAN_LOCATION: 'OG U1' },
        fields: [{ key: 'SPOOLMAN_LOCATION', label: 'Location', type: 'text', scope: 'printer' }],
      })
    })
    rerender([makePrinter({ id: 'p-1', printerUuid: 'ffffffff-9999-8888-7777-666666666666' })])

    expect(result.current.viewFor('p-1')).toEqual({ SPOOLMAN_LOCATION: 'OG U1' })
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
