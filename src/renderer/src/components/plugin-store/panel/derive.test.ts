// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// Which settings the panel shows depends on WHICH version the user picked. A published list states one
// set of settings for the whole plugin; a package on this machine states its own in its own manifest,
// and an experimental build that carries extra settings is unusable unless those are the ones offered.
import { describe, it, expect } from 'vitest'
import { makePlugin, makeSource } from '../../../test/fixtures'
import type { PluginConfigField } from '../../../data/types'
import { daemonFloorVerdict, pluginAsPickedVersion } from './derive'

const LISTED_FIELD: PluginConfigField = { key: 'port', label: 'Port', type: 'number', scope: 'printer' }
const EXPERIMENTAL_FIELD: PluginConfigField = { key: 'exposure', label: 'Exposure', type: 'text', scope: 'printer' }

describe('the settings the picked version offers', () => {
  it('shows the settings a package on this machine declares, not the ones the list published', () => {
    const plugin = makePlugin({ config: [LISTED_FIELD] })
    const dropped = makeSource({ registryUrl: '/Users/dev/local/index.json', local: true, config: [LISTED_FIELD, EXPERIMENTAL_FIELD] })

    expect(pluginAsPickedVersion(plugin, dropped).config).toEqual([LISTED_FIELD, EXPERIMENTAL_FIELD])
  })

  it('keeps the published settings when the picked version came from a list', () => {
    const plugin = makePlugin({ config: [LISTED_FIELD] })
    const published = makeSource({ config: [EXPERIMENTAL_FIELD] })

    expect(pluginAsPickedVersion(plugin, published).config).toEqual([LISTED_FIELD])
  })

  it('keeps the published settings when a local package declares none of its own', () => {
    const plugin = makePlugin({ config: [LISTED_FIELD] })
    const dropped = makeSource({ registryUrl: '/Users/dev/local/index.json', local: true })

    expect(pluginAsPickedVersion(plugin, dropped).config).toEqual([LISTED_FIELD])
  })

  it('leaves the plugin alone when no version is picked yet', () => {
    const plugin = makePlugin({ config: [LISTED_FIELD] })

    expect(pluginAsPickedVersion(plugin, undefined)).toBe(plugin)
  })
})

// The card and the install path must give the same answer: a card that offers a package the install
// then refuses is worse than either answer on its own.
describe('the compatibility verdict the card shows', () => {
  it('blocks with both versions when the printer reports a daemon below the floor', () => {
    const plugin = { ...makePlugin({ id: 'spoolman' }), minDaemonVersion: '0.12.22' }

    expect(daemonFloorVerdict(plugin, '0.12.19')).toEqual({ floorUnmet: { required: '0.12.22', running: '0.12.19' }, versionUnknown: false })
  })

  it('lets a printer at the floor through', () => {
    const plugin = { ...makePlugin({ id: 'spoolman' }), minDaemonVersion: '0.12.22' }

    expect(daemonFloorVerdict(plugin, '0.12.22')).toEqual({ floorUnmet: null, versionUnknown: false })
  })

  it('warns rather than blocks when the printer never said what it runs', () => {
    const plugin = { ...makePlugin({ id: 'spoolman' }), minDaemonVersion: '0.12.22' }

    expect(daemonFloorVerdict(plugin, undefined)).toEqual({ floorUnmet: null, versionUnknown: true })
    expect(daemonFloorVerdict(plugin, '0.0.0')).toEqual({ floorUnmet: null, versionUnknown: true })
  })

  it('asks nothing of a plugin that declares no floor', () => {
    expect(daemonFloorVerdict(makePlugin({ id: 'idle-timeout' }), undefined)).toEqual({ floorUnmet: null, versionUnknown: false })
  })
})
