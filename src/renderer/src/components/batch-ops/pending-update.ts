// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useState } from 'react'

export interface PendingUpdate {
  printerId: string
  specs: PluginUpdateSpec[]
}

// An update batch waits for the user to read it before it runs. Both entry points (the store's Update
// All and the header dropdown) ask first, and what the user confirms is what is sent: the dialog hands
// back the specs, which carry the source picked per plugin and may differ from the ones offered.
export function usePendingUpdate(startUpdateBatch: (printerId: string, specs: PluginUpdateSpec[]) => void) {
  const [pendingUpdate, setPendingUpdate] = useState<PendingUpdate | null>(null)

  function askUpdateAll(printerId: string, specs: PluginUpdateSpec[]) {
    setPendingUpdate({ printerId, specs })
  }

  function confirmUpdateAll(specs: PluginUpdateSpec[]) {
    const printerId = pendingUpdate?.printerId
    setPendingUpdate(null)
    if (printerId) startUpdateBatch(printerId, specs)
  }

  function cancelUpdateAll() {
    setPendingUpdate(null)
  }

  return { pendingUpdate, askUpdateAll, confirmUpdateAll, cancelUpdateAll }
}
