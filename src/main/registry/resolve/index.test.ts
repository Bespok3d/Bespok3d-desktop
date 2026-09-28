// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect } from 'vitest'
import { resolveCatalog } from './index'
import { RegistryFetchError, DEFAULT_LIMITS } from '../model'
import type { RegistryRef, RegistryIndex, IndexEntry, FetchedRegistry, MergedEntry, SignatureCheck } from '../model'
import { missingDependencyIds } from '../../store/missing-deps'

function entry(name: string, version = '1.0.0'): { name: string; version: string } {
  return { name, version }
}

function index(name: string, plugins: IndexEntry[], lists: string[] = []): RegistryIndex {
  return {
    schema_version: 1,
    name,
    publisher: 'PLACEHOLDER',
    updated: '2026-05-31',
    plugins,
    lists: lists.map((url) => ({ name: url, url })),
  }
}

function root(url: string): RegistryRef {
  return { url, trust: 'project', locked: true }
}

function fetcherFrom(catalogs: Record<string, RegistryIndex>) {
  return async (ref: RegistryRef): Promise<FetchedRegistry | null> => {
    const found = catalogs[ref.url]
    if (!found) throw new Error('not found')

    return { ref, index: found, fromCache: false, signature: { proof: 'unsigned' } }
  }
}

function fetcherFromSigned(catalogs: Record<string, RegistryIndex>, fingerprint: string) {
  return async (ref: RegistryRef): Promise<FetchedRegistry | null> => {
    const found = catalogs[ref.url]
    if (!found) throw new Error('not found')

    return { ref, index: found, fromCache: false, signature: { proof: 'signed', fingerprint, signer: 'Bespok3d', tier: 'project' } }
  }
}

// A list served WITH a signature that did not check out against the pinned key, which is a different
// situation from a list nobody signed and is the one an owner should look into.
function fetcherWithABadSignature(catalogs: Record<string, RegistryIndex>) {
  return async (ref: RegistryRef): Promise<FetchedRegistry | null> => {
    const found = catalogs[ref.url]
    if (!found) throw new Error('not found')

    return { ref, index: found, fromCache: false, signature: { proof: 'failed' } }
  }
}

// The ordinary state of a catalog: one list that proves who served it beside one that shipped with no
// signature at all. Naming the proved urls per test keeps a trust assertion about the tier under test
// rather than about which fetcher stub it happened to use.
function fetcherProving(catalogs: Record<string, RegistryIndex>, provedUrls: string[]) {
  return async (ref: RegistryRef): Promise<FetchedRegistry | null> => {
    const found = catalogs[ref.url]
    if (!found) throw new Error('not found')

    const signature: SignatureCheck = provedUrls.includes(ref.url)
      ? { proof: 'signed', fingerprint: 'org-gpg-key', signer: 'Bespok3d', tier: 'project' }
      : { proof: 'unsigned' }

    return { ref, index: found, fromCache: false, signature }
  }
}

function noop(): void {}

function pluginNames(result: { plugins: MergedEntry[] }): string[] {
  return result.plugins.map((plugin) => plugin.name).sort()
}

async function sideloadedRfidDependencies(): Promise<string[]> {
  const published = index('Published', [
    { name: 'rfid-creality', version: '0.1.0', deps: ['rfid-ntag'] },
    { name: 'rfid-ntag', version: '0.1.15', deps: ['u1-base-fm175xx-reader'], provides: ['rfid-service'] },
    { name: 'u1-base-fm175xx-reader', version: '0.1.0', deps: [] },
  ])
  const sideloaded = index('Sideloaded', [{ name: 'rfid-creality', version: '0.2.3', deps: ['rfid-service'] }])
  const catalogs = { published, sideloaded }
  const result = await resolveCatalog([root('published'), { url: 'sideloaded', trust: 'any', locked: false }], fetcherFromSigned(catalogs, 'org-gpg-key'), DEFAULT_LIMITS, noop)

  return missingDependencyIds(result.plugins, 'rfid-creality', [], [], { sourceUrl: 'sideloaded' })
}

it('resolves a sideloaded variant service through a provider in another source', async () => {
  expect(await sideloadedRfidDependencies()).toEqual(['u1-base-fm175xx-reader', 'rfid-ntag'])
})

