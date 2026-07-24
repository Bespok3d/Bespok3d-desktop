import { describe, it, expect, beforeEach } from 'vitest'
import { noteSighting, liveSightings, clearSightings } from './sightings'
import type { DiscoveredPrinterRecord } from './types'

function found(over: Partial<DiscoveredPrinterRecord>): DiscoveredPrinterRecord {
  return { id: 'mdns-lava', host: 'lava', ip: '10.6.9.66', model: 'U1', vendor: 'Snapmaker', service: '_moonraker._tcp', ...over }
}

describe('sightings table', () => {
  beforeEach(clearSightings)

  it('records a sighting with its address and stamp', () => {
    noteSighting(found({ mac: '40:d9:5a:e4:cd:fc' }), 1000)
    expect(liveSightings()).toEqual([{ host: 'lava', ip: '10.6.9.66', mac: '40:d9:5a:e4:cd:fc', seenAt: 1000 }])
  })

  it('keeps BOTH addresses of a flip-flopping printer (same host, different IP)', () => {
    noteSighting(found({ ip: '10.6.9.109' }), 1000)
    noteSighting(found({ ip: '10.6.9.66' }), 2000)
    expect(liveSightings().map((seen) => seen.ip).sort()).toEqual(['10.6.9.109', '10.6.9.66'])
  })

  it('refreshes the timestamp instead of duplicating when the same host+ip is seen again', () => {
    noteSighting(found({ ip: '10.6.9.66' }), 1000)
    noteSighting(found({ ip: '10.6.9.66' }), 2000)
    expect(liveSightings()).toEqual([{ host: 'lava', ip: '10.6.9.66', mac: undefined, seenAt: 2000 }])
  })

  it('forgets a sighting older than the TTL', () => {
    noteSighting(found({ ip: '10.6.9.109' }), 1000)
    noteSighting(found({ ip: '10.6.9.66' }), 1000 + 6 * 60 * 1000)
    expect(liveSightings().map((seen) => seen.ip)).toEqual(['10.6.9.66'])
  })
})
