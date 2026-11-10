// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { applyEnrolledOutcome, leavesThePluginsToPutBack } from './callbacks'
import type { EnrollMode } from '../components/enrollment'
import { installB3d } from '../test/b3d-mock'
import { makePrinter } from '../test/fixtures'

describe('which modes leave the plugins to put back', () => {
  it('does not re-apply after reactivation, which already put the plugins back on the printer', () => {
    expect(leavesThePluginsToPutBack('reactivate')).toBe(false)
  })

  it('re-applies after recovery and after repair, which leave the daemon fresh and the plugins off', () => {
    expect(leavesThePluginsToPutBack('recovery')).toBe(true)
    expect(leavesThePluginsToPutBack('repair')).toBe(true)
  })

  it('leaves every other mode alone', () => {
    expect(leavesThePluginsToPutBack('enroll')).toBe(false)
    expect(leavesThePluginsToPutBack('deactivate')).toBe(false)
    expect(leavesThePluginsToPutBack('uninstall')).toBe(false)
    expect(leavesThePluginsToPutBack(undefined)).toBe(false)
  })

  it('re-applies after anything run from the Force menu, which rebuilds the layer the plugins hang off', () => {
    expect(leavesThePluginsToPutBack('enroll', true)).toBe(true)
    expect(leavesThePluginsToPutBack('recovery', true)).toBe(true)
    expect(leavesThePluginsToPutBack('repair', true)).toBe(true)
  })

  it('still does not re-apply after a mode the Force menu never offers, which would restart the printer twice', () => {
    expect(leavesThePluginsToPutBack('reactivate', true)).toBe(false)
    expect(leavesThePluginsToPutBack('deactivate', true)).toBe(false)
    expect(leavesThePluginsToPutBack('uninstall', true)).toBe(false)
    expect(leavesThePluginsToPutBack('reboot', true)).toBe(false)
    expect(leavesThePluginsToPutBack('update-daemon', true)).toBe(false)
  })

  it('does not re-apply after a first-time enrollment, which has no plugins to put back', () => {
    expect(leavesThePluginsToPutBack('enroll', false)).toBe(false)
  })
})

function enrolledOutcomeDeps() {
  return {
    printers: [makePrinter()], setPrinters: vi.fn(), setSelectedId: vi.fn(), setDiscovered: vi.fn(), setAddPrinterModal: vi.fn(),
    setEnrollModal: vi.fn(), removePrinter: vi.fn(), enrollGate: {} as Parameters<typeof applyEnrolledOutcome>[2]['enrollGate'],
    enrollMode: undefined, enrollForced: undefined, markExpectedRestart: vi.fn(), runRecover: vi.fn(), checkAfterTheirRestart: vi.fn(),
  }
}

function finishWindow(mode: EnrollMode) {
  var deps = enrolledOutcomeDeps()
  installB3d()
  applyEnrolledOutcome(makePrinter(), mode, deps)

  return deps
}

// A recover the app could not restart after leaves its check to the restart the user makes from the
// restart window, and only the app ever asks the printer for it.
describe('the restart the user made from the restart window', () => {
  it('runs the check a recover left to that restart', () => {
    expect(finishWindow('reboot').checkAfterTheirRestart).toHaveBeenCalledWith('printer-1')
  })

  it('is the only window that runs it', () => {
    expect(finishWindow('update-daemon').checkAfterTheirRestart).not.toHaveBeenCalled()
    expect(finishWindow('recovery').checkAfterTheirRestart).not.toHaveBeenCalled()
  })
})