describe('resolveCatalog list-of-lists', () => {
  it('merges entries from a root and its child lists', async () => {
    const catalogs = { root: index('Root', [entry('one')], ['child']), child: index('Child', [entry('two')]) }
    const result = await resolveCatalog([root('root')], fetcherFrom(catalogs), DEFAULT_LIMITS, noop)
    expect(pluginNames(result)).toEqual(['one', 'two'])
    expect(result.registries).toHaveLength(2)
  })

  it('keeps the configured root identity on a plugin served by a nested list', async () => {
    const catalogs = {
      official: index('Bespok3d Official', [], ['child']),
      child: index('Child', [], ['grandchild']),
      grandchild: index('Grandchild', [entry('nested-plugin')]),
    }
    const result = await resolveCatalog([{ ...root('official'), sourceName: 'Bespok3d Official' }], fetcherFrom(catalogs), DEFAULT_LIMITS, noop)

    expect(result.plugins[0]).toMatchObject({ registry_url: 'grandchild', source_url: 'official', source_name: 'Bespok3d Official' })
  })

  it('breaks a cycle by fetching each registry at most once', async () => {
    const catalogs = { root: index('Root', [entry('one')], ['child']), child: index('Child', [entry('two')], ['root']) }
    const result = await resolveCatalog([root('root')], fetcherFrom(catalogs), DEFAULT_LIMITS, noop)
    expect(result.registries).toHaveLength(2)
    expect(pluginNames(result)).toEqual(['one', 'two'])
  })

  it('isolates a failing sub-list and still renders the rest', async () => {
    const catalogs = { root: index('Root', [entry('one')], ['missing']) }
    const result = await resolveCatalog([root('root')], fetcherFrom(catalogs), DEFAULT_LIMITS, noop)
    expect(result.plugins.map((plugin) => plugin.name)).toEqual(['one'])
    expect(result.drops.some((drop) => drop.includes('missing'))).toBe(true)
  })

  it('records the classified reason when a fetcher throws a RegistryFetchError', async () => {
    async function fetcher(): Promise<FetchedRegistry> {
      throw new RegistryFetchError('auth', 'sign in to load this private list')
    }
    const result = await resolveCatalog([root('root')], fetcher, DEFAULT_LIMITS, noop)
    expect(result.failures).toEqual([{ url: 'root', reason: 'auth', message: 'sign in to load this private list' }])
  })

  it('classifies an unrecognised fetch error as unknown', async () => {
    const result = await resolveCatalog([root('root')], fetcherFrom({}), DEFAULT_LIMITS, noop)
    expect(result.failures[0]).toMatchObject({ url: 'root', reason: 'unknown' })
  })
})

describe('resolveCatalog sub-list trust', () => {
  it('honors the trust the parent declared on a sub-list, not the parent own trust', async () => {
    const parent = { ...index('Root', [entry('one')]), lists: [{ name: 'Org', url: 'org', trust: 'project' as const }, { name: 'Ext', url: 'ext', trust: 'community' as const }] }
    const catalogs = { root: parent, org: index('Org', [entry('two')]), ext: index('Ext', [entry('three')]) }
    const result = await resolveCatalog([root('root')], fetcherFromSigned(catalogs, 'org-gpg-key'), DEFAULT_LIMITS, noop)
    expect(result.plugins.find((plugin) => plugin.name === 'two')?.trust).toBe('project')
    expect(result.plugins.find((plugin) => plugin.name === 'three')?.trust).toBe('community')
  })

  it('defaults an undeclared sub-list to community, even under a project root', async () => {
    const catalogs = { root: index('Root', [entry('one')], ['child']), child: index('Child', [entry('two')]) }
    const result = await resolveCatalog([root('root')], fetcherFromSigned(catalogs, 'org-gpg-key'), DEFAULT_LIMITS, noop)
    expect(result.plugins.find((plugin) => plugin.name === 'two')?.trust).toBe('community')
  })
})

