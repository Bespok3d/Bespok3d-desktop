// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect } from 'vitest'
import { pluginUpdateCount, updateTargetVersion, updateVariant, installedFromRecords } from './updates'
import { makePlugin, makeSource } from '../../test/fixtures'
import { indexToPlugins } from '../catalog/shape'
import type { IndexEntry, Printer, ReleaseChannel } from '../types'
import { officialListUrl } from '../../../../main/channel'
import type { BuildFlavor } from '../../../../main/channel'
import channelTable from '../../../../../scripts/channel-table.json'
import { PLUGIN_MANIFESTS, NO_PLUGIN_SOURCES } from '../../test/plugin-sources'
// @ts-expect-error - build-time generator, plain JS with no type declarations
import { buildIndex } from '../../../../../scripts/app-bundle.mjs'

const PLUGINS = indexToPlugins(
  (buildIndex(PLUGIN_MANIFESTS).plugins as IndexEntry[]).map((entry) => ({
    ...entry,
    trust: 'project' as const,
    registry_url: 'bundled',
  })),
  [],
)
const known = PLUGINS[0]

function makePrinter(installedVersions: Record<string, string>): Printer {
  return {
    id: 'p1',
    nick: 'Test',
    model: 'U1',
    adapter: 'snapmaker-u1',
    host: 'test.local',
    ip: '192.0.2.1',
    status: 'managed',
    installedIds: Object.keys(installedVersions),
    installedVersions,
    holdsDaemonAccess: false,
  }
}

describe.skipIf(NO_PLUGIN_SOURCES)('pluginUpdateCount', () => {
  it('counts a plugin whose installed version differs from the catalog', () => {
    expect(pluginUpdateCount(makePrinter({ [known.id]: `old-${known.version}` }), PLUGINS)).toBe(1)
  })

  it('does not count a plugin already at the catalog version', () => {
    expect(pluginUpdateCount(makePrinter({ [known.id]: known.version }), PLUGINS)).toBe(0)
  })

  it('ignores empty version strings and unknown plugin ids', () => {
    expect(pluginUpdateCount(makePrinter({ [known.id]: '', 'not-a-plugin': '9.9.9' }), PLUGINS)).toBe(0)
  })

  it('returns 0 when installedVersions is absent', () => {
    const printer = makePrinter({})
    delete (printer as { installedVersions?: Record<string, string> }).installedVersions
    expect(pluginUpdateCount(printer, PLUGINS)).toBe(0)
  })
})

function publishedDemo(version: string, fingerprint?: string) {
  return makePlugin({ version, sources: [makeSource({ version, fingerprint })] })
}

function demoOnPrinter(version: string, fingerprint?: string) {
  return installedFromRecords({ demo: version }, undefined, undefined, undefined, fingerprint ? { demo: fingerprint } : undefined)
}

describe('updateTargetVersion on a same-version rebuild', () => {
  it('offers the published build when the versions match and both fingerprints differ', () => {
    expect(updateTargetVersion(publishedDemo('1.0.0', 'rebuilt-fp'), demoOnPrinter('1.0.0', 'installed-fp'))).toBe('1.0.0')
  })

  it('offers nothing when the versions and the fingerprints match', () => {
    expect(updateTargetVersion(publishedDemo('1.0.0', 'same-fp'), demoOnPrinter('1.0.0', 'same-fp'))).toBeUndefined()
  })

  it('compares versions only when either fingerprint is missing', () => {
    expect(updateTargetVersion(publishedDemo('1.0.0', 'rebuilt-fp'), demoOnPrinter('1.0.0'))).toBeUndefined()
    expect(updateTargetVersion(publishedDemo('1.0.0'), demoOnPrinter('1.0.0', 'installed-fp'))).toBeUndefined()
    expect(updateTargetVersion(publishedDemo('1.1.0', 'rebuilt-fp'), demoOnPrinter('1.0.0'))).toBe('1.1.0')
  })

  it('offers nothing when the fingerprints match, whatever the versions say', () => {
    expect(updateTargetVersion(publishedDemo('1.1.0', 'same-fp'), demoOnPrinter('1.0.0', 'same-fp'))).toBeUndefined()
  })

  it('offers the published build when the fingerprints differ, whatever the versions say', () => {
    expect(updateTargetVersion(publishedDemo('1.0.0', 'rebuilt-fp'), demoOnPrinter('1.1.0', 'installed-fp'))).toBe('1.0.0')
  })
})

const LIVE_URL = 'github:Bespok3d/main-index/index.json'
const DEV_URL = `${LIVE_URL}?ref=dev`
const PRERELEASE_LIST = 'Bespok3d Official prerelease'

function liveSource(version: string, fingerprint?: string) {
  return makeSource({ version, fingerprint })
}

function devSource(version: string, fingerprint?: string) {
  return makeSource({ registryUrl: DEV_URL, label: PRERELEASE_LIST, version, fingerprint, channel: 'testing' })
}

function demoOnLists(...sources: ReturnType<typeof makeSource>[]) {
  return makePlugin({ sources })
}

function demoInstalledFrom(installedSource: string, version: string, fingerprint: string, ceiling: ReleaseChannel = 'experiment', disabledChannels: ReleaseChannel[] = []) {
  return installedFromRecords({ demo: version }, { demo: installedSource }, () => ceiling, disabledChannels, { demo: fingerprint })
}

