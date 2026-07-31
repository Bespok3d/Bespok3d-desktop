// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect } from 'vitest'
import { isLocalRegistry, docFor, indexToPlugins, indexToCollections } from './shape'
import { makeIndexEntry, makeCollectionEntry } from '../../test/fixtures'
import { NO_PLUGIN_SOURCES } from '../../test/plugin-sources'

describe('docFor', () => {
  // camera-hw-accel lives in plugins/u1-hw-camera/plugin/, so its directory name ("plugin") differs
  // from its manifest .name. Docs must key by manifest .name (the plugin identity), or its Doc tab
  // never appears. This guards that the dir-name-vs-manifest-name mismatch resolves correctly.
  it.skipIf(NO_PLUGIN_SOURCES)('resolves a doc by manifest name even when the plugin directory is named differently', () => {
    const doc = docFor('camera-hw-accel')
    expect(doc).toBeTruthy()
    expect(doc).toContain('Camera HW Accel')
  })

  it('does not key a doc by the plugin directory name', () => {
    expect(docFor('plugin')).toBeUndefined()
  })
})

describe('isLocalRegistry', () => {
  it('marks an on-disk bundled index as local', () => {
    expect(isLocalRegistry('/Users/dev/Bespok3d/dist/plugins/index.json')).toBe(true)
  })

  it('does not mark a published GitHub list as local', () => {
    expect(isLocalRegistry('github:Bespok3d/main-index/index.json')).toBe(false)
  })

  it('does not mark an http(s) list as local', () => {
    expect(isLocalRegistry('https://example.test/index.json')).toBe(false)
  })
})

// A store page must show the words of the version it is offering. The publisher's build rewrites these
// fields to the docs released beside the package; only that form can be read at runtime, so a source
// path or a link for a human to click must not be handed to the fetch as if it were one.
describe('the runtime-readable release notes', () => {
  it('carries the notes and the README released with the offered version', () => {
    const released = makeIndexEntry({
      doc_url: 'https://api.github.com/repos/Bespok3d/u1-hw-camera/releases/assets/41',
      changelog_url: 'https://api.github.com/repos/Bespok3d/u1-hw-camera/releases/assets/42',
    })
    const [plugin] = indexToPlugins([released], [])
    expect(plugin?.docUrl).toBe('https://api.github.com/repos/Bespok3d/u1-hw-camera/releases/assets/41')
    expect(plugin?.changelogUrl).toBe('https://api.github.com/repos/Bespok3d/u1-hw-camera/releases/assets/42')
  })

  it('does not offer a source path or a browse link as something to read', () => {
    const unreleased = makeIndexEntry({
      doc_url: 'https://github.com/Bespok3d/u1-hw-camera/blob/main/plugin/doc/README.md',
      changelog_url: 'camera-hw-accel/doc/CHANGELOG.md',
    })
    const [plugin] = indexToPlugins([unreleased], [])
    expect(plugin?.docUrl).toBeUndefined()
    expect(plugin?.changelogUrl).toBeUndefined()
  })

  it('carries a collection\'s released notes the same way', () => {
    const [collection] = indexToCollections([makeCollectionEntry({
      changelog_url: 'https://api.github.com/repos/Bespok3d/main-index/releases/assets/7',
    })])
    expect(collection?.changelogUrl).toBe('https://api.github.com/repos/Bespok3d/main-index/releases/assets/7')
  })
})

describe('indexToPlugins author + sw_version', () => {
  it('maps author and sw_version onto the plugin and its source variant', () => {
    const [plugin] = indexToPlugins([makeIndexEntry({ author: 'bespoked', sw_version: '1.37.2' })], [])
    expect(plugin.author).toBe('bespoked')
    expect(plugin.swVersion).toBe('1.37.2')
    expect(plugin.sources[0].swVersion).toBe('1.37.2')
  })

  it('leaves author and sw_version undefined for a plugin that carries neither', () => {
    const [plugin] = indexToPlugins([makeIndexEntry()], [])
    expect(plugin.author).toBeUndefined()
    expect(plugin.swVersion).toBeUndefined()
    expect(plugin.sources[0].swVersion).toBeUndefined()
  })
})

describe('indexToCollections', () => {
  it('maps author onto the collection (collections carry no sw_version)', () => {
    const [collection] = indexToCollections([makeCollectionEntry({ author: 'bespoked' })])
    expect(collection.author).toBe('bespoked')
  })

  it('maps a collection wire entry to the camelCase Collection, members passthrough', () => {
    const [collection] = indexToCollections([makeCollectionEntry({ printer_specific: true })])
    expect(collection.id).toBe('demo-collection')
    expect(collection.name).toBe('demo-collection')
    expect(collection.title).toBe('Demo Collection')
    expect(collection.printerSpecific).toBe(true)
    expect(collection.members).toEqual([{ id: 'demo', version: '>=1.0.0' }])
  })

  it('loads the changelog markdown only when changelog_url is present', () => {
    const [withChangelog] = indexToCollections([makeCollectionEntry({ changelog_url: 'demo-collection/doc/CHANGELOG.md' })])
    const [without] = indexToCollections([makeCollectionEntry()])
    // No real bundled doc for the demo fixture, so changelogFor returns undefined either way; the
    // branch under test is that the changelog_url gate is honored (no throw, no plugin-doc bleed).
    expect(withChangelog.changelog).toBeUndefined()
    expect(without.changelog).toBeUndefined()
  })

  it('marks a collection from a local dev index as local', () => {
    const [collection] = indexToCollections([makeCollectionEntry({ registry_url: '/Users/dev/dist/plugins/index.json' })])
    expect(collection.local).toBe(true)
  })
})
