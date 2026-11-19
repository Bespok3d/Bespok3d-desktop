// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import AdmZip from 'adm-zip'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import type { MergedEntry } from '../registry/model'

const shippedCatalogue = vi.hoisted(() => ({ dir: '' }))

vi.mock('../registry/bundled-dir', () => ({ bundledRegistryDir: () => shippedCatalogue.dir }))
// The signing chain has its own tests; what is under test here is what the opened package hands out.
vi.mock('./verify-package', () => ({ verifiedPackageTrust: async () => 'project' }))

import { openBundledPackage, openVerifiedPackage } from './bundled-package'

const DAEMON = 'bespok3d-daemon'
// Spacing a JSON round trip would not keep: the bytes handed out must be the ones the signature covers.
const PACKED_MANIFEST = Buffer.from('{"name": "bespok3d-daemon",  "fingerprint": "abab"}\n')

function packedArchive(manifestBytes: Buffer | null): Buffer {
  const archive = new AdmZip()
  archive.addFile('files/daemon.py', Buffer.from('daemon source'))
  if (manifestBytes) archive.addFile('manifest.json', manifestBytes)

  return archive.toBuffer()
}

function publishedEntry(): MergedEntry {
  return { name: DAEMON, version: '0.15.0', download_url: 'https://releases.example/daemon.b3', trust: 'project', signer: null, registry_url: 'https://index.example/index.json' } as MergedEntry
}

beforeEach(() => {
  shippedCatalogue.dir = mkdtempSync(join(tmpdir(), 'b3d-shipped-'))
})

afterEach(() => {
  rmSync(shippedCatalogue.dir, { recursive: true, force: true })
})

// The printer keeps each machinery package's signed manifest so the daemon can report the fingerprint
// it carries; without these bytes a daemon rebuilt at the same version could never be told apart.
describe('the signed manifest of a machinery package', () => {
  it('is handed out byte for byte from the copy this build ships', async () => {
    writeFileSync(join(shippedCatalogue.dir, 'daemon.b3'), packedArchive(PACKED_MANIFEST))
    writeFileSync(join(shippedCatalogue.dir, 'index.json'), JSON.stringify({ plugins: [{ name: DAEMON, version: '0.15.0', download_url: 'daemon.b3' }] }))

    const opened = await openBundledPackage(DAEMON)

    expect(opened.manifestBytes().equals(PACKED_MANIFEST)).toBe(true)
  })

  it('is handed out byte for byte from a published copy', async () => {
    const opened = await openVerifiedPackage(publishedEntry(), packedArchive(PACKED_MANIFEST))

    expect(opened.manifestBytes().equals(PACKED_MANIFEST)).toBe(true)
  })

  it('is refused by name when the archive carries none', async () => {
    const opened = await openVerifiedPackage(publishedEntry(), packedArchive(null))

    expect(() => opened.manifestBytes()).toThrow(`the package for "${DAEMON}" carries no manifest.json`)
  })
})
