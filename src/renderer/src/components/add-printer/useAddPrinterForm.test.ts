// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAddPrinterForm } from './useAddPrinterForm'
import type { DiscoveredPrinterRecord } from '../../env'

function voron(): DiscoveredPrinterRecord {
  return { id: 'v-1', host: 'voron.local', ip: '10.0.0.7', model: 'Voron 2.4', vendor: 'DIY', service: '_klipper._tcp' }
}

describe('useAddPrinterForm', () => {
  it('guesses the adapter from a picked device', () => {
    const { result } = renderHook(() => useAddPrinterForm('scan', undefined, [voron()]))
    expect(result.current.adapterId).toBe('snapmaker-u1')

    act(() => result.current.setPicked(voron()))

    expect(result.current.adapterId).toBe('voron-24')
  })

  it('returns every field to its default when the tab is switched', () => {
    const { result } = renderHook(() => useAddPrinterForm('manual', undefined, []))
    act(() => {
      result.current.setManualIp('10.0.0.9')
      result.current.setNick('Bench')
    })
    expect(result.current.canAdd).toBe(true)

    act(() => result.current.switchTab('scan'))

    expect(result.current.manualIp).toBe('')
    expect(result.current.nick).toBe('')
    expect(result.current.adapterId).toBe('snapmaker-u1')
  })
})
