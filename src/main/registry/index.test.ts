// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect, vi } from 'vitest'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const userDataDir = mkdtempSync(join(tmpdir(), 'b3-registry-'))
vi.mock('electron', () => ({ app: { getPath: () => userDataDir } }))
vi.mock('@electron-toolkit/utils', () => ({ is: { dev: true } }))

import { configuredSources } from './index'
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
