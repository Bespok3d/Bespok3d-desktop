// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect } from 'vitest'
import { leavesThePluginsToPutBack } from './callbacks'

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
})
