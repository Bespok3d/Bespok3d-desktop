// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// The pass that runs when someone says yes to the offer. Whether the offer is due at all, and what
// records the lists as recent, are in listing-freshness.test.ts.
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  loadCatalog: vi.fn(),
  runRefreshPass: vi.fn(),
}))

vi.mock('./index', () => ({ loadCatalog: mocks.loadCatalog }))
vi.mock('./refresh-pass', () => ({ runRefreshPass: mocks.runRefreshPass }))

import { refreshListing } from './listing-refresh'

describe('the pass a yes starts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.loadCatalog.mockResolvedValue({ plugins: [{ name: 'camera', version: '0.1.0' }] })
    mocks.runRefreshPass.mockResolvedValue({ askedRepos: 1, moved: [{ pluginName: 'camera', listedVersion: '0.1.0', freshVersion: '0.2.0' }] })
  })

  it('asks about the plugins the catalog lists and hands back what moved', async () => {
    const pass = await refreshListing()

    expect(mocks.runRefreshPass).toHaveBeenCalledWith([{ name: 'camera', version: '0.1.0' }])
    expect(pass.moved).toEqual([{ pluginName: 'camera', listedVersion: '0.1.0', freshVersion: '0.2.0' }])
  })
})
