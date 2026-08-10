// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

var catalogueDir = ''

vi.mock('../registry/bundled-dir', () => ({ bundledRegistryDir: () => catalogueDir }))

const { shippedJinniVersion } = await import('./jinni-baseline')

const SNAPMAKER_JINNI = 'bespok3d-jinni-snapmaker-u1'

// The update banner used to be baselined on the version the adapter declares, which in a working copy
// comes from a sibling checkout and can name a jinni the build does not carry. These hold the baseline
// on the catalogue this build packs.
describe('shippedJinniVersion', () => {
  beforeEach(() => {
    catalogueDir = mkdtempSync(join(tmpdir(), 'b3d-jinni-'))
  })

  afterEach(() => {
    rmSync(catalogueDir, { recursive: true, force: true })
  })

  function writeCatalogue(plugins: unknown): void {
    writeFileSync(join(catalogueDir, 'index.json'), JSON.stringify({ plugins }))
  }

  it('names the jinni version this build ships, not the one the adapter declares', () => {
    writeCatalogue([{ name: SNAPMAKER_JINNI, version: '0.1.10' }])

    expect(shippedJinniVersion({ jinniPackage: SNAPMAKER_JINNI })).toBe('0.1.10')
  })

  it('has no version to offer when the build ships no jinni package for the adapter', () => {
    writeCatalogue([{ name: 'bespok3d-daemon', version: '0.12.23' }])

    expect(shippedJinniVersion({ jinniPackage: SNAPMAKER_JINNI })).toBeUndefined()
  })

  it('has no version to offer when the build packs no catalogue at all', () => {
    expect(shippedJinniVersion({ jinniPackage: SNAPMAKER_JINNI })).toBeUndefined()
  })
})
