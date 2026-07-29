// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect } from 'vitest'
import { matchesPlugin, selectFacet, sortPlugins, toggleFacet } from './filters'
import type { MatchOpts, StatusFacet } from './filters'
import type { Plugin, PluginSource, ReleaseChannel } from '../../../data/types'

const BASE: MatchOpts = {
  query: '', channels: [], categories: [], trusts: [], statuses: [], printerOnly: false,
  installedIds: [], installedVersions: {},
}

function makeSource(channel: ReleaseChannel, version: string): PluginSource {
  return { registryUrl: `url-${channel}`, label: channel, version, channel, trust: 'project', local: false }
}

function makePlugin(overrides?: Partial<Plugin>): Plugin {
  return {
    id: 'test-id', name: 'test-name', title: 'Test Plugin', category: 'camera',
    tagline: 'A test tagline', description: 'Full description', version: '1.0.0',
    channel: 'stable', publisher: 'bespok3d-org', signer: null, trust: 'project', deps: [], conflicts: [],
    sources: [makeSource('stable', '1.0.0')],
    ...overrides,
  }
}

describe('matchesPlugin: query', () => {
  it('passes when query is empty', () => {
    expect(matchesPlugin(makePlugin(), BASE)).toBe(true)
  })

  it('matches on title (case-insensitive)', () => {
    expect(matchesPlugin(makePlugin({ title: 'Camera HW Accel' }), { ...BASE, query: 'camera' })).toBe(true)
  })

  it('matches on name and tagline but not description', () => {
    expect(matchesPlugin(makePlugin({ name: 'camera-hw-accel' }), { ...BASE, query: 'hw-accel' })).toBe(true)
    expect(matchesPlugin(makePlugin({ tagline: 'Zero-config Spoolman' }), { ...BASE, query: 'spoolman' })).toBe(true)
    expect(matchesPlugin(makePlugin({ description: 'secret keyword' }), { ...BASE, query: 'secret' })).toBe(false)
  })
})

describe('matchesPlugin: empty facet = no constraint', () => {
  it('an empty selection in every facet passes any plugin', () => {
    expect(matchesPlugin(makePlugin({ trust: 'any', category: 'tuning' }), BASE)).toBe(true)
    expect(matchesPlugin(makePlugin({ printerSpecific: true }), BASE)).toBe(true)
  })
})

describe('matchesPlugin: trust facet (OR within)', () => {
  it('includes a plugin whose trust is any selected tier', () => {
    expect(matchesPlugin(makePlugin({ trust: 'project' }), { ...BASE, trusts: ['project', 'community'] })).toBe(true)
    expect(matchesPlugin(makePlugin({ trust: 'community' }), { ...BASE, trusts: ['project', 'community'] })).toBe(true)
  })

  it('excludes a plugin whose trust is in no selected tier', () => {
    expect(matchesPlugin(makePlugin({ trust: 'manufacturer' }), { ...BASE, trusts: ['project', 'community'] })).toBe(false)
  })
})

describe('matchesPlugin: category facet (OR within)', () => {
  it('includes a plugin in any selected category, excludes otherwise', () => {
    expect(matchesPlugin(makePlugin({ category: 'camera' }), { ...BASE, categories: ['camera', 'sensors'] })).toBe(true)
    expect(matchesPlugin(makePlugin({ category: 'tuning' }), { ...BASE, categories: ['camera', 'sensors'] })).toBe(false)
  })
})

describe('matchesPlugin: channel facet surfaces above-ceiling plugins', () => {
  it('matches when a published channel intersects the selected set', () => {
    const experimentOnly = makePlugin({ sources: [makeSource('experiment', '2.0.0')] })
    expect(matchesPlugin(experimentOnly, { ...BASE, channels: ['experiment'] })).toBe(true)
    expect(matchesPlugin(experimentOnly, { ...BASE, channels: ['stable'] })).toBe(false)
  })

  it('matches when any one of several published channels is selected', () => {
    const dual = makePlugin({ sources: [makeSource('stable', '1.0.0'), makeSource('experiment', '2.0.0')] })
    expect(matchesPlugin(dual, { ...BASE, channels: ['experiment'] })).toBe(true)
  })
})

describe('matchesPlugin: printerOnly toggle', () => {
  it('keeps only printer-specific plugins when on', () => {
    expect(matchesPlugin(makePlugin({ printerSpecific: true }), { ...BASE, printerOnly: true })).toBe(true)
    expect(matchesPlugin(makePlugin({ printerSpecific: false }), { ...BASE, printerOnly: true })).toBe(false)
  })
})

