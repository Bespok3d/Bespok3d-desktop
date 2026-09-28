// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { resolveCatalog } from './index'
import { RegistryFetchError, DEFAULT_LIMITS } from '../model'
import type { FetchedRegistry, IndexEntry, RegistryIndex, RegistryRef } from '../model'

const LIVE_URL = 'github:Bespok3d/main-index/index.json'
const DEV_URL = 'github:Bespok3d/main-index/index.json?ref=dev'

function sourceRef(url: string): RegistryRef {
  return { url, trust: 'project', locked: true }
}

function catalogIndex(name: string, entries: IndexEntry[]): RegistryIndex {
  return { schema_version: 1, name, publisher: 'fixture-publisher', updated: '2026-09-27', plugins: entries, lists: [] }
}

function pluginEntry(pluginId: string, sourceUrl: string): IndexEntry {
  return { name: pluginId, version: '1.2.0', download_url: `${sourceUrl}.b3` }
}

function fetched(ref: RegistryRef, pluginId: string, fromCache: boolean, projectSigned: boolean): FetchedRegistry {
  const signature = projectSigned
    ? { proof: 'signed' as const, fingerprint: 'fixture-project-key', signer: 'Bespok3d', tier: 'project' as const }
    : { proof: 'unsigned' as const }

  return { ref, index: catalogIndex(ref.url, [pluginEntry(pluginId, ref.url)]), fromCache, signature }
}

function samePluginFetcher(ref: RegistryRef): Promise<FetchedRegistry> {
  return Promise.resolve(fetched(ref, 'same-plugin', false, ref.url === LIVE_URL))
}

function errorMessage(result: Awaited<ReturnType<typeof resolveCatalog>>, url: string): string | undefined {
  return result.failures.find((failure) => failure.url === url)?.message
}

async function liveCatalogWithMissingTier(tierUrl: string, liveFromCache: boolean) {
  async function fetcher(ref: RegistryRef): Promise<FetchedRegistry> {
    if (ref.url === tierUrl) throw new RegistryFetchError('notfound', `HTTP 404: ${ref.url}`)

    return { ...fetched(ref, 'live-plugin', true, true), fromCache: liveFromCache }
  }

  return resolveCatalog([sourceRef(LIVE_URL), sourceRef(tierUrl)], fetcher, DEFAULT_LIMITS, () => {})
}

describe('official branch roots fail independently', () => {
  it.each([[DEV_URL, false], [DEV_URL, true]])(
    'keeps Live when dev index %s is 404 with live-cache=%s',
    async (tierUrl, liveFromCache) => {
    const result = await liveCatalogWithMissingTier(tierUrl, liveFromCache)

    expect(result.plugins.map((plugin) => plugin.name)).toEqual(['live-plugin'])
    expect(errorMessage(result, tierUrl)).toContain('HTTP 404')
  })

  it('keeps the Live error visible when a cached dev source answers', async () => {
    async function fetcher(ref: RegistryRef): Promise<FetchedRegistry> {
      if (ref.url === LIVE_URL) throw new RegistryFetchError('notfound', `HTTP 404: ${ref.url}`)

      return fetched(ref, 'dev-plugin', true, false)
    }
    const result = await resolveCatalog([sourceRef(LIVE_URL), sourceRef(DEV_URL)], fetcher, DEFAULT_LIMITS, () => {})

    expect(result.plugins.map((plugin) => plugin.name)).toEqual(['dev-plugin'])
    expect(errorMessage(result, LIVE_URL)).toContain('HTTP 404')
    expect(result.registries[0]).toMatchObject({ url: DEV_URL, trust: 'unknown' })
  })
})

describe('branch alternatives preserve source-bound trust and package URLs', () => {
  it('retains equal-version alternatives and selects the requested source with its own evidence', async () => {
    const result = await resolveCatalog(
      [sourceRef(LIVE_URL), sourceRef(DEV_URL)],
      samePluginFetcher,
      DEFAULT_LIMITS,
      () => {},
    )
    const variants = result.plugins[0].variants ?? []
    const live = variants.find((variant) => variant.registry_url === LIVE_URL)
    const tier = variants.find((variant) => variant.registry_url === DEV_URL)

    expect(result.plugins[0].variants).toHaveLength(2)
    expect(live).toMatchObject({ registry_url: LIVE_URL, trust: 'project', download_url: `${LIVE_URL}.b3` })
    expect(tier).toMatchObject({ registry_url: DEV_URL, trust: 'unknown', download_url: `${DEV_URL}.b3` })
  })
})
