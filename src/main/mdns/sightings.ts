import type { DiscoveredPrinterRecord } from './types'

// Where each device was recently seen on the LAN, kept in main as a side effect of discovery so the
// status probe and SSH ops can FOLLOW a printer whose DHCP lease moved instead of using its stale
// recorded IP. The mDNS scanners already find a moved printer at its new address and emit it; this
// table is that stream captured in main. It keeps EVERY recent address per device (deduped by
// host+ip, not collapsed to one), so a printer that flip-flops between two leases keeps BOTH on file
// and an op can probe each to find which one answers right now.
var sightings: DeviceSighting[] = []

// Cap the table and forget a sighting after this long: a powered-off device's old IP gets handed to
// another box, and a sighting too old to trust must not steer a probe to the wrong machine.
const SIGHTING_TTL_MS = 5 * 60 * 1000
const MAX_SIGHTINGS = 64

export interface DeviceSighting {
  host: string
  ip: string
  mac?: string
  seenAt: number
}

export function noteSighting(record: DiscoveredPrinterRecord, now: number): void {
  const kept = sightings.filter(
    (seen) => now - seen.seenAt <= SIGHTING_TTL_MS && !(seen.host === record.host && seen.ip === record.ip),
  )

  sightings = [...kept, { host: record.host, ip: record.ip, mac: record.mac, seenAt: now }].slice(-MAX_SIGHTINGS)
}

export function liveSightings(): DeviceSighting[] {
  return sightings
}

export function clearSightings(): void {
  sightings = []
}