describe('resolveCatalog trust downgrade', () => {
  it('downgrades an unsigned manufacturer registry entry to trust unknown', async () => {
    const catalogs = { root: index('Root', [entry('one')]) }
    const manufacturerRoot: RegistryRef = { url: 'root', trust: 'manufacturer', locked: true }
    const result = await resolveCatalog([manufacturerRoot], fetcherFrom(catalogs), DEFAULT_LIMITS, noop)
    expect(result.plugins.find((plugin) => plugin.name === 'one')?.trust).toBe('unknown')
  })

  it('keeps a manufacturer entry at tier manufacturer when the registry carries a valid signature', async () => {
    const catalogs = { root: index('Root', [entry('one')]) }
    const manufacturerRoot: RegistryRef = { url: 'root', trust: 'manufacturer', locked: true }
    const result = await resolveCatalog([manufacturerRoot], fetcherFromSigned(catalogs, 'org-gpg-key'), DEFAULT_LIMITS, noop)
    expect(result.plugins.find((plugin) => plugin.name === 'one')?.trust).toBe('manufacturer')
  })

  // The whole point of splitting failed from unknown: a signature that did not check out is the one
  // situation an owner should look into, and it used to read the same as a list nobody ever signed. It
  // still loads (NO-DOWNGRADE), and the Repositories row says failed as well as the plugin does, since
  // that row is where an owner goes when a source looks wrong.
  it('reads failed, not unknown, when a signature was served and did not check out, and the list still loads', async () => {
    const catalogs = { root: index('Root', [entry('one')]) }
    const manufacturerRoot: RegistryRef = { url: 'root', trust: 'manufacturer', locked: true }
    const result = await resolveCatalog([manufacturerRoot], fetcherWithABadSignature(catalogs), DEFAULT_LIMITS, noop)
    const plugin = result.plugins.find((candidate) => candidate.name === 'one')
    expect(plugin?.trust).toBe('failed')
    expect(plugin?.signer).toBeNull()
    expect(result.registries.find((source) => source.url === 'root')?.trust).toBe('failed')
    expect(result.failures).toEqual([])
  })

  it('ranks an unknown-trust entry below every other tier when the same plugin appears from two sources', async () => {
    const catalogs = { root: index('Root', [entry('shared')]), community: index('Community', [entry('shared')]) }
    const manufacturerRoot: RegistryRef = { url: 'root', trust: 'manufacturer', locked: true }
    const communityRoot: RegistryRef = { url: 'community', trust: 'community', locked: true }
    const result = await resolveCatalog([manufacturerRoot, communityRoot], fetcherProving(catalogs, ['community']), DEFAULT_LIMITS, noop)
    const winner = result.plugins.find((plugin) => plugin.name === 'shared')
    expect(winner?.trust).toBe('community')
    expect(winner?.variants?.some((variant) => variant.trust === 'unknown')).toBe(true)
  })
})

describe('resolveCatalog proved publisher', () => {
  it('downgrades every curated tier, not just manufacturer, when nothing proved who served the list', async () => {
    const catalogs = { root: index('Root', [entry('one')]) }
    const result = await resolveCatalog([root('root')], fetcherFrom(catalogs), DEFAULT_LIMITS, noop)
    const plugin = result.plugins.find((candidate) => candidate.name === 'one')
    expect(plugin?.trust).toBe('unknown')
    expect(plugin?.signer).toBeNull()
  })

  it('names the proved publisher rather than the publisher line the list wrote about itself', async () => {
    const catalogs = { root: index('Root', [entry('one')]) }
    const result = await resolveCatalog([root('root')], fetcherFromSigned(catalogs, 'org-gpg-key'), DEFAULT_LIMITS, noop)
    const plugin = result.plugins.find((candidate) => candidate.name === 'one')
    expect(plugin?.trust).toBe('project')
    expect(plugin?.signer).toBe('Bespok3d')
    expect(catalogs.root.publisher).toBe('PLACEHOLDER')
  })

  it('leaves a trust-any source alone, because it claims no curation for a signature to stand behind', async () => {
    const catalogs = { local: index('Local', [entry('one')]) }
    const sideloaded: RegistryRef = { url: 'local', trust: 'any', locked: false }
    const result = await resolveCatalog([sideloaded], fetcherFrom(catalogs), DEFAULT_LIMITS, noop)
    expect(result.plugins.find((candidate) => candidate.name === 'one')?.trust).toBe('any')
  })
})

