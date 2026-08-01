// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect } from 'vitest'
import { updatablePlugins, pluginInstallVars, buildUpdateSpecs } from './update-all'
import { printerVarsView } from '../../data/plugin-vars'
import type { Plugin, PluginSource } from '../../data/types'
import { installedFromRecords } from '../../data/channels/updates'

function plugin(over: Partial<Plugin>): Plugin {
  return { id: 'plugin', version: '1.0.0', deps: [], ...over } as unknown as Plugin
}

const LOCAL_BUNDLE = 'local:dev-bundle'
const PUBLISHED_LIST = 'https://lists.example/index.json'

function source(registryUrl: string, version: string): PluginSource {
  return { registryUrl, version, channel: 'stable', trust: 'community' } as unknown as PluginSource
}

// A plugin the same id offers twice: the developer's locally packed build and the published one.
function twoSourced(id: string, localVersion: string, publishedVersion: string): Plugin {
  return plugin({ id, version: publishedVersion, sources: [source(LOCAL_BUNDLE, localVersion), source(PUBLISHED_LIST, publishedVersion)] } as Partial<Plugin>)
}

function onPrinter(versions: Record<string, string>, sources?: Record<string, string>) {
  return installedFromRecords(versions, sources)
}

describe('updatablePlugins', () => {
  it('lists only installed plugins whose catalog version is strictly newer', () => {
    const plugins = [plugin({ id: 'spoolman', version: '2.0.0' }), plugin({ id: 'cpu-temp', version: '1.0.0' })]
    const updatable = updatablePlugins(plugins, onPrinter({ spoolman: '1.0.0', 'cpu-temp': '1.0.0' }))
    expect(updatable.map((entry) => entry.id)).toEqual(['spoolman'])
  })

  it('does NOT flag an installed version ahead of the catalog (no downgrade-as-update)', () => {
    const plugins = [plugin({ id: 'camera-hw-accel', version: '0.1.0' })]
    expect(updatablePlugins(plugins, onPrinter({ 'camera-hw-accel': '0.1.2' }))).toEqual([])
  })

  it('ignores plugins that are not installed', () => {
    expect(updatablePlugins([plugin({ id: 'spoolman', version: '2.0.0' })], onPrinter({}))).toEqual([])
  })
})

// The confusing install: two plugins were running from the dev bundle, both were offered an update,
// and both were replaced by the published build. An update is a newer build from the SAME place.
describe('updatablePlugins reads the source the installed copy came from', () => {
  it('offers the local build to a locally installed copy, and never the published one', () => {
    const spoolman = twoSourced('spoolman', '1.1.0', '2.0.0')
    const updatable = updatablePlugins([spoolman], onPrinter({ spoolman: '1.0.0' }, { spoolman: LOCAL_BUNDLE }))
    expect(updatable.map((entry) => entry.id)).toEqual(['spoolman'])
    const specs = buildUpdateSpecs([spoolman], ['spoolman'], onPrinter({ spoolman: '1.0.0' }, { spoolman: LOCAL_BUNDLE }), {})
    expect(specs).toEqual([{ pluginId: 'spoolman', vars: {}, depIds: [], sourceUrl: LOCAL_BUNDLE, channel: 'stable' }])
  })

  it('offers no update when the local source has nothing newer, whatever the published one carries', () => {
    const spoolman = twoSourced('spoolman', '1.0.0', '2.0.0')
    expect(updatablePlugins([spoolman], onPrinter({ spoolman: '1.0.0' }, { spoolman: LOCAL_BUNDLE }))).toEqual([])
  })

  it('offers the published build to a published copy', () => {
    const spoolman = twoSourced('spoolman', '9.0.0', '2.0.0')
    const specs = buildUpdateSpecs([spoolman], ['spoolman'], onPrinter({ spoolman: '1.0.0' }, { spoolman: PUBLISHED_LIST }), {})
    expect(specs).toEqual([{ pluginId: 'spoolman', vars: {}, depIds: [], sourceUrl: PUBLISHED_LIST, channel: 'stable' }])
  })

  it('falls back to the catalog winner when the recorded source is gone from the catalog', () => {
    const spoolman = twoSourced('spoolman', '1.1.0', '2.0.0')
    const specs = buildUpdateSpecs([spoolman], ['spoolman'], onPrinter({ spoolman: '1.0.0' }, { spoolman: 'local:a-bundle-that-is-gone' }), {})
    expect(specs).toEqual([{ pluginId: 'spoolman', vars: {}, depIds: [], sourceUrl: PUBLISHED_LIST, channel: 'stable' }])
  })

  it('keeps the plain catalog pick for a copy whose source was never recorded', () => {
    const spoolman = twoSourced('spoolman', '1.1.0', '2.0.0')
    expect(updatablePlugins([spoolman], onPrinter({ spoolman: '1.0.0' })).map((entry) => entry.id)).toEqual(['spoolman'])
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
    const specs = buildUpdateSpecs(plugins, [], onPrinter({ leaf: '1.0.0' }), {})
    expect(specs).toEqual([{ pluginId: 'leaf', vars: { OPT: 'd' }, depIds: ['core'] }])
  })

  it('omits an already-installed dependency from the spec', () => {
    const plugins = [
      plugin({ id: 'leaf', version: '2.0.0', deps: ['core'] }),
      plugin({ id: 'core', version: '1.0.0' }),
    ]
    const specs = buildUpdateSpecs(plugins, ['core'], onPrinter({ leaf: '1.0.0' }), {})
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
    const specsForA = buildUpdateSpecs([spoolman], ['spoolman'], onPrinter({ spoolman: '1.0.0' }), printerVarsView(scopedVars, 'uuid-a'))
    expect(specsForA).toEqual([{ pluginId: 'spoolman', vars: { SPOOLMAN_LOCATION: 'OG U1' }, depIds: [] }])
    expect(printerVarsView(scopedVars, 'uuid-b')).toEqual({ SPOOLMAN_LOCATION: 'U1 Junior' })
  })
})
