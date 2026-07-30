// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { setup } from '../../test/harness'
import { makeT } from '../../i18n'
import { makeIndexEntry, makePrinter, makeCapabilities, makeCatalogPayload } from '../../test/fixtures'
import type { SourceRow } from '../../data/types'
import { PluginStore } from '.'

const en = makeT('en')

function catalog() {
  return [
    makeIndexEntry({ name: 'demo-a', title: 'Alpha', category: 'tuning', published_at: '2026-03-01', updated_at: '2026-01-01' }),
    makeIndexEntry({ name: 'demo-b', title: 'Beta', category: 'sensors', published_at: '2026-01-01', updated_at: '2026-03-01' }),
    makeIndexEntry({ name: 'demo-c', title: 'Gamma', category: 'tuning', published_at: '2026-02-01', updated_at: '2026-02-01' }),
  ]
}

function cardTitles(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('.card-title')).map((node) => node.textContent ?? '')
}

function updatedSortChip(): HTMLElement {
  return screen.getByRole('button', { name: en('sort.updated') })
}

function renderStore(installed: Record<string, string> = {}) {
  return setup(
    <PluginStore printer={makePrinter({ status: 'managed' })} grouped={false} />,
    { withCatalog: true, catalog: catalog(), b3d: { store: { capabilities: vi.fn().mockResolvedValue(makeCapabilities(installed)) } } },
  )
}

describe('PluginStore filtering', () => {
  it('shows the full catalog, then narrows by search', async () => {
    var { user } = renderStore()
    await screen.findByText('Alpha')
    expect(screen.getByText('Beta')).toBeInTheDocument()
    expect(screen.getByText('Gamma')).toBeInTheDocument()

    await user.type(screen.getByPlaceholderText(en('filter.search')), 'Beta')
    expect(screen.getByText('Beta')).toBeInTheDocument()
    expect(screen.queryByText('Alpha')).not.toBeInTheDocument()
    expect(screen.queryByText('Gamma')).not.toBeInTheDocument()
  })

  it('filters by category', async () => {
    var { user } = renderStore()
    await screen.findByText('Alpha')
    await user.click(screen.getByRole('button', { name: en('filter.filters') }))
    await user.click(screen.getByRole('button', { name: en('cat.tuning') }))

    expect(screen.getByText('Alpha')).toBeInTheDocument()
    expect(screen.getByText('Gamma')).toBeInTheDocument()
    expect(screen.queryByText('Beta')).not.toBeInTheDocument()
  })

  it('filters to installed plugins from live capabilities', async () => {
    var { user } = renderStore({ 'demo-a': '1.0.0' })
    await screen.findByText('Alpha')
    await user.click(screen.getByRole('button', { name: en('filter.filters') }))
    await user.click(screen.getByRole('button', { name: en('filter.installed') }))

    expect(await screen.findByText('Alpha')).toBeInTheDocument()
    expect(screen.queryByText('Beta')).not.toBeInTheDocument()
    expect(screen.queryByText('Gamma')).not.toBeInTheDocument()
  })

  it('keeps installed plugins recognized from the record when the live capabilities fetch fails', async () => {
    // Regression: a failed /capabilities used to blank the installed set, so every plugin showed as
    // not-installed even though the printer reported them. A failure must fall back to the record.
    const printer = makePrinter({ status: 'managed', installedIds: ['demo-a'], installedVersions: { 'demo-a': '1.0.0' } })
    var { user } = setup(
      <PluginStore printer={printer} grouped={false} />,
      { withCatalog: true, catalog: catalog(), b3d: { store: { capabilities: vi.fn().mockRejectedValue(new Error('daemon unreachable')) } } },
    )
    await screen.findByText('Alpha')
    await user.click(screen.getByRole('button', { name: en('filter.filters') }))
    await user.click(screen.getByRole('button', { name: en('filter.installed') }))

    expect(await screen.findByText('Alpha')).toBeInTheDocument()
    expect(screen.queryByText('Beta')).not.toBeInTheDocument()
  })
})

describe('PluginStore plugin shelf', () => {
  it('titles the flat list and counts what is showing', async () => {
    var { user } = renderStore()
    await screen.findByText('Alpha')
    expect(screen.getByText(en('store.plugins.section_title'))).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()

    await user.type(screen.getByPlaceholderText(en('filter.search')), 'Beta')
    expect(screen.getByText('1')).toBeInTheDocument()
  })
})

describe('PluginStore sorting', () => {
  it('orders by name ascending by default and re-orders on the Updated sort', async () => {
    var { user, container } = renderStore()
    await screen.findByText('Alpha')
    expect(cardTitles(container)).toEqual(['Alpha', 'Beta', 'Gamma'])

    await user.click(screen.getByRole('button', { name: en('filter.filters') }))
    await user.click(updatedSortChip())
    expect(cardTitles(container)).toEqual(['Beta', 'Gamma', 'Alpha'])

    await user.click(updatedSortChip())
    expect(cardTitles(container)).toEqual(['Alpha', 'Gamma', 'Beta'])
  })
})

describe('PluginStore refresh', () => {
  it('re-fetches the catalog when the refresh button is clicked', async () => {
    var { user, b3d } = renderStore()
    var catalogFn = vi.mocked(b3d.registry.catalog)
    await screen.findByText('Alpha')
    await user.click(screen.getByRole('button', { name: en('store.refresh') }))
    expect(catalogFn.mock.calls.length).toBeGreaterThanOrEqual(2)
  })
})

describe('PluginStore empty state', () => {
  it('warns and offers GitHub sign-in when the catalog is empty because a source is private', async () => {
    var onConnectGitHub = vi.fn()
    var authSource: SourceRow = { url: 'github:Bespok3d/main-index/index.json', label: 'official', name: 'Official', trust: 'project', locked: true, enabled: true, status: 'failed', pluginCount: 0, error: 'private', reason: 'auth' }
    var payload = makeCatalogPayload([], { sources: [authSource] })
    var { user } = setup(
      <PluginStore printer={makePrinter({ status: 'managed' })} grouped={false} onConnectGitHub={onConnectGitHub} />,
      { withCatalog: true, b3d: { registry: { catalog: vi.fn().mockResolvedValue(payload) }, store: { capabilities: vi.fn().mockResolvedValue(makeCapabilities({})) } } },
    )
    await user.click(await screen.findByRole('button', { name: /sign in to github/i }))
    expect(onConnectGitHub).toHaveBeenCalled()
  })
})
