// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect } from 'vitest'
import { updatablePlugins, pluginInstallVars, buildUpdateSpecs } from './update-all'
import { printerVarsView } from '../../data/plugin-vars'
import type { Plugin } from '../../data/types'

function plugin(over: Partial<Plugin>): Plugin {
  return { id: 'plugin', version: '1.0.0', deps: [], ...over } as unknown as Plugin
}

describe('updatablePlugins', () => {
  it('lists only installed plugins whose catalog version is strictly newer', () => {
    const plugins = [plugin({ id: 'spoolman', version: '2.0.0' }), plugin({ id: 'cpu-temp', version: '1.0.0' })]
    const updatable = updatablePlugins(plugins, { spoolman: '1.0.0', 'cpu-temp': '1.0.0' })
    expect(updatable.map((entry) => entry.id)).toEqual(['spoolman'])
  })

  it('does NOT flag an installed version ahead of the catalog (no downgrade-as-update)', () => {
    const plugins = [plugin({ id: 'camera-hw-accel', version: '0.1.0' })]
    expect(updatablePlugins(plugins, { 'camera-hw-accel': '0.1.2' })).toEqual([])
  })

  it('ignores plugins that are not installed', () => {
    expect(updatablePlugins([plugin({ id: 'spoolman', version: '2.0.0' })], {})).toEqual([])
  })
})

describe('pluginInstallVars', () => {
  it('prefers the saved value over the default and drops blanks', () => {
    const spoolman = plugin({
      config: [
        { key: 'SPOOLMAN_SERVER', label: 'Server', type: 'text', default: 'localhost' },
        { key: 'MODE', label: 'Mode', type: 'text', default: '' },
      ],
    } as Partial<Plugin>)
    expect(pluginInstallVars(spoolman, { SPOOLMAN_SERVER: 'printer.local' })).toEqual({ SPOOLMAN_SERVER: 'printer.local' })
  })

  it('returns nothing for a plugin with no config', () => {
    expect(pluginInstallVars(plugin({}), {})).toEqual({})
  })
})

describe('buildUpdateSpecs', () => {
  it('emits one spec per updatable plugin with its vars and missing deps', () => {
    const plugins = [
      plugin({ id: 'leaf', version: '2.0.0', deps: ['core'], config: [{ key: 'OPT', label: 'Opt', type: 'text', default: 'd' }] } as Partial<Plugin>),
      plugin({ id: 'core', version: '1.0.0' }),
    ]
    const specs = buildUpdateSpecs(plugins, [], { leaf: '1.0.0' }, {})
    expect(specs).toEqual([{ pluginId: 'leaf', vars: { OPT: 'd' }, depIds: ['core'] }])
  })

  it('omits an already-installed dependency from the spec', () => {
    const plugins = [
      plugin({ id: 'leaf', version: '2.0.0', deps: ['core'] }),
      plugin({ id: 'core', version: '1.0.0' }),
    ]
    const specs = buildUpdateSpecs(plugins, ['core'], { leaf: '1.0.0' }, {})
    expect(specs).toEqual([{ pluginId: 'leaf', vars: {}, depIds: [] }])
  })

  // THE clobber regression: printer A's Update All must send A's resolved values, so printer B's
  // own value for the same field neither rides along to A nor gets overwritten anywhere.
  it('resolves per printer: update-all for A sends A\'s value and never B\'s', () => {
    const spoolman = plugin({
      id: 'spoolman', version: '2.0.0',
      config: [{ key: 'SPOOLMAN_LOCATION', label: 'Location', type: 'text', scope: 'printer' }],
    } as Partial<Plugin>)
    const scopedVars = {
      SPOOLMAN_LOCATION: { 'local:uuid-a': 'OG U1', 'local:uuid-b': 'U1 Junior' },
    }
    const specsForA = buildUpdateSpecs([spoolman], ['spoolman'], { spoolman: '1.0.0' }, printerVarsView(scopedVars, 'uuid-a'))
    expect(specsForA).toEqual([{ pluginId: 'spoolman', vars: { SPOOLMAN_LOCATION: 'OG U1' }, depIds: [] }])
    expect(printerVarsView(scopedVars, 'uuid-b')).toEqual({ SPOOLMAN_LOCATION: 'U1 Junior' })
  })
})
