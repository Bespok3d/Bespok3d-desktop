// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect } from 'vitest'
import type { Plugin } from '../types'
import { uiPorts, suggestedPort, reflowForPrimary, isUiPlugin } from './index'

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

describe('reflowForPrimary', () => {
  it('reports the displaced UI with its config key and new port', () => {
    const saved = { FLUIDD_PORT: '80', MAINSAIL_PORT: '81' }
    expect(reflowForPrimary(PLUGINS, ['fluidd', 'mainsail'], saved, 'mainsail')).toEqual([
      { pluginId: 'fluidd', portKey: 'FLUIDD_PORT', port: 81 },
    ])
  })

  it('reassigns nothing when the target already holds 80', () => {
    const saved = { FLUIDD_PORT: '80', MAINSAIL_PORT: '81' }
    expect(reflowForPrimary(PLUGINS, ['fluidd', 'mainsail'], saved, 'fluidd')).toEqual([])
  })
})
