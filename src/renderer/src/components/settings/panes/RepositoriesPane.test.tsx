// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import { setup } from '../../../test/harness'
import { makeCatalogPayload } from '../../../test/fixtures'
import type { SourceRow } from '../../../data/types'
import { RepositoriesPane } from './RepositoriesPane'

function source(overrides: Partial<SourceRow>): SourceRow {
  return { url: 'github:Bespok3d/main-index', label: 'official', name: 'Official', trust: 'project', locked: true, enabled: true, status: 'ok', pluginCount: 5, error: null, reason: null, ...overrides }
}

function renderPane() {
  var payload = makeCatalogPayload([], {
    sources: [source({}), source({ url: 'github:other/repo', label: 'other', name: 'Other', trust: 'community', locked: false, pluginCount: 2 })],
  })

  return setup(<RepositoriesPane />, { withCatalog: true, b3d: { registry: { catalog: vi.fn().mockResolvedValue(payload) } } })
}

describe('RepositoriesPane', () => {
  it('toggles a source on and off through setSourceEnabled', async () => {
    var { user, b3d } = renderPane()
    var otherRow = (await screen.findByText('Other')).closest('.repo-row') as HTMLElement
    await user.click(within(otherRow).getByRole('switch'))
    expect(b3d.registry.setSourceEnabled).toHaveBeenCalledWith('github:other/repo', false)
  })

  it('lists the official source as locked', async () => {
    renderPane()
    expect(await screen.findByText('Official')).toBeInTheDocument()
  })

  it('lets the locked official source be toggled off (togglable, even when locked)', async () => {
    var { user, b3d } = renderPane()
    var officialRow = (await screen.findByText('Official')).closest('.repo-row') as HTMLElement
    expect(within(officialRow).getByText(/locked/i)).toBeInTheDocument()
    await user.click(within(officialRow).getByRole('switch'))
    expect(b3d.registry.setSourceEnabled).toHaveBeenCalledWith('github:Bespok3d/main-index', false)
  })

  it('offers no per-source remove control (sources are not removable, only toggled)', async () => {
    renderPane()
    await screen.findByText('Official')
    expect(screen.queryByRole('button', { name: /remove|delete/i })).toBeNull()
    expect(screen.getByRole('button', { name: /add/i })).toBeDisabled()
  })

  it('persists the chosen primary channel through settings.set', async () => {
    var { user, b3d } = renderPane()
    var ltsRow = (await screen.findByText('LTS')).closest('.repo-chan-row') as HTMLElement
    await user.click(within(ltsRow).getByRole('button', { name: /set primary/i }))
    expect(b3d.settings.set).toHaveBeenCalledWith({ primaryReleaseChannel: 'lts' })
  })

  it('opts a within-ceiling channel out through setChannelEnabled', async () => {
    var { user, b3d } = renderPane()
    var ltsRow = (await screen.findByText('LTS')).closest('.repo-chan-row') as HTMLElement
    await user.click(within(ltsRow).getByRole('switch'))
    expect(b3d.registry.setChannelEnabled).toHaveBeenCalledWith('lts', false)
  })

  it('offers a GitHub sign-in on a source that failed for lack of access', async () => {
    var onConnectGitHub = vi.fn()
    var payload = makeCatalogPayload([], {
      sources: [source({ status: 'failed', reason: 'auth', error: 'Sign in to GitHub to load this private list' })],
    })
    var { user } = setup(<RepositoriesPane onConnectGitHub={onConnectGitHub} />, {
      withCatalog: true,
      b3d: { registry: { catalog: vi.fn().mockResolvedValue(payload) } },
    })
    await user.click(await screen.findByRole('button', { name: /sign in to github/i }))
    expect(onConnectGitHub).toHaveBeenCalled()
  })

  it('names a missing tier index and does not call an un-fetched source unsigned', async () => {
    const tierUrl = 'github:Bespok3d/main-index/index.json?ref=dev'
    const payload = makeCatalogPayload([], {
      sources: [source({
        url: tierUrl, label: tierUrl, name: 'Bespok3d Official prerelease', status: 'failed',
        reason: 'notfound', error: 'HTTP 404: dev index not found',
      })],
    })
    setup(<RepositoriesPane />, { withCatalog: true, b3d: {
      registry: { catalog: vi.fn().mockResolvedValue(payload) }, gitHost: { isConnected: vi.fn().mockResolvedValue(true) },
    } })
    const row = (await screen.findByText('Bespok3d Official prerelease')).closest('.repo-row') as HTMLElement

    expect(within(row).queryByText(tierUrl)).toBeNull()
    expect(within(row).getByText('The development index has not been published yet.')).toBeInTheDocument()
    expect(within(row).queryByRole('button', { name: /sign in to github/i })).toBeNull()
    expect(within(row).queryByText(/unsigned|project/i)).toBeNull()
  })

  it('does not present configured trust as verified while a source is disabled', async () => {
    const disabledSource = source({ status: 'disabled', enabled: false })
    const payload = makeCatalogPayload([], { sources: [disabledSource] })
    setup(<RepositoriesPane />, { withCatalog: true, b3d: { registry: { catalog: vi.fn().mockResolvedValue(payload) } } })
    const row = (await screen.findByText(disabledSource.name)).closest('.repo-row') as HTMLElement

    expect(within(row).queryByText(/project|unsigned|community/i)).toBeNull()
  })
})

describe('a connected account with a failed source', () => {
  it('never sends the user back to Git Host for another source access failure', async () => {
    const payload = makeCatalogPayload([], {
      sources: [source({ status: 'failed', reason: 'auth', error: 'Access denied' })],
    })
    setup(<RepositoriesPane />, { withCatalog: true, b3d: {
      registry: { catalog: vi.fn().mockResolvedValue(payload) }, gitHost: { isConnected: vi.fn().mockResolvedValue(true) },
    } })

    expect(await screen.findByText('Access denied')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /sign in to github/i })).toBeNull()
  })

})
