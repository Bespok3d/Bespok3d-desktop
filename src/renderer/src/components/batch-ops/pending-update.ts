// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useState } from 'react'
import type { UpdateAllPlan } from '../plugin-store/migrations'

export interface PendingUpdate {
  printerId: string
  plan: UpdateAllPlan
}

// An update batch waits for the user to read it before it runs. Both entry points (the store's Update
// All and the header dropdown) ask first, and what the user confirms is what is sent: the dialog hands
// back the specs, which carry the source picked per plugin and may differ from the ones offered. The
// plugins being replaced by a set are not the user's to re-source, so they ride through untouched.
export function usePendingUpdate(startUpdateBatch: (printerId: string, plan: UpdateAllPlan) => void) {
  const [pendingUpdate, setPendingUpdate] = useState<PendingUpdate | null>(null)

  function askUpdateAll(printerId: string, plan: UpdateAllPlan) {
    setPendingUpdate({ printerId, plan })
  }

  function confirmUpdateAll(specs: PluginUpdateSpec[]) {
    const pending = pendingUpdate
    setPendingUpdate(null)
    if (pending) startUpdateBatch(pending.printerId, { updates: specs, migrations: pending.plan.migrations })
  }

  function cancelUpdateAll() {
    setPendingUpdate(null)
  }

  return { pendingUpdate, askUpdateAll, confirmUpdateAll, cancelUpdateAll }
}
