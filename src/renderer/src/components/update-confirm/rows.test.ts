// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect } from 'vitest'
import { updateConfirmRows, specsWithPickedSource } from './rows'
import { installedFromRecords } from '../../data/channels/updates'
import type { Plugin, PluginSource } from '../../data/types'

const LOCAL_BUNDLE = 'local:dev-bundle'
const PUBLISHED_LIST = 'https://lists.example/index.json'

function source(registryUrl: string, version: string): PluginSource {
  return { registryUrl, version, channel: 'stable', trust: 'community', local: registryUrl.startsWith('local:') } as unknown as PluginSource
}

function twoSourced(id: string, localVersion: string, publishedVersion: string): Plugin {
  return {
    id, name: id, version: publishedVersion, deps: [],
    sources: [source(LOCAL_BUNDLE, localVersion), source(PUBLISHED_LIST, publishedVersion)],
  } as unknown as Plugin
}

describe('updateConfirmRows', () => {
  it('reads back the version and the source the update will actually come from', () => {
    const spoolman = twoSourced('spoolman', '1.1.0', '2.0.0')
    const specs = [{ pluginId: 'spoolman', sourceUrl: LOCAL_BUNDLE, channel: 'stable' as const }]
    const rows = updateConfirmRows(specs, [spoolman], installedFromRecords({ spoolman: '1.0.0' }, { spoolman: LOCAL_BUNDLE }))
    expect(rows).toHaveLength(1)
    expect(rows[0].fromVersion).toBe('1.0.0')
    expect(rows[0].toVersion).toBe('1.1.0')
    expect(rows[0].source?.registryUrl).toBe(LOCAL_BUNDLE)
    expect(rows[0].movedSource).toBe(false)
  })

  it('says so when the update has to come from somewhere else than the installed copy did', () => {
    const spoolman = twoSourced('spoolman', '1.1.0', '2.0.0')
    const specs = [{ pluginId: 'spoolman', sourceUrl: PUBLISHED_LIST, channel: 'stable' as const }]
    const rows = updateConfirmRows(specs, [spoolman], installedFromRecords({ spoolman: '1.0.0' }, { spoolman: 'local:a-bundle-that-is-gone' }))
    expect(rows[0].movedSource).toBe(true)
    expect(rows[0].toVersion).toBe('2.0.0')
  })

  it('offers every other place the plugin is published as something to switch to', () => {
    const spoolman = twoSourced('spoolman', '1.1.0', '2.0.0')
    const specs = [{ pluginId: 'spoolman', sourceUrl: LOCAL_BUNDLE, channel: 'stable' as const }]
    const rows = updateConfirmRows(specs, [spoolman], installedFromRecords({ spoolman: '1.0.0' }, { spoolman: LOCAL_BUNDLE }))
    expect(rows[0].otherSources.map((entry) => entry.registryUrl)).toEqual([LOCAL_BUNDLE, PUBLISHED_LIST])
  })

  it('leaves out a spec whose plugin the catalog does not carry rather than inventing a line', () => {
    expect(updateConfirmRows([{ pluginId: 'ghost' }], [], installedFromRecords({ ghost: '1.0.0' }))).toEqual([])
  })
})

describe('specsWithPickedSource', () => {
  it('sends the picked plugin from the picked place and leaves the rest of the batch alone', () => {
    const specs = [
      { pluginId: 'spoolman', sourceUrl: LOCAL_BUNDLE, channel: 'stable' as const },
      { pluginId: 'cpu-temp', sourceUrl: LOCAL_BUNDLE, channel: 'stable' as const },
    ]
    const picked = specsWithPickedSource(specs, 'spoolman', source(PUBLISHED_LIST, '2.0.0'))
    expect(picked[0]).toEqual({ pluginId: 'spoolman', sourceUrl: PUBLISHED_LIST, channel: 'stable' })
    expect(picked[1]).toEqual(specs[1])
  })
})
