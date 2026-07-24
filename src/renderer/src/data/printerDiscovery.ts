import type { DiscoveredPrinterRecord } from '../env'

// 3D-printer brand and stack tokens, matched as whole words against the device's
// name and descriptive fields (host, model, vendor). Word-boundary matching stops
// "ender" from matching "extender" and keeps stray strings from reading as a brand.
const PRINTER_BRAND_HINTS = [
  'snapmaker',
  'klipper',
  'moonraker',
  'mainsail',
  'fluidd',
  'octoprint',
  'voron',
  'prusa',
  'creality',
  'artillery',
  'raise3d',
  'bambu',
  'qidi',
  'anycubic',
  'flsun',
  'sovol',
  'biqu',
]

const BRAND_PATTERN = new RegExp(`(^|[^a-z0-9])(${PRINTER_BRAND_HINTS.join('|')})([^a-z]|$)`, 'i')

// mDNS service types a Klipper/Moonraker print host advertises. Matched on the exact
// service label (_moonraker._tcp), never as a loose substring, so a TV advertising
// _googlecast or a phone advertising _companion-link can never read as a printer.
const PRINTER_SERVICE_TYPES = new Set([
  'octoprint',
  'moonraker',
  'klipper',
  'mainsail',
  'fluidd',
  'snapmaker',
  'prusalink',
  'repetier',
])

// Names that consumer gadgets put in their mDNS hostname. A match is a strong "not a
// printer" signal even when we have no MAC and the device hides behind a generic model.
const CONSUMER_NAME_HINTS = [
  'sonos',
  'ewelink',
  'shelly',
  'chromecast',
  'googlecast',
  'google-nest',
  'google-home',
  'nest',
  'alexa',
  'firetv',
  'fire-tv',
  'roku',
  'appletv',
  'apple-tv',
  'ipad',
  'iphone',
  'macbook',
  'homepod',
  'airport',
  'bravia',
  'samsung',
  'webos',
  'hue',
  'lifx',
  'tasmota',
  'esphome',
  'tuya',
  'wyze',
  'eufy',
  'heos',
  'tp-link',
  'tplink',
  'dlink',
  'fritz',
  'unifi',
]

// MAC OUI (first three octets) to a friendly vendor name, for the consumer gadgets
// that crowd a home network. Used both to label a row and to keep it out of the
// printer list. Not exhaustive: a missing OUI just falls back to the other signals.
const OUI_VENDORS = new Map<string, string>([
  ['001451', 'Apple'],
  ['0017f2', 'Apple'],
  ['001b63', 'Apple'],
  ['0023df', 'Apple'],
  ['002500', 'Apple'],
  ['28cfda', 'Apple'],
  ['3c15c2', 'Apple'],
  ['60f445', 'Apple'],
  ['8866a5', 'Apple'],
  ['90b0ed', 'Apple'],
  ['a483e7', 'Apple'],
  ['dca904', 'Apple'],
  ['f01898', 'Apple'],
  ['f0b3ec', 'Apple'],
  ['000e58', 'Sonos'],
  ['347e5c', 'Sonos'],
  ['5caafd', 'Sonos'],
  ['48a6b8', 'Sonos'],
  ['78828a', 'Sonos'],
  ['949f3e', 'Sonos'],
  ['b8e937', 'Sonos'],
  ['f4f5d8', 'Google'],
  ['f88fca', 'Google'],
  ['1cf29a', 'Google'],
  ['30fd38', 'Google'],
  ['6cadf8', 'Google'],
  ['44650d', 'Amazon'],
  ['6837e9', 'Amazon'],
  ['fc65de', 'Amazon'],
  ['74c246', 'Amazon'],
  ['b0a737', 'Roku'],
  ['cc6da0', 'Roku'],
  ['d83134', 'Roku'],
  ['fcf152', 'Sony'],
  ['0013a9', 'Sony'],
  ['30f9ed', 'Sony'],
  ['543986', 'Sony'],
  ['ac9b0a', 'Sony'],
  ['00e091', 'LG'],
  ['10683f', 'LG'],
  ['c4366c', 'LG'],
  ['246f28', 'Espressif'],
  ['30aea4', 'Espressif'],
  ['a4cf12', 'Espressif'],
  ['7c9ebd', 'Espressif'],
  ['8caab5', 'Espressif'],
])

