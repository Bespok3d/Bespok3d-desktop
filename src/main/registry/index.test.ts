// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { CatalogResult, MergedEntry } from './model'

const userDataDir = mkdtempSync(join(tmpdir(), 'b3-registry-'))
vi.mock('electron', () => ({ app: { getPath: () => userDataDir } }))
vi.mock('@electron-toolkit/utils', () => ({ is: { dev: true } }))

const mocks = vi.hoisted(() => ({ resolveCatalog: vi.fn(), cachedRelease: vi.fn() }))

vi.mock('./resolve', () => ({ resolveCatalog: mocks.resolveCatalog }))
vi.mock('./resolve/latest-release', () => ({ cachedRelease: mocks.cachedRelease, fetchLatestRelease: vi.fn() }))

import { configuredSources, loadCatalog } from './index'
import { normalizeRegistryUrl } from './resolve/url'

const OFFICIAL_URL = 'github:Bespok3d/main-index/index.json'

// configuredSources is the built-in source list. The official remote and the bundled offline copy are
// HARDCODED roots (not user settings), so a stale or empty git-host.json can never drop them; both are
// locked (toggle-off-able in the pane, but never removable). This is the "official source is always
// present" half of the Repositories contract; the pane-level "not removable" half is in the cage test.
describe('configuredSources built-in roots', () => {
  it('always lists the official published list as a locked project source', () => {
    const official = configuredSources().find((source) => source.url === OFFICIAL_URL)
    expect(official).toMatchObject({ trust: 'project', locked: true })
  })

  it('lists the bundled offline copy as a locked project source ahead of the remote', () => {
    const sources = configuredSources()
    expect(sources[0]).toMatchObject({ name: 'Bespok3d Official', trust: 'project', locked: true })
    expect(sources[0].url.endsWith('index.json')).toBe(true)
    expect(sources[1].url).toBe(OFFICIAL_URL)
  })

  it('omits the sideloaded local source until the user has dropped a package', () => {
    expect(configuredSources().some((source) => source.trust === 'any')).toBe(false)
  })

  it('exposes built-in source urls that normalize to themselves (stable disabled-set keys)', () => {
    configuredSources().forEach((source) => {
      const normalized = normalizeRegistryUrl(source.url)
      expect(normalizeRegistryUrl(normalized)).toBe(normalized)
    })
  })
})

// loadCatalog is the ONE seam every reader comes through: the listing, the update badge, the
// notification zone, a single install and the batch update. So what is asserted here is that a release
// the launch pass filed reaches all of them at once, and that the version and the url it hands them
// came from the same release. A version raised on its own would put a badge in front of the owner that
// every install then refuses as older than the entry claims.
const RFID_ASSET = 'https://api.github.com/repos/fixture-owner/rfid-tools/releases/assets/1'
const FRESH_RFID_ASSET = 'https://api.github.com/repos/fixture-owner/rfid-tools/releases/assets/9'

function listed(pluginId: string, version: string, extra: Partial<MergedEntry> = {}): MergedEntry {
  return {
    name: pluginId,
    version,
    download_url: RFID_ASSET,
    trust: 'project',
    signer: 'fixture-publisher',
    registry_url: 'https://fixture-index.invalid/index.json',
    ...extra,
  }
}

function resolvedInto(plugins: MergedEntry[]): CatalogResult {
  return {
    name: 'fixture index', publisher: 'fixture-publisher', updated: '2026-07-29', trust: 'project',
    plugins, collections: [], registries: [], drops: [], failures: [],
  }
}

beforeEach(() => {
  mocks.resolveCatalog.mockReset()
  mocks.cachedRelease.mockReset()
  mocks.cachedRelease.mockReturnValue(null)
})

describe('loadCatalog and the release the launch pass filed', () => {
  it('shows the released version, with the url of that release, in place of what the list published', async () => {
    mocks.resolveCatalog.mockResolvedValue(resolvedInto([listed('rfid-tools', '0.1.9')]))
    mocks.cachedRelease.mockReturnValue({ version: '0.2.0', downloadUrl: FRESH_RFID_ASSET })
    const catalog = await loadCatalog()

    expect(catalog.plugins[0]).toMatchObject({ version: '0.2.0', download_url: FRESH_RFID_ASSET })
  })

  it('keeps the list version when no repo has been asked yet, so a first launch shows the listing itself', async () => {
    mocks.resolveCatalog.mockResolvedValue(resolvedInto([listed('rfid-tools', '0.1.9')]))
    const catalog = await loadCatalog()

    expect(catalog.plugins[0]).toMatchObject({ version: '0.1.9', download_url: RFID_ASSET })
  })

  it('refreshes the variants too, because the badge reads whichever one the channel ceiling allows', async () => {
    const withVariants = listed('rfid-tools', '0.1.9', {
      variants: [listed('rfid-tools', '0.1.9'), listed('rfid-tools', '0.1.8')],
    })
    mocks.resolveCatalog.mockResolvedValue(resolvedInto([withVariants]))
    mocks.cachedRelease.mockReturnValue({ version: '0.2.0', downloadUrl: FRESH_RFID_ASSET })
    const catalog = await loadCatalog()

    expect(catalog.plugins[0].variants?.map((variant) => variant.version)).toEqual(['0.2.0', '0.2.0'])
    expect(catalog.plugins[0].variants?.every((variant) => variant.download_url === FRESH_RFID_ASSET)).toBe(true)
  })

  it('never walks a plugin backwards to a release older than the list published', async () => {
    mocks.resolveCatalog.mockResolvedValue(resolvedInto([listed('rfid-tools', '0.2.0')]))
    mocks.cachedRelease.mockReturnValue({ version: '0.1.9', downloadUrl: FRESH_RFID_ASSET })
    const catalog = await loadCatalog()

    expect(catalog.plugins[0]).toMatchObject({ version: '0.2.0', download_url: RFID_ASSET })
  })

  it('leaves an entry a list publishes as stable on its stable version when the repo released a prerelease', async () => {
    mocks.resolveCatalog.mockResolvedValue(resolvedInto([listed('rfid-tools', '0.1.9', { channel: 'stable' })]))
    mocks.cachedRelease.mockReturnValue({ version: '0.2.0-rc.1', downloadUrl: FRESH_RFID_ASSET })
    const catalog = await loadCatalog()

    expect(catalog.plugins[0]).toMatchObject({ version: '0.1.9', download_url: RFID_ASSET })
  })

  it('still reports the sources pane, so the refresh cannot cost the Repositories list its rows', async () => {
    mocks.resolveCatalog.mockResolvedValue(resolvedInto([listed('rfid-tools', '0.1.9')]))
    const catalog = await loadCatalog()

    expect(catalog.sources.length).toBe(configuredSources().length)
  })
})
