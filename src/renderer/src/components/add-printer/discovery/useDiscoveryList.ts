import { useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { DiscoveredPrinterRecord } from '../../../env'
import { dedupeDevices, looksLikePrinter } from '../../../data/printerDiscovery'

export interface DiscoveryList {
  showAll: boolean
  setShowAll: Dispatch<SetStateAction<boolean>>
  visible: DiscoveredPrinterRecord[]
  hiddenN: number
  total: number
}

// Collapses the duplicate discovery emits to one row per host, then narrows to the likely
// printers unless the caller has opened the full list. `total` is the deduped device count,
// the honest figure behind a "show all N devices" affordance (raw emits double-count a host
// that answered on both IPv4 and a link-local address).
export function useDiscoveryList(discovered: DiscoveredPrinterRecord[]): DiscoveryList {
  const [showAll, setShowAll] = useState(false)
  const unique = dedupeDevices(discovered)
  const visible = showAll ? unique : unique.filter(looksLikePrinter)

  return { showAll, setShowAll, visible, hiddenN: unique.length - visible.length, total: unique.length }
}
