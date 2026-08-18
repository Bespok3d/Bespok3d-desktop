// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { EnrollMode } from './index'

export interface FailureEscalation {
  labelKey: string
  run: () => void
}

// What is left to try when this run fails, offered on the failure screen as the primary button. A daemon
// repair that fails still has full recovery; a full recovery that fails still has rebuilding the printer,
// which re-enrolls it and puts every plugin back. Past that the app has nothing further to offer, so the
// failure screen carries no next step and the user is pointed at reporting it instead.
export function nextStepAfterFailure(mode: EnrollMode, runRecovery?: () => void, rebuildPrinter?: () => void): FailureEscalation | undefined {
  if (mode === 'repair' && runRecovery) return { labelKey: 'enroll.progress.run_recovery', run: runRecovery }
  if (mode === 'recovery' && rebuildPrinter) return { labelKey: 'enroll.progress.rebuild_printer', run: rebuildPrinter }

  return undefined
}