describe('an update offered by another list that is on', () => {
  it('offers the newer prerelease from the dev list to a copy installed from the live list', () => {
    const plugin = demoOnLists(liveSource('0.1.9', 'live-fp'), devSource('0.2.0-pre', 'dev-fp'))
    const variant = updateVariant(plugin, demoInstalledFrom(LIVE_URL, '0.1.9', 'live-fp'))

    expect(updateTargetVersion(plugin, demoInstalledFrom(LIVE_URL, '0.1.9', 'live-fp'))).toBe('0.2.0-pre')
    expect(variant).toMatchObject({ registryUrl: DEV_URL, label: PRERELEASE_LIST })
  })

  it('offers nothing when the dev list only holds the prerelease of the version already installed from live', () => {
    const plugin = demoOnLists(liveSource('0.1.9', 'live-fp'), devSource('0.1.9-pre', 'dev-fp'))

    expect(updateTargetVersion(plugin, demoInstalledFrom(LIVE_URL, '0.1.9', 'live-fp'))).toBeUndefined()
  })

  it('never offers a build held on this machine to a published copy', () => {
    const plugin = demoOnLists(liveSource('0.1.9', 'live-fp'), makeSource({ registryUrl: '/local/index.json', version: '0.3.0', local: true }))

    expect(updateTargetVersion(plugin, demoInstalledFrom(LIVE_URL, '0.1.9', 'live-fp'))).toBeUndefined()
  })

  it('never offers a build held on this machine to a published copy whose list dropped the plugin', () => {
    const plugin = demoOnLists(devSource('0.1.9-pre', 'dev-fp'), makeSource({ registryUrl: '/local/index.json', version: '0.3.0', local: true }))

    expect(updateVariant(plugin, demoInstalledFrom(LIVE_URL, '0.1.9', 'live-fp'))).toBeUndefined()
  })
})

describe('back to the live copy once the prerelease is released', () => {
  it('offers the switch once, from the live list, and not again after switching', () => {
    const plugin = demoOnLists(liveSource('0.1.9', 'live-fp'), devSource('0.1.9-pre', 'dev-fp'))
    const fromDev = demoInstalledFrom(DEV_URL, '0.1.9-pre', 'dev-fp')

    expect(updateTargetVersion(plugin, fromDev)).toBe('0.1.9')
    expect(updateVariant(plugin, fromDev)).toMatchObject({ registryUrl: LIVE_URL })
    expect(updateTargetVersion(plugin, demoInstalledFrom(LIVE_URL, '0.1.9', 'live-fp'))).toBeUndefined()
  })

  it('offers nothing while the live list has not released that version yet', () => {
    const plugin = demoOnLists(liveSource('0.1.8', 'live-fp'), devSource('0.1.9-pre', 'dev-fp'))

    expect(updateTargetVersion(plugin, demoInstalledFrom(DEV_URL, '0.1.9-pre', 'dev-fp'))).toBeUndefined()
  })
})

describe('the ceiling and switched-off channels still block an offer from another list', () => {
  const plugin = demoOnLists(liveSource('0.1.9', 'live-fp'), devSource('0.2.0-pre', 'dev-fp'))

  it('offers nothing from a list whose channel is above the ceiling', () => {
    expect(updateTargetVersion(plugin, demoInstalledFrom(LIVE_URL, '0.1.9', 'live-fp', 'stable'))).toBeUndefined()
  })

  it('offers nothing from a list whose channel is switched off', () => {
    expect(updateTargetVersion(plugin, demoInstalledFrom(LIVE_URL, '0.1.9', 'live-fp', 'experiment', ['testing']))).toBeUndefined()
  })

  it('offers no release of an unrecorded prerelease when no allowed channel carries it', () => {
    const released = makePlugin({ version: '0.1.9', sources: [liveSource('0.1.9', 'live-fp')] })
    const unrecorded = installedFromRecords({ demo: '0.1.9-pre' }, undefined, () => 'experiment', ['stable'], { demo: 'dev-fp' })

    expect(updateTargetVersion(released, unrecorded)).toBeUndefined()
  })

  it('offers no switch back to a live release whose channel is switched off', () => {
    const released = demoOnLists(liveSource('0.1.9', 'live-fp'), devSource('0.1.9-pre', 'dev-fp'))

    expect(updateTargetVersion(released, demoInstalledFrom(DEV_URL, '0.1.9-pre', 'dev-fp', 'experiment', ['stable']))).toBeUndefined()
  })
})

// The lists each app flavour reads, as the app builds them from the channel table: the live app reads
// only the main branch, so the dev list never reaches it and nothing can be offered from it.
function listsOfFlavour(flavour: BuildFlavor, plugin: ReturnType<typeof makePlugin>) {
  const listUrls = channelTable[flavour].indexBranches.map((branch) => officialListUrl(channelTable[flavour], branch))

  return { ...plugin, sources: plugin.sources.filter((source) => listUrls.includes(source.registryUrl)) }
}

describe('the live app never offers anything from the dev list', () => {
  const published = demoOnLists(liveSource('0.1.9', 'live-fp'), devSource('0.2.0-pre', 'dev-fp'))
  const installed = demoInstalledFrom(LIVE_URL, '0.1.9', 'live-fp')

  it('offers nothing to the live app', () => {
    expect(updateTargetVersion(listsOfFlavour('live', published), installed)).toBeUndefined()
  })

  it('offers the dev prerelease to the staging app', () => {
    expect(updateTargetVersion(listsOfFlavour('staging', published), installed)).toBe('0.2.0-pre')
  })
})
