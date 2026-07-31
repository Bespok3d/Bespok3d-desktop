// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect, vi } from 'vitest'

const hoisted = vi.hoisted(() => ({ userDataDir: '' }))
vi.mock('electron', () => ({ app: { getPath: () => hoisted.userDataDir } }))
vi.mock('../registry/asset-read', () => ({ readReleaseAsset: vi.fn() }))

import { discardCachedArchive, findCatalogEntry, findCatalogVariant, resolveArchiveBytes } from './catalog-archive'
import { readReleaseAsset } from '../registry/asset-read'
import type { MergedEntry } from '../registry/model'
import { mkdtempSync, writeFileSync, mkdirSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

function catalogEntry(fields: Partial<MergedEntry> & { name: string }): MergedEntry {
  return { version: '0.1.0', trust: 'project', signer: null, registry_url: '/registry/index.json', ...fields }
}

describe('findCatalogEntry', () => {
  it('returns the entry whose name matches the plugin id', () => {
    const plugins = [catalogEntry({ name: 'spoolman' }), catalogEntry({ name: 'rfid-ntag' })]
    expect(findCatalogEntry(plugins, 'rfid-ntag').name).toBe('rfid-ntag')
  })

  it('does not confuse plugin ids sharing a leading segment', () => {
    const plugins = [catalogEntry({ name: 'camera' }), catalogEntry({ name: 'camera-hw-accel' })]
    expect(findCatalogEntry(plugins, 'camera').name).toBe('camera')
    expect(findCatalogEntry(plugins, 'camera-hw-accel').name).toBe('camera-hw-accel')
  })

  it('throws when no entry matches', () => {
    expect(() => findCatalogEntry([catalogEntry({ name: 'spoolman' })], 'remote-screen')).toThrow('bundled plugin not found: remote-screen')
  })
})

describe('findCatalogVariant', () => {
  function withVariants(): MergedEntry[] {
    const stable = catalogEntry({ name: 'fluidd', version: '1.0.0', channel: 'stable', registry_url: 'official' })
    const experiment = catalogEntry({ name: 'fluidd', version: '2.0.0', channel: 'experiment', registry_url: 'official' })

    return [{ ...experiment, variants: [experiment, stable] }]
  }

  it('returns the winner when no source or channel is named', () => {
    expect(findCatalogVariant(withVariants(), 'fluidd').version).toBe('2.0.0')
  })

  it('picks the variant matching the requested channel', () => {
    const variant = findCatalogVariant(withVariants(), 'fluidd', undefined, 'stable')
    expect(variant.version).toBe('1.0.0')
    expect(variant.channel).toBe('stable')
  })

  it('falls back to the winner when no variant matches the channel', () => {
    expect(findCatalogVariant(withVariants(), 'fluidd', undefined, 'lts').version).toBe('2.0.0')
  })
})

describe('resolveArchiveBytes', () => {
  it('reads the .b3 from download_url relative to the registry root', async () => {
    const root = mkdtempSync(join(tmpdir(), 'b3d-'))
    writeFileSync(join(root, 'spoolman-0.1.2.b3'), 'PAYLOAD')
    const entry = catalogEntry({ name: 'spoolman', version: '0.1.2', registry_url: join(root, 'index.json'), download_url: 'spoolman-0.1.2.b3' })
    expect((await resolveArchiveBytes(entry)).toString()).toBe('PAYLOAD')
  })

  it('gives an actionable error when the archive path is a directory, not a raw EISDIR', async () => {
    const root = mkdtempSync(join(tmpdir(), 'b3d-'))
    mkdirSync(join(root, 'spoolman-0.1.2.b3'))
    const entry = catalogEntry({ name: 'spoolman', version: '0.1.2', registry_url: join(root, 'index.json'), download_url: 'spoolman-0.1.2.b3' })
    await expect(resolveArchiveBytes(entry)).rejects.toThrow(/is not a file.*repack the bundle/)
  })

  it('rejects when the entry has no download_url', async () => {
    await expect(resolveArchiveBytes(catalogEntry({ name: 'spoolman' }))).rejects.toThrow('missing download_url')
  })

  // Installing used to go through the git host, which demands a signed-in account, so someone who
  // never wanted a GitHub account could browse the store and never install anything from it.
  it('downloads a remote http download_url the way a visitor does and caches it by version', async () => {
    hoisted.userDataDir = mkdtempSync(join(tmpdir(), 'b3d-cache-'))
    const downloaded = vi.mocked(readReleaseAsset)
    downloaded.mockReset().mockResolvedValue(Buffer.from('REMOTE'))
    const entry = catalogEntry({ name: 'spoolman', version: '0.1.2', download_url: 'https://example.test/spoolman-0.1.2.b3' })

    expect((await resolveArchiveBytes(entry)).toString()).toBe('REMOTE')
    expect((await resolveArchiveBytes(entry)).toString()).toBe('REMOTE')
    expect(downloaded).toHaveBeenCalledTimes(1)
  })
})

// A package the app would not install must not be kept: the cache is keyed by plugin name and version,
// so a copy left behind is handed back to every later attempt at that version and the user can never
// get past the refusal, not even by retrying.
describe('discardCachedArchive', () => {
  it('makes the next attempt fetch the package again instead of reusing the refused copy', async () => {
    hoisted.userDataDir = mkdtempSync(join(tmpdir(), 'b3d-cache-'))
    const downloaded = vi.mocked(readReleaseAsset)
    downloaded.mockReset().mockResolvedValue(Buffer.from('REMOTE'))
    const entry = catalogEntry({ name: 'camera', version: '0.4.0', download_url: 'https://example.test/camera-0.4.0.b3' })
    await resolveArchiveBytes(entry)

    discardCachedArchive(entry)
    await resolveArchiveBytes(entry)
    expect(downloaded).toHaveBeenCalledTimes(2)
  })

  it('is content with a package that was never downloaded', () => {
    hoisted.userDataDir = mkdtempSync(join(tmpdir(), 'b3d-cache-'))
    expect(() => discardCachedArchive(catalogEntry({ name: 'idle-timeout', version: '0.2.0' }))).not.toThrow()
  })
})
