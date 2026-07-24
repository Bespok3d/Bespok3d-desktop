import type { Printer } from '../types'
import type { DiscoveredPrinterRecord } from '../../env'

// Builds a fresh Printer from the add-printer form: a picked scan result keeps its discovered model and
// hostname; a manually-typed address has neither, so the bare IP stands in for both.
export function buildPrinter(
  tab: 'scan' | 'manual',
  picked: DiscoveredPrinterRecord | null,
  manualIp: string,
  nick: string,
  adapterId: string,
  customSshCredentials: boolean
): Printer {
  if (tab === 'scan' && picked) {
    return {
      id: `p-${Date.now()}`,
      nick: nick.trim(),
      model: picked.model,
      adapter: adapterId,
      host: picked.host,
      ip: picked.ip,
      status: 'checking',
      customSshCredentials,
      installedIds: [],
    }
  }

  return {
    id: `p-${Date.now()}`,
    nick: nick.trim(),
    model: 'Unknown',
    adapter: adapterId,
    host: manualIp.trim(),
    ip: manualIp.trim(),
    status: 'checking',
    customSshCredentials,
    installedIds: [],
  }
}
