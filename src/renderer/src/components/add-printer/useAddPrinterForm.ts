import { useState, useEffect } from 'react'
import type { Printer } from '../../data/types'
import type { DiscoveredPrinterRecord } from '../../env'
import { BUNDLED_ADAPTERS } from '../../data/catalog/bundled'
import { guessAdapter } from '../../data/printerDiscovery'
import { buildPrinter } from '../../data/printers'
import { useScanPick } from './discovery/useScanPick'
import type { Tab } from './TabBar'

const DEFAULT_ADAPTER_ID = BUNDLED_ADAPTERS[0]?.id ?? ''

export interface AddPrinterForm {
  tab: Tab
  switchTab: (next: Tab) => void
  scanning: boolean
  picked: DiscoveredPrinterRecord | null
  setPicked: (device: DiscoveredPrinterRecord | null) => void
  onRescan: () => void
  manualIp: string
  setManualIp: (value: string) => void
  nick: string
  setNick: (value: string) => void
  adapterId: string
  setAdapterId: (value: string) => void
  customSshCredentials: boolean
  setCustomSshCredentials: (value: boolean) => void
  canAdd: boolean
  buildEntry: () => Printer
}

function canSubmit(tab: Tab, picked: DiscoveredPrinterRecord | null, manualIp: string, nick: string): boolean {
  if (nick.trim() === '') return false

  return tab === 'scan' ? picked !== null : manualIp.trim() !== ''
}

// Owns the whole "add a printer" form: the scan-vs-manual tab, the manual fields, and the
// device pick (via useScanPick). Picking a device pre-fills the adapter from its identity;
// switching tabs returns every field to its initial value so each tab starts a clean entry.
export function useAddPrinterForm(
  initialTab: Tab,
  initialPickedId: string | undefined,
  discovered: DiscoveredPrinterRecord[],
): AddPrinterForm {
  const [tab, setTab] = useState<Tab>(initialTab)
  const [manualIp, setManualIp] = useState('')
  const [nick, setNick] = useState('')
  const [adapterId, setAdapterId] = useState(DEFAULT_ADAPTER_ID)
  const [customSshCredentials, setCustomSshCredentials] = useState(false)
  const { scanning, picked, setPicked, onRescan } = useScanPick(initialPickedId, discovered)

  function adaptFormToPick() {
    if (!picked) return
    setNick('')
    setAdapterId(guessAdapter(picked.vendor, picked.model))
  }
  useEffect(adaptFormToPick, [picked])

  function switchTab(next: Tab) {
    setTab(next)
    setPicked(null)
    setNick('')
    setManualIp('')
    setAdapterId(DEFAULT_ADAPTER_ID)
  }

  return {
    tab, switchTab, scanning, picked, setPicked, onRescan,
    manualIp, setManualIp, nick, setNick, adapterId, setAdapterId,
    customSshCredentials, setCustomSshCredentials,
    canAdd: canSubmit(tab, picked, manualIp, nick),
    buildEntry: () => buildPrinter(tab, picked, manualIp, nick, adapterId, customSshCredentials),
  }
}
