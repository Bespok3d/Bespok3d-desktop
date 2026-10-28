// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect } from 'vitest'
import { problemBannerCopy, problemLineKey } from './printer-problems'

const HALF_REMOVED_SPOOLMAN = { kind: 'plugin_half_removed', detail: 'spoolman', pluginId: 'spoolman' }
const HALF_REMOVED_CAMERA = { kind: 'plugin_half_removed', detail: 'camera', pluginId: 'camera' }
const RECOVERY_FAILED_CAMERA = { kind: 'plugin_recovery_failed', detail: 'camera', pluginId: 'camera' }
const INCLUDES_MISSING = { kind: 'includes_missing', detail: 'printer.cfg', pluginId: null }

describe('problemBannerCopy', () => {
  it('names the plugin and offers a clean up when a plugin was left half removed', () => {
    expect(problemBannerCopy([HALF_REMOVED_SPOOLMAN])).toEqual({
      bodyKey: 'banner.printer_problem_half_removed_body', actionKey: 'banner.printer_problem_cleanup_action', pluginNames: 'spoolman',
    })
  })

  it('names every half removed plugin', () => {
    expect(problemBannerCopy([HALF_REMOVED_SPOOLMAN, HALF_REMOVED_CAMERA]).pluginNames).toBe('spoolman, camera')
  })

  it('says Bespok3d itself is not set up when any problem is not a plugin one', () => {
    expect(problemBannerCopy([HALF_REMOVED_SPOOLMAN, INCLUDES_MISSING]).bodyKey).toBe('banner.printer_problem_bespok3d_body')
  })

  it('counts a kind this build does not know as Bespok3d itself, never a plugin', () => {
    expect(problemBannerCopy([{ kind: 'from_a_newer_daemon', detail: 'anything', pluginId: 'spoolman' }]).bodyKey).toBe('banner.printer_problem_bespok3d_body')
  })

  it('names the plugin a recovery could not put back when no plugin was left half removed', () => {
    expect(problemBannerCopy([RECOVERY_FAILED_CAMERA])).toEqual({
      bodyKey: 'banner.printer_problem_recovery_failed_body', actionKey: 'banner.printer_problem_action', pluginNames: 'camera',
    })
  })
})

describe('problemLineKey', () => {
  it('gives each known kind its own line', () => {
    expect(problemLineKey(HALF_REMOVED_SPOOLMAN)).toBe('banner.printer_problem_line.plugin_half_removed')
  })

  it('words a kind this build does not know with the unknown line', () => {
    expect(problemLineKey({ kind: 'from_a_newer_daemon', detail: 'anything', pluginId: null })).toBe('banner.printer_problem_line.unknown')
  })
})
