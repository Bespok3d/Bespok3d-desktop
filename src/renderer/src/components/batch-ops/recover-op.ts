// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useState } from 'react'
import type { RecoverResult } from '@bespok3d/contract'

// Recovery, the one batch operation that ends by restarting the printer: putting every plugin back
// leaves services restarted one after another, and the touchscreen is known to come back dead from
// that, so the printer is restarted every time rather than only when something says it must be.
//
// The restart answers whether the app is making it itself, which is what the report goes on to tell
// the user. A recovery the printer refused put nothing back, so that one is left alone.
export function useRecoverOp(
  restartAfterReapply: (printerId: string) => Promise<boolean>,
  recoveryDidNotRun: (printerId: string, setBusy: (busy: boolean) => void) => (error: unknown) => void,
) {
  const [recoveryResults, setRecoveryResults] = useState<RecoverResult | null>(null)
  const [recovering, setRecovering] = useState(false)
  const [restartingAfterRecovery, setRestartingAfterRecovery] = useState(false)
  function runRecover(printerId: string) {
    setRecovering(true)
    setRestartingAfterRecovery(false)
    window.b3d.store.recover(printerId)
      .then((results) => {
        setRecovering(false)
        setRecoveryResults(results)
      })
      .then(() => restartAfterReapply(printerId))
      .then(setRestartingAfterRecovery)
      .catch(recoveryDidNotRun(printerId, setRecovering))
  }

  return { recoveryResults, setRecoveryResults, recovering, restartingAfterRecovery, runRecover }
}
