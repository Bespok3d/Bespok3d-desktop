import { describe, it, expect } from 'vitest'
import { candidateAddresses } from './address'
import type { DeviceSighting } from '../mdns/sightings'

const NOW = 1_000_000

function sighting(over: Partial<DeviceSighting>): DeviceSighting {
  return { host: 'lava', ip: '10.6.9.66', mac: '40:d9:5a:e4:cd:fc', seenAt: NOW, ...over }
}

describe('candidateAddresses includes the recorded IP plus moved addresses', () => {
  it('lists the recorded IP first, then a fresh sighting of the same device by MAC', () => {
    const printer = { host: 'lava', ip: '10.6.9.109', mac: '40:d9:5a:e4:cd:fc' }
    expect(candidateAddresses(printer, [sighting({})], NOW)).toEqual(['10.6.9.109', '10.6.9.66'])
  })

  it('matches by hostname when no MAC is known', () => {
    const printer = { host: 'lava', ip: '10.6.9.109' }
    expect(candidateAddresses(printer, [sighting({ mac: undefined })], NOW)).toEqual(['10.6.9.109', '10.6.9.66'])
  })

  it('keeps BOTH leases of a flip-flopping printer as candidates to probe', () => {
    const printer = { host: 'lava', ip: '10.6.9.109', mac: '40:d9:5a:e4:cd:fc' }
    const both = [sighting({ ip: '10.6.9.66' }), sighting({ ip: '10.6.9.109' })]
    expect(candidateAddresses(printer, both, NOW)).toEqual(['10.6.9.109', '10.6.9.66'])
  })

  it('follows the right device by MAC when two printers share a hostname', () => {
    const printer = { host: 'lava', ip: '10.6.9.109', mac: '40:d9:5a:e4:cd:fc' }
    const two = [sighting({ ip: '10.6.9.70', mac: 'aa:bb:cc:dd:ee:ff' }), sighting({ ip: '10.6.9.66' })]
    expect(candidateAddresses(printer, two, NOW)).toEqual(['10.6.9.109', '10.6.9.66'])
  })
})

describe('candidateAddresses excludes addresses it must not chase', () => {
  it('drops a sighting too old to trust', () => {
    const printer = { host: 'lava', ip: '10.6.9.109', mac: '40:d9:5a:e4:cd:fc' }
    const stale = sighting({ seenAt: NOW - 5 * 60 * 1000 })
    expect(candidateAddresses(printer, [stale], NOW)).toEqual(['10.6.9.109'])
  })

  it('drops an IPv6 link-local sighting', () => {
    const printer = { host: 'lava', ip: '10.6.9.109', mac: '40:d9:5a:e4:cd:fc' }
    expect(candidateAddresses(printer, [sighting({ ip: 'fe80::1' })], NOW)).toEqual(['10.6.9.109'])
  })

  it('never adds a hostname sighting for a manually-added printer whose host is a bare IP', () => {
    const printer = { host: '10.6.9.109', ip: '10.6.9.109' }
    const elsewhere = sighting({ host: '10.6.9.109', ip: '10.6.9.66', mac: undefined })
    expect(candidateAddresses(printer, [elsewhere], NOW)).toEqual(['10.6.9.109'])
  })
})
