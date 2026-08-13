// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import AdmZip from 'adm-zip'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import type { MergedEntry } from '../registry/model'

const publishedList = vi.hoisted(() => ({ plugins: [] as unknown[] }))
const downloads = vi.hoisted(() => ({ askedFor: null as unknown, bytes: Buffer.alloc(0) as Buffer, fails: false }))
const shippedCatalogue = vi.hoisted(() => ({ dir: '' }))
const forgotten = vi.hoisted(() => ({ packages: [] as string[] }))
const remembered = vi.hoisted(() => ({ offers: {} as Record<string, string> }))

vi.mock('../registry', () => ({ loadCatalog: async () => ({ plugins: publishedList.plugins }) }))
vi.mock('../registry/bundled-dir', () => ({ bundledRegistryDir: () => shippedCatalogue.dir }))
vi.mock('../registry/offered-versions', () => ({
  forgetOfferedSystemVersion: (packageName: string) => { forgotten.packages = [...forgotten.packages, packageName] },
  rememberOfferedSystemVersion: (packageName: string, version: string) => { remembered.offers = { ...remembered.offers, [packageName]: version } },
}))
vi.mock('./catalog-archive', () => ({
  discardCachedArchive: () => true,
  resolveArchiveBytes: async (entry: MergedEntry) => {
    downloads.askedFor = entry
    if (downloads.fails) throw new Error('no route to the release host')

    return downloads.bytes
  },
}))
// The signing chain has its own tests; what is under test here is which archive is opened.
vi.mock('./verify-package', () => ({ verifiedPackageTrust: async () => 'project' }))

import { openSystemPackage } from './system-package'

const DAEMON = 'bespok3d-daemon'
const JINNI = 'bespok3d-jinni-snapmaker-u1'
const SHIPPED_DAEMON = '0.12.25'
const SHIPPED_JINNI = '0.1.10'

function archiveMarked(marker: string): Buffer {
  const archive = new AdmZip()
  archive.addFile('files/daemon.py', Buffer.from(marker))

  return archive.toBuffer()
}

function publishedEntry(name: string, version: string): unknown {
  return { name, version, download_url: `https://releases.example/${name}-${version}.b3`, trust: 'project', signer: null, registry_url: 'https://index.example/index.json' }
}

function shippedArchive(name: string, version: string, marker: string): unknown {
  writeFileSync(join(shippedCatalogue.dir, `${name}.b3`), archiveMarked(marker))

  return { name, version, download_url: `${name}.b3` }
}

beforeEach(() => {
  publishedList.plugins = []
  downloads.askedFor = null
  downloads.fails = false
  downloads.bytes = archiveMarked('published bytes')
  forgotten.packages = []
  remembered.offers = {}
  shippedCatalogue.dir = mkdtempSync(join(tmpdir(), 'b3d-shipped-'))
  const shipped = [shippedArchive(DAEMON, SHIPPED_DAEMON, 'shipped daemon'), shippedArchive(JINNI, SHIPPED_JINNI, 'shipped jinni')]
  writeFileSync(join(shippedCatalogue.dir, 'index.json'), JSON.stringify({ plugins: shipped }))
})

afterEach(() => {
  rmSync(shippedCatalogue.dir, { recursive: true, force: true })
})

// The daemon and the jinni are released as their own signed packages so a fix reaches printers without
// an app release behind it, and a daemon release that needs a newer jinni moves the pair. Before this,
// enrollment and every update uploaded the copy inside the app's own build, so a released daemon
// 0.12.26 could not reach a printer at all.
describe('the machinery this app puts on a printer', () => {
  it('is the published daemon when the lists offer one newer than the build ships', async () => {
    publishedList.plugins = [publishedEntry(DAEMON, '0.12.26')]

    const opened = await openSystemPackage(DAEMON)

    expect(opened.version).toBe('0.12.26')
    expect(opened.payloadBytes('daemon.py').toString()).toBe('published bytes')
  })

  it('is the published jinni when the lists offer one newer than the build ships', async () => {
    publishedList.plugins = [publishedEntry(JINNI, '0.1.11')]

    const opened = await openSystemPackage(JINNI)

    expect(opened.version).toBe('0.1.11')
    expect(opened.payloadBytes('daemon.py').toString()).toBe('published bytes')
  })

  it('is fetched through the entry the lists resolved, so that release own assets are what land', async () => {
    publishedList.plugins = [publishedEntry(DAEMON, '0.12.26')]

    await openSystemPackage(DAEMON)

    expect(downloads.askedFor).toMatchObject({ name: DAEMON, version: '0.12.26' })
  })

  // Every version this app names has to be the version it just put on the printer, or the next repair
  // is refused as a downgrade off a daemon this very app installed.
  it('writes down the version it installed, so the app names what the printer is running', async () => {
    publishedList.plugins = [publishedEntry(DAEMON, '0.12.26')]

    await openSystemPackage(DAEMON)

    expect(remembered.offers).toEqual({ [DAEMON]: '0.12.26' })
  })

  it('writes nothing down when the package is refused, because no byte of it reaches the printer', async () => {
    publishedList.plugins = [publishedEntry(DAEMON, '0.12.26')]
    downloads.bytes = Buffer.from('not an archive at all')

    await expect(openSystemPackage(DAEMON)).rejects.toThrow()

    expect(remembered.offers).toEqual({})
  })
})

describe('a machine the published lists cannot move forward', () => {
  it('installs the copy the build ships when the lists name no machinery at all', async () => {
    publishedList.plugins = [publishedEntry('spoolman', '9.9.9')]

    const opened = await openSystemPackage(DAEMON)

    expect(opened.version).toBe(SHIPPED_DAEMON)
    expect(opened.payloadBytes('daemon.py').toString()).toBe('shipped daemon')
    expect(downloads.askedFor).toBeNull()
  })

  it('is never dragged backwards by a published list that is behind the build', async () => {
    publishedList.plugins = [publishedEntry(DAEMON, '0.12.24')]

    const opened = await openSystemPackage(DAEMON)

    expect(opened.version).toBe(SHIPPED_DAEMON)
    expect(downloads.askedFor).toBeNull()
  })

  // A printer that answers on port 22 and nothing else still enrolls, and the offer is forgotten so
  // that the version check after the upload is asked about the bytes that actually landed.
  it('falls back to the shipped copy when the release cannot be fetched, and forgets the offer', async () => {
    publishedList.plugins = [publishedEntry(DAEMON, '0.12.26')]
    downloads.fails = true

    const opened = await openSystemPackage(DAEMON)

    expect(opened.version).toBe(SHIPPED_DAEMON)
    expect(opened.payloadBytes('daemon.py').toString()).toBe('shipped daemon')
    expect(forgotten.packages).toEqual([DAEMON])
  })
})
