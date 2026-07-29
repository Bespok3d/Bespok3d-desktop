// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { DeviceSighting } from '../mdns/sightings'

// How long a discovery sighting is trusted as a candidate address. A DHCP move settles in seconds to a
// couple of minutes; past that the device may be gone and another box may hold the address.
const SIGHTING_TRUST_MS = 3 * 60 * 1000

interface PrinterIdentity {
  host: string
  ip: string
  mac?: string
}

// A discovery IP is usable when it is IPv4: an fe80:: link-local (the only IPv6 mDNS hands back) is not
// somewhere we can reach the daemon or SSH, so it is never a candidate.
function isRoutableIpv4(ip: string): boolean {
  return ip.length > 0 && !ip.includes(':')
}

function looksLikeIpv4Literal(value: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(value)
}

function macsMatch(printerMac: string | undefined, sightingMac: string | undefined): boolean {
  return Boolean(printerMac && sightingMac && printerMac.toLowerCase() === sightingMac.toLowerCase())
}

// A bare-IP host (a manually-added printer typed as an address) is not a stable identity, so it must
// never match a real hostname sighting; only a true mDNS hostname identifies a printer across a move.
function hostsMatch(printerHost: string, sightingHost: string): boolean {
  return printerHost.length > 0 && printerHost === sightingHost && !looksLikeIpv4Literal(printerHost)
}

// A sighting is the same device when its MAC matches (preferred, unique even if hostnames collide) or,
// when no MAC is known on both sides, its hostname matches.
function identifiesPrinter(printer: PrinterIdentity, sighting: DeviceSighting): boolean {
  if (printer.mac && sighting.mac) return macsMatch(printer.mac, sighting.mac)

  return hostsMatch(printer.host, sighting.host)
}

// Every address a printer might currently answer on: its recorded IP first, then every fresh discovery
// sighting of the same device (by MAC, else hostname). A printer that flip-flops between two leases
// yields both, so the caller probes each and uses whichever responds, rather than guessing. The caller
// disambiguates by PROBING, so two distinct printers that happen to share a hostname only matter when
// neither answers at its own recorded IP (in practice every U1 advertises a unique serial hostname).
export function candidateAddresses(
  printer: PrinterIdentity,
  sightings: DeviceSighting[],
  now: number,
): string[] {
  const moved = sightings
    .filter((sighting) =>
      now - sighting.seenAt <= SIGHTING_TRUST_MS &&
      isRoutableIpv4(sighting.ip) &&
      identifiesPrinter(printer, sighting),
    )
    .map((sighting) => sighting.ip)

  return [printer.ip, ...moved].filter((ip, index, all) => all.indexOf(ip) === index)
}