describe('resolveCatalog cutoffs', () => {
  it('logs a drop when the registry cap is exceeded', async () => {
    const catalogs = {
      root: index('Root', [entry('one')], ['second', 'third']),
      second: index('Second', [entry('two')]),
      third: index('Third', [entry('three')]),
    }
    const cap = { ...DEFAULT_LIMITS, maxRegistries: 2 }
    const result = await resolveCatalog([root('root')], fetcherFrom(catalogs), cap, noop)
    expect(result.registries).toHaveLength(2)
    expect(result.drops.some((drop) => drop.includes('max-registries'))).toBe(true)
  })

  it('logs a drop when the entry cap is exceeded', async () => {
    const catalogs = { root: index('Root', [entry('one'), entry('two'), entry('three')]) }
    const cap = { ...DEFAULT_LIMITS, maxEntries: 2 }
    const result = await resolveCatalog([root('root')], fetcherFrom(catalogs), cap, noop)
    expect(result.plugins).toHaveLength(2)
    expect(result.drops.some((drop) => drop.includes('max-entries'))).toBe(true)
  })
})

describe('resolveCatalog cross-source deps', () => {
  it('resolves a cross-source service dep through the full resolveCatalog flow', async () => {
    const provider = { name: 'rfid-ntag', version: '1.0.0', provides: ['rfid-service'], deps: [] }
    const consumer = { name: 'spoolman', version: '1.0.0', provides: [], deps: ['rfid-service'] }
    const catalogs = { root: index('Root', [consumer], ['child']), child: index('Child', [provider]) }
    const result = await resolveCatalog([root('root')], fetcherFrom(catalogs), DEFAULT_LIMITS, noop)
    expect(result.plugins.find((plugin) => plugin.name === 'spoolman')?.deps).toEqual(['rfid-ntag'])
  })
})

function collection(name: string, version = '1.0.0'): Record<string, unknown> {
  return { name, version, title: name, members: [{ id: 'a' }, { id: 'b' }] }
}

function withCollections(name: string, collections: Array<Record<string, unknown>>, lists: string[] = []): RegistryIndex {
  return { ...index(name, [], lists), collections } as RegistryIndex
}

describe('resolveCatalog collections', () => {
  it('absorbs collections into a separate collections[] and stamps trust from the source ref', async () => {
    const catalogs = { root: withCollections('Root', [collection('all-the-tags')]) }
    const result = await resolveCatalog([root('root')], fetcherFromSigned(catalogs, 'org-gpg-key'), DEFAULT_LIMITS, noop)
    expect(result.plugins).toHaveLength(0)
    expect(result.collections.map((entry) => entry.name)).toEqual(['all-the-tags'])
    expect(result.collections[0].trust).toBe('project')
    expect(result.collections[0].registry_url).toBe('root')
  })

  it('merges collections from a root and its child lists', async () => {
    const catalogs = {
      root: withCollections('Root', [collection('cameras')], ['child']),
      child: withCollections('Child', [collection('all-the-tags')]),
    }
    const result = await resolveCatalog([root('root')], fetcherFrom(catalogs), DEFAULT_LIMITS, noop)
    expect(result.collections.map((entry) => entry.name).sort()).toEqual(['all-the-tags', 'cameras'])
  })

  it('dedupes a collection id to the newest version at equal trust', async () => {
    const catalogs = { root: withCollections('Root', [collection('all-the-tags', '1.0.0'), collection('all-the-tags', '2.0.0')]) }
    const result = await resolveCatalog([root('root')], fetcherFrom(catalogs), DEFAULT_LIMITS, noop)
    expect(result.collections).toHaveLength(1)
    expect(result.collections[0].version).toBe('2.0.0')
  })

  it('keeps the highest-trust collection across lists even when it is the older version', async () => {
    const catalogs = {
      root: withCollections('Root', [collection('all-the-tags', '1.0.0')], ['child']),
      child: withCollections('Child', [collection('all-the-tags', '2.0.0')]),
    }
    const result = await resolveCatalog([root('root')], fetcherFromSigned(catalogs, 'org-gpg-key'), DEFAULT_LIMITS, noop)
    expect(result.collections).toHaveLength(1)
    expect(result.collections[0].version).toBe('1.0.0')
    expect(result.collections[0].trust).toBe('project')
  })

  it('tolerates a list that ships no collections key', async () => {
    const catalogs = { root: index('Root', [entry('one')]) }
    const result = await resolveCatalog([root('root')], fetcherFrom(catalogs), DEFAULT_LIMITS, noop)
    expect(result.collections).toEqual([])
  })
})
