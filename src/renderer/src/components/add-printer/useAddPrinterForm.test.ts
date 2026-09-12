// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { makeAdapterInfo } from '../../test/fixtures'
import { useAddPrinterForm } from './useAddPrinterForm'
import type { DiscoveredPrinterRecord } from '../../env'

function voron(): DiscoveredPrinterRecord {
  return { id: 'v-1', host: 'voron.local', ip: '10.0.0.7', model: 'Voron 2.4', vendor: 'DIY', service: '_klipper._tcp' }
}

// What a stock MainsailOS image puts on the wire: no vendor, no model, and a hostname that names the
// distribution rather than the printer. It is the shape the klipper-linux bench runs on.
function mainsailOs(): DiscoveredPrinterRecord {
  return { id: 'm-1', host: 'mainsailos.local', ip: '10.0.0.8', model: 'Network device', vendor: 'Unknown', service: '_moonraker._tcp' }
}

function threeAdapters(): AdapterInfo[] {
  return [
    makeAdapterInfo(),
    makeAdapterInfo({ id: 'voron-24', title: 'Voron 2.4', vendor: 'Voron Design' }),
    makeAdapterInfo({ id: 'klipper-generic', title: 'Klipper: generic', vendor: 'Bespok3d' }),
  ]
}

// Picking a device pre-fills the adapter field from the device's own identity, checked against the
// adapters this build registered. Its own group: the rest of the form does not take part in it.
describe('useAddPrinterForm adapter pre-selection', () => {
  it('guesses the adapter from a picked device', () => {
    const { result } = renderHook(() => useAddPrinterForm('scan', undefined, [voron()], threeAdapters()))
    expect(result.current.adapterId).toBe('snapmaker-u1')

    act(() => result.current.setPicked(voron()))

    expect(result.current.adapterId).toBe('voron-24')
  })

  it('pre-selects the generic Klipper adapter for a MainsailOS shaped device', () => {
    const { result } = renderHook(() => useAddPrinterForm('scan', undefined, [mainsailOs()], threeAdapters()))

    act(() => result.current.setPicked(mainsailOs()))

    expect(result.current.adapterId).toBe('klipper-generic')
  })

  // The guess is a guess: a build that never registered the guessed adapter must not pre-select it,
  // or Add hands enrollment an id it will fail to look up.
  it('falls back to the first registered adapter when the guess is not one of them', () => {
    const onlyTheU1 = [makeAdapterInfo()]
    const { result } = renderHook(() => useAddPrinterForm('scan', undefined, [voron()], onlyTheU1))

    act(() => result.current.setPicked(voron()))

    expect(result.current.adapterId).toBe('snapmaker-u1')
  })

  it('falls back to the only registered adapter for a MainsailOS shaped device on a U1-only build', () => {
    const onlyTheU1 = [makeAdapterInfo()]
    const { result } = renderHook(() => useAddPrinterForm('scan', undefined, [mainsailOs()], onlyTheU1))

    act(() => result.current.setPicked(mainsailOs()))

    expect(result.current.adapterId).toBe('snapmaker-u1')
  })
})

describe('useAddPrinterForm', () => {
  // The list arrives over IPC a tick after the modal opens, so the first render has nothing to select.
  it('adopts the first adapter once the list arrives', () => {
    const { result, rerender } = renderHook((adapters: AdapterInfo[]) => useAddPrinterForm('manual', undefined, [], adapters), { initialProps: [] as AdapterInfo[] })
    expect(result.current.adapterId).toBe('')

    rerender(threeAdapters())

    expect(result.current.adapterId).toBe('snapmaker-u1')
  })

  it('returns every field to its default when the tab is switched', () => {
    const { result } = renderHook(() => useAddPrinterForm('manual', undefined, [], threeAdapters()))
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
