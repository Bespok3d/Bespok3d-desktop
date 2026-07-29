// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useState, useEffect } from 'react'
import type { DiscoveredPrinterRecord } from '../../../env'

export function useScanPick(initialPickedId: string | undefined, discovered: DiscoveredPrinterRecord[]) {
  const [scanning, setScanning] = useState(true)
  const [picked, setPicked] = useState<DiscoveredPrinterRecord | null>(null)

  function scheduleScanEnd() {
    const timer = setTimeout(() => setScanning(false), 1800)

    return () => clearTimeout(timer)
  }
  function syncInitialPick() {
    if (!initialPickedId) return
    const found = discovered.find((device) => device.id === initialPickedId)
    if (found) setPicked(found)
  }

  useEffect(scheduleScanEnd, [])
  useEffect(syncInitialPick, [initialPickedId, discovered])

  return { scanning, picked, setPicked, onRescan: () => setScanning(true) }
}
