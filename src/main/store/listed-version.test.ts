// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// What the store page is told. null means "keep showing the listed version", which has to be the answer
// for every plugin whose repo has nothing newer or will not answer, because a store that surfaced those
// as a failure would be broken offline and broken for every bundled plugin.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { MergedEntry } from '../registry/model'

vi.mock('../registry', () => ({ loadCatalog: vi.fn() }))
vi.mock('../registry/resolve/refresh-entry', () => ({ withFreshestRelease: vi.fn() }))

import { freshestListedVersion } from './listed-version'
import { loadCatalog } from '../registry'
import { withFreshestRelease } from '../registry/resolve/refresh-entry'

const LISTED_ENTRY: MergedEntry = {
  name: 'idle-timeout',
  version: '0.2.0',
  download_url: 'https://api.github.com/repos/fixture-owner/idle-timeout/releases/assets/1111',
  trust: 'project',
  signer: null,
  registry_url: 'https://lists.example.invalid/community.json',
}

function stubCatalogWith(plugins: MergedEntry[]): void {
  vi.mocked(loadCatalog).mockResolvedValue({ plugins } as never)
}

beforeEach(() => vi.clearAllMocks())

describe('freshestListedVersion', () => {
  it('answers with the version the repo released, when it is newer than the list', async () => {
    stubCatalogWith([LISTED_ENTRY])
    vi.mocked(withFreshestRelease).mockResolvedValue({ ...LISTED_ENTRY, version: '0.3.0' })

    expect(await freshestListedVersion('idle-timeout')).toBe('0.3.0')
  })

  it('says nothing when the list is already current', async () => {
    stubCatalogWith([LISTED_ENTRY])
    vi.mocked(withFreshestRelease).mockResolvedValue(LISTED_ENTRY)

    expect(await freshestListedVersion('idle-timeout')).toBeNull()
  })

  it('says nothing for a plugin the catalog does not carry, rather than throwing at the store page', async () => {
    stubCatalogWith([LISTED_ENTRY])

    expect(await freshestListedVersion('never-listed')).toBeNull()
    expect(withFreshestRelease).not.toHaveBeenCalled()
  })

  it('compares against the source the page is showing, not the winning one', async () => {
    const shownVariant: MergedEntry = { ...LISTED_ENTRY, version: '0.1.0', registry_url: 'https://lists.example.invalid/local.json' }
    stubCatalogWith([{ ...LISTED_ENTRY, variants: [LISTED_ENTRY, shownVariant] }])
    vi.mocked(withFreshestRelease).mockResolvedValue({ ...shownVariant, version: '0.1.5' })

    expect(await freshestListedVersion('idle-timeout', 'https://lists.example.invalid/local.json')).toBe('0.1.5')
  })
})
