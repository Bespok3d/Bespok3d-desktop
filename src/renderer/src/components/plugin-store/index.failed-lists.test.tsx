// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom
// A list that fails to load takes its plugins out of the store while the other lists still fill the
// grid, so the store looks complete. It has to say which list failed and what that hides.
import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { setup } from '../../test/harness'
import { makeIndexEntry, makeCatalogPayload, makePrinter } from '../../test/fixtures'
import type { SourceFailure } from '../../../../main/registry/model'
import { PluginStore } from '.'

const OTHER_LIST_PLUGIN = makeIndexEntry({ name: 'demo-a', title: 'Alpha', version: '1.0.0' })

function storeWithFailures(failures: SourceFailure[]) {
  var catalog = vi.fn().mockResolvedValue(makeCatalogPayload([OTHER_LIST_PLUGIN], { failures }))

  return setup(<PluginStore printer={makePrinter({ status: 'managed' })} grouped={false} />, { withCatalog: true, b3d: { registry: { catalog } } })
}

describe('a list that failed to load', () => {
  it('names the plugins its last good copy listed, while plugins from other lists fill the grid', async () => {
    storeWithFailures([{ url: 'github:example-org/example-list', name: 'Example List', reason: 'network', message: 'offline', lastListed: ['Camera', 'Spool Tracker'] }])

    expect(await screen.findByText('Example List did not load. It hides: Camera, Spool Tracker.')).toBeTruthy()
    expect(screen.getByText('Alpha')).toBeTruthy()
  })

  it('says the list is unreachable when no copy of it was ever saved', async () => {
    storeWithFailures([{ url: 'https://lists.example/index.json', name: 'Example Mirror', reason: 'notfound', message: 'HTTP 404', lastListed: null }])

    expect(await screen.findByText('Example Mirror is unreachable.')).toBeTruthy()
  })

  it('says the list is unreachable when its saved copy listed no plugins', async () => {
    storeWithFailures([{ url: 'https://lists.example/index.json', name: 'Example Mirror', reason: 'network', message: 'offline', lastListed: [] }])

    expect(await screen.findByText('Example Mirror is unreachable.')).toBeTruthy()
  })

  it('shows no failure line when every list loaded', async () => {
    storeWithFailures([])

    expect(await screen.findByText('Alpha')).toBeTruthy()
    expect(screen.queryByRole('status')).toBeNull()
  })
})
