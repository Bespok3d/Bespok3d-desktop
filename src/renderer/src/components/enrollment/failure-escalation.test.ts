// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect, vi } from 'vitest'
import { nextStepAfterFailure } from './failure-escalation'

describe('what a failed run offers next', () => {
  it('offers full recovery when the daemon fix fails', () => {
    var runRecovery = vi.fn()
    var offered = nextStepAfterFailure('repair', runRecovery, vi.fn())

    expect(offered?.labelKey).toBe('enroll.progress.run_recovery')
    offered?.run()
    expect(runRecovery).toHaveBeenCalled()
  })

  it('offers rebuilding the printer when the full recovery itself fails', () => {
    var rebuildPrinter = vi.fn()
    var offered = nextStepAfterFailure('recovery', vi.fn(), rebuildPrinter)

    expect(offered?.labelKey).toBe('enroll.progress.rebuild_printer')
    offered?.run()
    expect(rebuildPrinter).toHaveBeenCalled()
  })

  it('offers nothing further when the rebuild itself fails, since the app has nothing left to try', () => {
    expect(nextStepAfterFailure('enroll', vi.fn(), vi.fn())).toBeUndefined()
  })

  it('offers nothing when the caller wired no way to run it', () => {
    expect(nextStepAfterFailure('repair')).toBeUndefined()
    expect(nextStepAfterFailure('recovery')).toBeUndefined()
  })
})
