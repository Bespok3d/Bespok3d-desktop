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
// back the plan, whose specs carry the source picked per plugin and any value the user was asked for,
// so they may differ from the ones offered.
export function usePendingUpdate(startUpdateBatch: (printerId: string, plan: UpdateAllPlan) => void) {
  const [pendingUpdate, setPendingUpdate] = useState<PendingUpdate | null>(null)

  function askUpdateAll(printerId: string, plan: UpdateAllPlan) {
    setPendingUpdate({ printerId, plan })
  }

  function confirmUpdateAll(plan: UpdateAllPlan) {
    const pending = pendingUpdate
    setPendingUpdate(null)
    if (pending) startUpdateBatch(pending.printerId, plan)
  }

  function cancelUpdateAll() {
    setPendingUpdate(null)
  }

  return { pendingUpdate, askUpdateAll, confirmUpdateAll, cancelUpdateAll }
}
