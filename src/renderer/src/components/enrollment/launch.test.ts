// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect } from 'vitest'
import { isDaemonRestartMode } from './index'
import { autoStartEligible, awaitingGoAhead } from './useGoAhead'

// Every one of these stops the plugins, re-deploys the daemon or restarts the printer. Opening the
// window was never the user saying yes to that, so none of them may start on their own.
describe('autoStartEligible', () => {
  it('never starts an op that touches the printer before the user has said go', () => {
    expect(autoStartEligible('update-daemon', false)).toBe(false)
    expect(autoStartEligible('deactivate', false)).toBe(false)
    expect(autoStartEligible('reactivate', false)).toBe(false)
    expect(autoStartEligible('reboot', false)).toBe(false)
    expect(autoStartEligible('uninstall', false)).toBe(false)
    expect(autoStartEligible('repair', false)).toBe(false)
  })

  it('never auto-starts history (nothing to run)', () => {
    expect(autoStartEligible('history', false)).toBe(false)
  })

  it('auto-starts the remaining ops only when the printer uses adapter-default credentials', () => {
    expect(autoStartEligible('update-jinni', false)).toBe(true)
    expect(autoStartEligible('update-jinni', true)).toBe(false)
  })
})

describe('awaitingGoAhead', () => {
  it('holds every printer-touching op on its go-ahead screen', () => {
    expect(awaitingGoAhead('update-daemon', 'credentials', false)).toBe(true)
    expect(awaitingGoAhead('deactivate', 'credentials', false)).toBe(true)
    expect(awaitingGoAhead('reactivate', 'credentials', false)).toBe(true)
    expect(awaitingGoAhead('reboot', 'credentials', false)).toBe(true)
    expect(awaitingGoAhead('uninstall', 'credentials', false)).toBe(true)
    expect(awaitingGoAhead('repair', 'credentials', false)).toBe(true)
  })

  it('clears once the user says go so the op can run', () => {
    expect(awaitingGoAhead('deactivate', 'credentials', true)).toBe(false)
  })

  it('does not gate once the op is already running', () => {
    expect(awaitingGoAhead('deactivate', 'enrolling', false)).toBe(false)
  })

  it('leaves enrollment itself alone', () => {
    expect(awaitingGoAhead('enroll', 'credentials', false)).toBe(false)
  })
})

describe('isDaemonRestartMode', () => {
  it('still flags update-daemon as a daemon-restart mode', () => {
    expect(isDaemonRestartMode('update-daemon')).toBe(true)
  })
})