function ouiOf(mac: string | undefined): string | undefined {
  if (!mac) return undefined
  const hex = mac.replace(/[^0-9a-f]/gi, '').toLowerCase()

  return hex.length >= 6 ? hex.slice(0, 6) : undefined
}

export function vendorFromMac(mac: string | undefined): string | undefined {
  const oui = ouiOf(mac)

  return oui ? OUI_VENDORS.get(oui) : undefined
}

function serviceLabel(service: string): string | undefined {
  return service.toLowerCase().match(/_([a-z0-9-]+)\._(?:tcp|udp)/)?.[1]
}

function describesPrinterBrand(record: DiscoveredPrinterRecord): boolean {
  return BRAND_PATTERN.test(`${record.host} ${record.model} ${record.vendor}`)
}

function advertisesPrinterService(record: DiscoveredPrinterRecord): boolean {
  const label = serviceLabel(record.service)

  return label !== undefined && PRINTER_SERVICE_TYPES.has(label)
}

function looksLikeConsumerGadget(record: DiscoveredPrinterRecord): boolean {
  if (vendorFromMac(record.mac)) return true
  const name = record.host.toLowerCase()

  return CONSUMER_NAME_HINTS.some((hint) => name.includes(hint))
}

export function looksLikePrinter(record: DiscoveredPrinterRecord): boolean {
  if (describesPrinterBrand(record)) return true
  if (looksLikeConsumerGadget(record)) return false

  return advertisesPrinterService(record)
}

// A friendly label for the discovered row: the OUI vendor if we know it, else the
// device's own advertised vendor, else nothing (the caller shows the raw model).
export function discoveredVendorLabel(record: DiscoveredPrinterRecord): string | undefined {
  const known = vendorFromMac(record.mac)
  if (known) return known

  return record.vendor && record.vendor !== 'Unknown' ? record.vendor : undefined
}

// Fold a fresh discovery emit into the record we already hold for that IP. A later
// emit can upgrade a generic "Network device" to a real model, or backfill the MAC
// once the ARP table warms up. Returns the same object when nothing improved so the
// caller can skip a re-render.
export function mergeDiscovered(
  existing: DiscoveredPrinterRecord,
  found: DiscoveredPrinterRecord
): DiscoveredPrinterRecord {
  const modelUpgrade = found.model !== 'Network device' && existing.model === 'Network device'
  const macUpgrade = !existing.mac && Boolean(found.mac)
  if (!modelUpgrade && !macUpgrade) return existing

  return {
    ...existing,
    model: modelUpgrade ? found.model : existing.model,
    vendor: modelUpgrade ? found.vendor : existing.vendor,
    service: modelUpgrade ? found.service : existing.service,
    mac: existing.mac ?? found.mac,
  }
}

function isIpv4(ip: string): boolean {
  return !ip.includes(':')
}

// One physical device shows up under several ids (raw and dns-sd scanners) and several
// addresses (IPv4 plus a long IPv6 link-local). The hostname is the real identity, so
// collapse to one row per host and keep the IPv4 address when we have it: a routable
// printer address beats an unusable fe80:: link-local in the row.
export function dedupeDevices(records: DiscoveredPrinterRecord[]): DiscoveredPrinterRecord[] {
  const byHost = new Map<string, DiscoveredPrinterRecord>()
  records.forEach((record) => {
    const current = byHost.get(record.host)
    if (!current || (isIpv4(record.ip) && !isIpv4(current.ip))) byHost.set(record.host, record)
  })

  return Array.from(byHost.values())
}

export function guessAdapter(vendor: string, model: string): string {
  const vendorLower = vendor.toLowerCase()
  const modelLower = model.toLowerCase()
  if (vendorLower.includes('snapmaker') || modelLower.includes('snapmaker')) return 'snapmaker-u1'
  if (modelLower.includes('voron')) return 'voron-24'

  return 'klipper-generic'
}