describe('matchesPlugin: status facet', () => {
  it('installed / not-installed split on installedIds', () => {
    const plugin = makePlugin({ id: 'cam' })
    expect(matchesPlugin(plugin, { ...BASE, statuses: ['installed'], installedIds: ['cam'] })).toBe(true)
    expect(matchesPlugin(plugin, { ...BASE, statuses: ['installed'], installedIds: ['other'] })).toBe(false)
    expect(matchesPlugin(plugin, { ...BASE, statuses: ['not-installed'], installedIds: ['other'] })).toBe(true)
  })

  it('needs-updating requires an installed older version than the available one', () => {
    const plugin = makePlugin({ id: 'cam', sources: [makeSource('stable', '2.0.0')] })
    expect(matchesPlugin(plugin, { ...BASE, statuses: ['needs-updating'], installedIds: ['cam'], installedVersions: { cam: '1.0.0' } })).toBe(true)
    expect(matchesPlugin(plugin, { ...BASE, statuses: ['needs-updating'], installedIds: ['cam'], installedVersions: { cam: '2.0.0' } })).toBe(false)
  })

  it('needs-updating is channel-aware: a riskier newer build is not an update under a stable ceiling', () => {
    const plugin = makePlugin({ id: 'cam', sources: [makeSource('stable', '1.0.0'), makeSource('experiment', '3.0.0')] })
    const stableCeiling = { ...BASE, statuses: ['needs-updating' as const], installedIds: ['cam'], installedVersions: { cam: '1.0.0' }, ceilingFor: () => 'stable' as ReleaseChannel }
    expect(matchesPlugin(plugin, stableCeiling)).toBe(false)
    expect(matchesPlugin(plugin, { ...stableCeiling, ceilingFor: () => 'experiment' as ReleaseChannel })).toBe(true)
  })

  it('OR within the status facet (installed OR not-installed = everything)', () => {
    const plugin = makePlugin({ id: 'cam' })
    expect(matchesPlugin(plugin, { ...BASE, statuses: ['installed', 'not-installed'], installedIds: [] })).toBe(true)
  })
})

describe('matchesPlugin: AND across facets', () => {
  it('every active facet must pass', () => {
    const plugin = makePlugin({ id: 'cam', trust: 'project', category: 'camera', title: 'Camera' })
    expect(matchesPlugin(plugin, { ...BASE, query: 'cam', statuses: ['installed'], installedIds: ['cam'], trusts: ['project'], categories: ['camera'] })).toBe(true)
    expect(matchesPlugin(plugin, { ...BASE, query: 'cam', statuses: ['installed'], installedIds: ['cam'], trusts: ['community'] })).toBe(false)
    expect(matchesPlugin(plugin, { ...BASE, categories: ['sensors'], trusts: ['project'] })).toBe(false)
  })
})

describe('toggleFacet', () => {
  it('adds a value not present and removes one present', () => {
    expect(toggleFacet<ReleaseChannel>([], 'rc')).toEqual(['rc'])
    expect(toggleFacet<ReleaseChannel>(['rc', 'stable'], 'rc')).toEqual(['stable'])
  })
})

describe('selectFacet', () => {
  it('replaces any prior pick and clears when the active value is re-picked', () => {
    expect(selectFacet<StatusFacet>([], 'installed')).toEqual(['installed'])
    expect(selectFacet<StatusFacet>(['not-installed'], 'installed')).toEqual(['installed'])
    expect(selectFacet<StatusFacet>(['installed'], 'installed')).toEqual([])
  })
})

describe('sortPlugins', () => {
  const beta = makePlugin({ id: 'b', title: 'Beta', publishedAt: '2026-01-01', updatedAt: '2026-05-01' })
  const alpha = makePlugin({ id: 'a', title: 'Alpha', publishedAt: '2025-06-01', updatedAt: '2026-03-01' })
  const gamma = makePlugin({ id: 'g', title: 'Gamma', publishedAt: '2026-03-01', updatedAt: '2026-01-01' })
  const plugins = [beta, alpha, gamma]

  function titles(list: Plugin[]): string[] {
    return list.map((plugin) => plugin.title)
  }

  it('sorts by name ascending and descending', () => {
    expect(titles(sortPlugins(plugins, 'name', 'asc'))).toEqual(['Alpha', 'Beta', 'Gamma'])
    expect(titles(sortPlugins(plugins, 'name', 'desc'))).toEqual(['Gamma', 'Beta', 'Alpha'])
  })

  it('sorts by publishedAt ascending and updatedAt descending', () => {
    expect(titles(sortPlugins(plugins, 'published', 'asc'))).toEqual(['Alpha', 'Beta', 'Gamma'])
    expect(titles(sortPlugins(plugins, 'updated', 'desc'))).toEqual(['Beta', 'Alpha', 'Gamma'])
  })

  it('does not mutate the input array', () => {
    const original = [...plugins]
    sortPlugins(plugins, 'name', 'desc')
    expect(plugins).toEqual(original)
  })

  it('falls back to title order when dates are missing', () => {
    const noDates = [makePlugin({ title: 'Zed' }), makePlugin({ title: 'Ann' })]
    expect(titles(sortPlugins(noDates, 'published', 'asc'))).toEqual(['Ann', 'Zed'])
  })
})
