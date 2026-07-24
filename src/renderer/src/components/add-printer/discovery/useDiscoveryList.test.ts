// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useDiscoveryList } from './useDiscoveryList'
import type { DiscoveredPrinterRecord } from '../../../env'

function printer(host: string, ip: string): DiscoveredPrinterRecord {
  return { id: `${host}-${ip}`, host, ip, model: 'Snapmaker U1', vendor: 'Snapmaker', service: '_klipper._tcp' }
}

function gadget(host: string, ip: string): DiscoveredPrinterRecord {
  return { id: `${host}-${ip}`, host, ip, model: 'Network device', vendor: 'Unknown', service: '_http._tcp' }
}

describe('useDiscoveryList', () => {
  it('dedupes by host and reports the deduped device count as total', () => {
    const discovered = [printer('u1.local', '10.0.0.5'), printer('u1.local', 'fe80::1'), gadget('thing.local', '10.0.0.9')]
    const { result } = renderHook(() => useDiscoveryList(discovered))
    expect(result.current.total).toBe(2)
  })

  it('hides non-printers until show-all is toggled on', () => {
    const discovered = [printer('u1.local', '10.0.0.5'), gadget('thing.local', '10.0.0.9')]
    const { result } = renderHook(() => useDiscoveryList(discovered))

    expect(result.current.visible).toHaveLength(1)
    expect(result.current.hiddenN).toBe(1)

    act(() => result.current.setShowAll(true))

    expect(result.current.visible).toHaveLength(2)
    expect(result.current.hiddenN).toBe(0)
  })
})
