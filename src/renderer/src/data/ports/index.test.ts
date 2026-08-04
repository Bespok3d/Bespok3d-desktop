// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect } from 'vitest'
import type { Plugin } from '../types'
import { uiPorts, suggestedPort, steppedDownPort, portClaimPlan, portSwapNote, isUiPlugin } from './index'

function uiPlugin(id: string, portKey: string, defaultPort: string): Plugin {
  return {
    id,
    name: id,
    title: id,
    category: 'ui',
    tagline: '',
    description: '',
    version: '0.1.0',
    channel: 'stable',
    publisher: 'x',
    signer: null,
    trust: 'project',
    deps: [],
    conflicts: [],
    sources: [],
    config: [{ key: portKey, label: 'Port', type: 'http-port', scope: 'global', default: defaultPort }],
  }
}

const FLUIDD = uiPlugin('fluidd', 'FLUIDD_PORT', '80')
const MAINSAIL = uiPlugin('mainsail', 'MAINSAIL_PORT', '81')
const SPOOLMAN: Plugin = { ...uiPlugin('spoolman', 'X', '0'), config: [] }
const PLUGINS = [FLUIDD, MAINSAIL, SPOOLMAN]

describe('isUiPlugin', () => {
  it('is true only for plugins with an http-port field', () => {
    expect(isUiPlugin(FLUIDD)).toBe(true)
    expect(isUiPlugin(SPOOLMAN)).toBe(false)
  })
})

describe('uiPorts', () => {
  it('reads each installed UI port from the saved vars, falling back to the field default', () => {
    expect(uiPorts(PLUGINS, ['fluidd', 'mainsail', 'spoolman'], { MAINSAIL_PORT: '81' })).toEqual({
      fluidd: 80,
      mainsail: 81,
    })
  })
})

describe('suggestedPort', () => {
  it('suggests 80 for the first UI and the next free port for a second', () => {
    expect(suggestedPort(PLUGINS, [], {}, 'fluidd')).toBe(80)
    expect(suggestedPort(PLUGINS, ['fluidd'], { FLUIDD_PORT: '80' }, 'mainsail')).toBe(81)
  })
})

describe('steppedDownPort', () => {
  it('is the port the lowest-placed other UI holds, so that UI is promoted to 80', () => {
    const saved = { FLUIDD_PORT: '80', MAINSAIL_PORT: '81' }
    expect(steppedDownPort(PLUGINS, ['fluidd', 'mainsail'], saved, 'fluidd')).toBe(81)
  })

  it('is the lowest of several other UIs, never a higher free port', () => {
    const saved = { FLUIDD_PORT: '80', MAINSAIL_PORT: '82' }
    expect(steppedDownPort(PLUGINS, ['fluidd', 'mainsail'], saved, 'fluidd')).toBe(82)
  })

  it('is the next free port when the other UI still holds 80, so a form-only primary can step back', () => {
    const saved = { FLUIDD_PORT: '81', MAINSAIL_PORT: '80' }
    expect(steppedDownPort(PLUGINS, ['fluidd', 'mainsail'], saved, 'fluidd')).toBe(81)
  })

  it('is null for the only web UI, which cannot stand down without emptying port 80', () => {
    expect(steppedDownPort(PLUGINS, ['fluidd'], { FLUIDD_PORT: '80' }, 'fluidd')).toBeNull()
  })
})

describe('portClaimPlan', () => {
  it('moves the UI holding the claimed port, and says where it went', () => {
    const saved = { FLUIDD_PORT: '80', MAINSAIL_PORT: '81' }
    const plan = portClaimPlan(PLUGINS, ['fluidd', 'mainsail'], saved, 'mainsail', 80)

    expect(plan.displaced).toEqual([{ pluginId: 'fluidd', name: PLUGINS[0].title, port: 81 }])
    expect(plan.savedPatch).toEqual({ FLUIDD_PORT: '81' })
    expect(plan.reconfigure.map((entry) => entry.pluginId)).toEqual(['fluidd'])
  })

  it('carries the new port of the moved UI in the vars pushed to the printer', () => {
    const saved = { FLUIDD_PORT: '80', MAINSAIL_PORT: '81' }
    const plan = portClaimPlan(PLUGINS, ['fluidd', 'mainsail'], saved, 'mainsail', 80)

    expect(plan.reconfigure[0].vars.FLUIDD_PORT).toBe('81')
  })

  it('moves nobody when the claimed port is free', () => {
    const saved = { FLUIDD_PORT: '80' }
    const plan = portClaimPlan(PLUGINS, ['fluidd'], saved, 'mainsail', 81)

    expect(plan.displaced).toEqual([])
    expect(plan.savedPatch).toEqual({})
  })
})

describe('portSwapNote', () => {
  it('names the UI that will move and the port it will move to', () => {
    const saved = { FLUIDD_PORT: '80', MAINSAIL_PORT: '81' }
    expect(portSwapNote(PLUGINS, ['fluidd', 'mainsail'], saved, 'mainsail', 80)).toEqual({ name: PLUGINS[0].title, port: 81 })
  })

  it('says nothing when the port is free', () => {
    expect(portSwapNote(PLUGINS, ['fluidd'], { FLUIDD_PORT: '80' }, 'mainsail', 81)).toBeNull()
  })
})
