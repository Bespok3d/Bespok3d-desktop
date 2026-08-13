// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

var catalogueDir = ''

var storedSettings: Record<string, unknown> = {}

vi.mock('../registry/bundled-dir', () => ({ bundledRegistryDir: () => catalogueDir }))
vi.mock('../settings', () => ({
  loadSettings: () => storedSettings,
  saveSettings: (patch: Record<string, unknown>) => { storedSettings = { ...storedSettings, ...patch } },
}))

const { offeredJinniVersion } = await import('./jinni-baseline')

const SNAPMAKER_JINNI = 'bespok3d-jinni-snapmaker-u1'

// The update banner used to be baselined on the version the adapter declares, which in a working copy
// comes from a sibling checkout and can name a jinni the build does not carry. These hold the baseline
// on the catalogue this build packs.
describe('the jinni version this app would install', () => {
  beforeEach(() => {
    catalogueDir = mkdtempSync(join(tmpdir(), 'b3d-jinni-'))
    storedSettings = {}
  })

  afterEach(() => {
    rmSync(catalogueDir, { recursive: true, force: true })
  })

  function writeCatalogue(plugins: unknown): void {
    writeFileSync(join(catalogueDir, 'index.json'), JSON.stringify({ plugins }))
  }

  it('names the jinni version this build ships, not the one the adapter declares', () => {
    writeCatalogue([{ name: SNAPMAKER_JINNI, version: '0.1.10' }])

    expect(offeredJinniVersion({ jinniPackage: SNAPMAKER_JINNI })).toBe('0.1.10')
  })

  it('has no version to offer when the build ships no jinni package for the adapter', () => {
    writeCatalogue([{ name: 'bespok3d-daemon', version: '0.12.23' }])

    expect(offeredJinniVersion({ jinniPackage: SNAPMAKER_JINNI })).toBeUndefined()
  })

  // The jinni is released as its own signed package too: a daemon release that needs a newer jinni
  // has to be able to move the pair without an app release behind it.
  it('is the published one when the lists offer a jinni newer than the build ships', () => {
    writeCatalogue([{ name: SNAPMAKER_JINNI, version: '0.1.10' }])
    storedSettings = { offeredSystemVersions: { [SNAPMAKER_JINNI]: '0.1.11' } }

    expect(offeredJinniVersion({ jinniPackage: SNAPMAKER_JINNI })).toBe('0.1.11')
  })

  it('stays on the shipped one when the published lists are behind the build', () => {
    writeCatalogue([{ name: SNAPMAKER_JINNI, version: '0.1.10' }])
    storedSettings = { offeredSystemVersions: { [SNAPMAKER_JINNI]: '0.1.9' } }

    expect(offeredJinniVersion({ jinniPackage: SNAPMAKER_JINNI })).toBe('0.1.10')
  })

  it('has no version to offer when the build packs no catalogue at all', () => {
    expect(offeredJinniVersion({ jinniPackage: SNAPMAKER_JINNI })).toBeUndefined()
  })
})
