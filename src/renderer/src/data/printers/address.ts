import type { Printer } from '../types'
import type { DiscoveredPrinterRecord } from '../../env'
import { resolvedStatus } from './status'

function isRoutableIpv4(ip: string): boolean {
  return ip.length > 0 && !ip.includes(':')
}

function macsEqual(printerMac: string | undefined, foundMac: string | undefined): boolean {
  return Boolean(printerMac && foundMac && printerMac.toLowerCase() === foundMac.toLowerCase())
}

// Discovery identity is the MAC when both sides carry one (unique even when every U1 answers to the
// same `lava` hostname, so two printers are never crossed), then the mDNS hostname, falling back to IP
// for a manually-added printer that was typed as a bare address and carries no hostname.
function isSameDiscoveredDevice(printer: Printer, found: DiscoveredPrinterRecord): boolean {
  if (printer.mac && found.mac) return macsEqual(printer.mac, found.mac)
  if (printer.host && found.host && printer.host === found.host) return true

  return printer.ip === found.ip
}

// A printer whose DHCP lease moved keeps its old saved IP, so the UI shows a stale address - and when
// two printers swap leases, each reads as the other's. When discovery sees the same device (by stable
// hostname) on a new routable IPv4, adopt it so the shown address is always the live one. Returns the
// same object reference when nothing matched, so the caller can leave that record untouched.
export function reconcileDiscoveredAddress(printer: Printer, found: DiscoveredPrinterRecord): Printer {
  if (!isSameDiscoveredDevice(printer, found)) return printer
  if (isRoutableIpv4(found.ip) && found.ip !== printer.ip) {
    return { ...printer, ip: found.ip, status: resolvedStatus(printer) }
  }

  return { ...printer, status: resolvedStatus(printer) }
}
