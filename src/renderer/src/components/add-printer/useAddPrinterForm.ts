// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useState, useEffect } from 'react'
import type { Printer } from '../../data/types'
import type { DiscoveredPrinterRecord } from '../../env'
import { guessAdapter } from '../../data/printerDiscovery'
import { buildPrinter } from '../../data/printers'
import { useScanPick } from './discovery/useScanPick'
import type { Tab } from './TabBar'

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

function firstAdapterId(adapters: AdapterInfo[]): string {
  return adapters[0]?.id ?? ''
}

// The guess is only a pre-selection, so it never survives being wrong: an id this build did not
// register is not offered in the list, and picking it would enroll against an adapter that is not
// there. The first registered adapter is the honest fallback.
function offeredAdapterId(adapters: AdapterInfo[], guessed: string): string {
  return adapters.some((adapter) => adapter.id === guessed) ? guessed : firstAdapterId(adapters)
}

// Owns the whole "add a printer" form: the scan-vs-manual tab, the manual fields, and the
// device pick (via useScanPick). Picking a device pre-fills the adapter from its identity;
// switching tabs returns every field to its initial value so each tab starts a clean entry.
export function useAddPrinterForm(
  initialTab: Tab,
  initialPickedId: string | undefined,
  discovered: DiscoveredPrinterRecord[],
  adapters: AdapterInfo[],
): AddPrinterForm {
  const [tab, setTab] = useState<Tab>(initialTab)
  const [manualIp, setManualIp] = useState('')
  const [nick, setNick] = useState('')
  const [adapterId, setAdapterId] = useState(firstAdapterId(adapters))
  const [customSshCredentials, setCustomSshCredentials] = useState(false)
  const { scanning, picked, setPicked, onRescan } = useScanPick(initialPickedId, discovered)

  // The list arrives over IPC a tick after the modal opens, so the first render has nothing to
  // select. This fills the empty field in once it does, and leaves a real choice alone.
  function adoptFirstAdapter() {
    if (adapterId === '') setAdapterId(firstAdapterId(adapters))
  }
  useEffect(adoptFirstAdapter, [adapters])

  function adaptFormToPick() {
    if (!picked) return
    setNick('')
    setAdapterId(offeredAdapterId(adapters, guessAdapter(picked.vendor, picked.model, picked.host)))
  }
  // Keyed on the list too: a device picked before the list arrived over IPC gets its guess re-applied
  // against the real list instead of being left on whatever was first.
  useEffect(adaptFormToPick, [picked, adapters])

  function switchTab(next: Tab) {
    setTab(next)
    setPicked(null)
    setNick('')
    setManualIp('')
    setAdapterId(firstAdapterId(adapters))
  }

  return {
    tab, switchTab, scanning, picked, setPicked, onRescan,
    manualIp, setManualIp, nick, setNick, adapterId, setAdapterId,
    customSshCredentials, setCustomSshCredentials,
    canAdd: canSubmit(tab, picked, manualIp, nick),
    buildEntry: () => buildPrinter(tab, picked, manualIp, nick, adapterId, customSshCredentials),
  }
}
