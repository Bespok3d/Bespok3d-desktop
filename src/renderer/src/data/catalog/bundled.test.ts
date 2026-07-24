import { describe, it, expect } from 'vitest'
import { BUNDLED_CATEGORIES, CHANNELS } from './bundled'
import { indexToPlugins } from './shape'
import type { IndexEntry } from '../types'
// @ts-expect-error - build-time generator, plain JS with no type declarations
import { buildIndex } from '../../../../../scripts/app-bundle.mjs'

// Mirror app-bundle.mjs discovery: plugins live in the sibling
// plugins/ tree (the repo split), excluding any payload manifest under files/ (e.g. remote-screen's
// PWA manifest) so cross-repo service deps (webcam-builtin -> camera-hw-accel) resolve as in the
// real build. The *-bleeding-edge dirs are dev-only channel overlays (same id as an online plugin,
// bundled via bundle.dev.json `variantDirs`), not standalone plugins, so they are excluded from this
// one-manifest-one-plugin invariant.
const RAW_MANIFESTS = import.meta.glob(
  [
    '../../../../../../plugins/**/manifest.json',
    '!**/files/**',
    '!**/doc/**',
    '!**/dist/**',
    '!**/node_modules/**',
    '!**/*-bleeding-edge/**',
  ],
  { eager: true, import: 'default' },
) as Record<string, Record<string, unknown>>

const MANIFESTS = Object.values(RAW_MANIFESTS)
// A kind:collection manifest maps to a collections[] entry, not a plugin, so it is excluded from the
// one-manifest-one-plugin invariant below (the collection coverage is asserted separately).
const PLUGIN_MANIFESTS = MANIFESTS.filter((manifest) => manifest.kind !== 'collection')
const INDEX = buildIndex(MANIFESTS)
const ENTRIES = (INDEX.plugins as IndexEntry[]).map((entry) => ({
  ...entry,
  trust: 'project' as const,
  registry_url: 'bundled',
}))
const PLUGINS = indexToPlugins(ENTRIES, [])

const CATEGORY_IDS = new Set(BUNDLED_CATEGORIES.map((category) => category.id))
const PLUGIN_IDS = new Set(PLUGINS.map((plugin) => plugin.id))
const TRUST_TIERS = new Set(['any', 'community', 'project', 'manufacturer'])
const CHANNEL_IDS = new Set(['lts', 'stable', 'rc', 'testing', 'experiment'])

describe('catalog from generated index', () => {
  it('maps every bundled plugin manifest into a plugin (collections excluded)', () => {
    expect(PLUGINS.length).toBe(PLUGIN_MANIFESTS.length)
    expect(PLUGIN_IDS.size).toBe(PLUGINS.length)
  })

  it('every plugin category exists in BUNDLED_CATEGORIES', () => {
    PLUGINS.forEach((plugin) => {
      expect(CATEGORY_IDS.has(plugin.category), `${plugin.id}: unknown category "${plugin.category}"`).toBe(true)
    })
  })

  it('every dep references an existing plugin id', () => {
    PLUGINS.forEach((plugin) => {
      plugin.deps.forEach((dep) => {
        expect(PLUGIN_IDS.has(dep), `${plugin.id}: unknown dep "${dep}"`).toBe(true)
      })
    })
  })

  it('every channel and trust tier is valid', () => {
    PLUGINS.forEach((plugin) => {
      expect(CHANNEL_IDS.has(plugin.channel), `${plugin.id}: invalid channel "${plugin.channel}"`).toBe(true)
      expect(TRUST_TIERS.has(plugin.trust), `${plugin.id}: invalid trust "${plugin.trust}"`).toBe(true)
    })
  })

  it('every plugin has non-empty title, tagline, and description', () => {
    PLUGINS.forEach((plugin) => {
      expect(plugin.title.length, `${plugin.id} has empty title`).toBeGreaterThan(0)
      expect(plugin.tagline.length, `${plugin.id} has empty tagline`).toBeGreaterThan(0)
      expect(plugin.description.length, `${plugin.id} has empty description`).toBeGreaterThan(0)
    })
  })

  it('carries publish and update dates through from the manifest', () => {
    PLUGINS.forEach((plugin) => {
      expect(plugin.publishedAt, `${plugin.id} missing publishedAt`).toBeTruthy()
      expect(plugin.updatedAt, `${plugin.id} missing updatedAt`).toBeTruthy()
    })
  })
})

describe('catalog collections', () => {
  it('routes a kind:collection manifest into collections[], never plugins[]', () => {
    const collectionManifests = MANIFESTS.filter((manifest) => manifest.kind === 'collection')
    expect((INDEX.collections as Array<{ name: string }>).length).toBe(collectionManifests.length)
    collectionManifests.forEach((manifest) => {
      expect(PLUGIN_IDS.has(manifest.name as string)).toBe(false)
    })
  })
})

describe('BUNDLED_CATEGORIES integrity', () => {
  it('has no duplicate category ids', () => {
    expect(CATEGORY_IDS.size).toBe(BUNDLED_CATEGORIES.length)
  })

  it('every category has non-empty title and sub', () => {
    BUNDLED_CATEGORIES.forEach((category) => {
      expect(category.title.length, `category ${category.id} has empty title`).toBeGreaterThan(0)
      expect(category.sub.length, `category ${category.id} has empty sub`).toBeGreaterThan(0)
    })
  })
})

describe('CHANNELS integrity', () => {
  it('has no duplicate channel ids', () => {
    const ids = new Set(CHANNELS.map((channel) => channel.id))
    expect(ids.size).toBe(CHANNELS.length)
  })

  it('every channel id is a valid ReleaseChannel', () => {
    CHANNELS.forEach((channel) => {
      expect(CHANNEL_IDS.has(channel.id), `unknown channel id "${channel.id}"`).toBe(true)
    })
  })
})
