import type { BrowserWindow } from 'electron'
import type { DiscoveredPrinterRecord } from './types'
import { macForIp } from './arp'
import { noteSighting } from './sightings'

export function emitDiscovered(win: BrowserWindow, record: DiscoveredPrinterRecord): void {
  if (win.isDestroyed()) return
  const mac = macForIp(record.ip)
  const stamped = mac ? { ...record, mac } : record
  noteSighting(stamped, Date.now())
  win.webContents.send('mdns:found', stamped)
}
