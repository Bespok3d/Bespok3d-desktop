import { describe, it, expect } from 'vitest'
import type { DiscoveredPrinterRecord } from '../env'
import {
  looksLikePrinter,
  vendorFromMac,
  discoveredVendorLabel,
  mergeDiscovered,
  dedupeDevices,
  guessAdapter,
} from './printerDiscovery'

function record(parts: Partial<DiscoveredPrinterRecord>): DiscoveredPrinterRecord {
  return {
    id: 'mdns-test',
    host: 'host.local',
    ip: '10.0.0.1',
    model: 'Network device',
    vendor: 'Unknown',
    service: '_http._tcp',
    ...parts,
  }
}

describe('looksLikePrinter', () => {
  it('keeps the Snapmaker U1 (brand in model)', () => {
    expect(looksLikePrinter(record({ model: 'Snapmaker U1' }))).toBe(true)
  })

  it('keeps a printer named in its hostname', () => {
    expect(looksLikePrinter(record({ host: 'voron-trident.local' }))).toBe(true)
  })

  it('keeps a Klipper host found through its exact service type', () => {
    expect(looksLikePrinter(record({ service: '_moonraker._tcp.local' }))).toBe(true)
  })

  it('rejects the consumer devices that leaked into the collapsed list', () => {
    const intruders = [
      record({ host: 'Hestia.local' }),
      record({ host: '2824C9F50C7D.local', service: '_airplay._tcp' }),
      record({ host: '90395F4EC912.local', service: '_googlecast._tcp' }),
      record({ host: '9ace56dc-4734790124da.local', model: 'KD-50X81J' }),
      record({ host: 'Sonos-347E5CFE82E2.local' }),
      record({ host: 'eWeLink_1000c8bcfc.local' }),
      record({ host: 'iPad-di-giuseppe.local', service: '_companion-link._tcp' }),
    ]
    intruders.forEach((device) => expect(looksLikePrinter(device)).toBe(false))
  })

  it('does not let "ender" match inside "extender"', () => {
    expect(looksLikePrinter(record({ host: 'wifi-extender.local' }))).toBe(false)
  })

  it('rejects a device on a known consumer NIC even without a name', () => {
    expect(looksLikePrinter(record({ host: 'abcd1234.local', mac: '34:7e:5c:11:22:33' }))).toBe(
      false
    )
  })
})

describe('vendorFromMac', () => {
  it('maps an OUI to its vendor and pads short macOS octets', () => {
    expect(vendorFromMac('34:7e:5c:1:2:3')).toBe('Sonos')
  })

  it('returns undefined for an unknown or missing OUI', () => {
    expect(vendorFromMac('aa:bb:cc:dd:ee:ff')).toBeUndefined()
    expect(vendorFromMac(undefined)).toBeUndefined()
  })
})

describe('discoveredVendorLabel', () => {
  it('prefers the OUI vendor over a generic model', () => {
    expect(discoveredVendorLabel(record({ mac: '34:7e:5c:00:00:01' }))).toBe('Sonos')
  })

  it('falls back to the advertised vendor, else nothing', () => {
    expect(discoveredVendorLabel(record({ vendor: 'Shelly' }))).toBe('Shelly')
    expect(discoveredVendorLabel(record({}))).toBeUndefined()
  })
})

describe('mergeDiscovered', () => {
  it('upgrades a generic model when a richer emit arrives', () => {
    const existing = record({ model: 'Network device' })
    const found = record({ model: 'Snapmaker U1', vendor: 'Snapmaker' })
    expect(mergeDiscovered(existing, found).model).toBe('Snapmaker U1')
  })

  it('backfills the MAC without disturbing an already-known model', () => {
    const existing = record({ model: 'Snapmaker U1' })
    const found = record({ model: 'Network device', mac: '11:22:33:44:55:66' })
    const merged = mergeDiscovered(existing, found)
    expect(merged.model).toBe('Snapmaker U1')
    expect(merged.mac).toBe('11:22:33:44:55:66')
  })

  it('returns the same object when nothing improves', () => {
    const existing = record({ model: 'Snapmaker U1', mac: '11:22:33:44:55:66' })
    expect(mergeDiscovered(existing, record({}))).toBe(existing)
  })
})

describe('dedupeDevices', () => {
  it('keeps one row per host even when scanners emit different ids', () => {
    const records = [
      record({ host: 'u1.local', id: 'mdns-raw', ip: '10.6.9.108' }),
      record({ host: 'u1.local', id: 'mdns-dnssd', ip: '10.6.9.108' }),
      record({ host: 'sonos.local', ip: '10.6.9.211' }),
    ]
    expect(dedupeDevices(records).map((entry) => entry.host)).toEqual(['u1.local', 'sonos.local'])
  })

  it('prefers the IPv4 address over an IPv6 link-local for the same host', () => {
    const records = [
      record({ host: 'u1.local', ip: 'fe80::88b:4340:334c:d7b5' }),
      record({ host: 'u1.local', ip: '10.6.9.108' }),
    ]
    const unique = dedupeDevices(records)
    expect(unique).toHaveLength(1)
    expect(unique[0].ip).toBe('10.6.9.108')
  })
})

describe('guessAdapter', () => {
  it('maps a Snapmaker model to the U1 adapter', () => {
    expect(guessAdapter('Unknown', 'Snapmaker U1')).toBe('snapmaker-u1')
  })

  it('falls back to the generic Klipper adapter', () => {
    expect(guessAdapter('Unknown', 'Network device')).toBe('klipper-generic')
  })
})
