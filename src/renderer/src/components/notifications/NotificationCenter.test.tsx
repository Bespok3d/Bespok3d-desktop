// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, within } from '@testing-library/react'
import { setup } from '../../test/harness'
import { makeCatalogPayload, makeIndexEntry } from '../../test/fixtures'
import type { IndexEntry, SourceRow } from '../../data/types'
import { NotificationCenter } from './NotificationCenter'

function authFailedSource(): SourceRow {
  return { url: 'github:Bespok3d/main-index/index.json', label: 'official', name: 'Official', trust: 'project', locked: true, enabled: true, status: 'failed', pluginCount: 0, error: 'Sign in to GitHub to load this private list', reason: 'auth' }
}

function renderCenter(sources: SourceRow[], plugins: IndexEntry[] = [], installedVersions: Record<string, string> = {}) {
  const onOpenSettings = vi.fn()
  const onOpenPlugin = vi.fn()
  const payload = makeCatalogPayload(plugins, { sources })
  const rendered = setup(
    <NotificationCenter onOpenSettings={onOpenSettings} onOpenPlugin={onOpenPlugin} installedVersions={installedVersions} />,
    { withCatalog: true, b3d: { registry: { catalog: vi.fn().mockResolvedValue(payload) } } },
  )

  return { ...rendered, onOpenSettings, onOpenPlugin }
}

beforeEach(() => localStorage.clear())

describe('NotificationCenter', () => {
  it('badges the bell and routes the sign-in action to the git host pane', async () => {
    const { user, onOpenSettings } = renderCenter([authFailedSource()])
    const bell = await screen.findByRole('button', { name: /notifications/i })
    expect(await within(bell).findByText('1')).toBeInTheDocument()
    await user.click(bell)
    await user.click(await screen.findByRole('button', { name: /sign in to github/i }))
    expect(onOpenSettings).toHaveBeenCalledWith('git-host')
  })

  it('shows an empty state and no badge when nothing needs attention', async () => {
    const ok: SourceRow = { ...authFailedSource(), status: 'ok', reason: null, error: null, pluginCount: 3 }
    const { user } = renderCenter([ok])
    const bell = await screen.findByRole('button', { name: /notifications/i })
    await user.click(bell)
    expect(await screen.findByText(/all caught up/i)).toBeInTheDocument()
    expect(within(bell).queryByText('1')).toBeNull()
  })

  it('marking a notice read clears the badge but keeps it listed', async () => {
    const { user } = renderCenter([authFailedSource()])
    const bell = await screen.findByRole('button', { name: /notifications/i })
    expect(await within(bell).findByText('1')).toBeInTheDocument()
    await user.click(bell)
    await user.click(await screen.findByRole('button', { name: /mark as read/i }))
    expect(within(bell).queryByText('1')).toBeNull()
    expect(screen.getByText(/private plugin sources/i)).toBeInTheDocument()
  })

  it('dismissing a notice removes it and reaches the empty state', async () => {
    const { user } = renderCenter([authFailedSource()])
    const bell = await screen.findByRole('button', { name: /notifications/i })
    await within(bell).findByText('1')
    await user.click(bell)
    await user.click(await screen.findByRole('button', { name: /^dismiss$/i }))
    expect(await screen.findByText(/all caught up/i)).toBeInTheDocument()
  })

  it('opens the plugin from an update notice (View plugin when it ships no changelog)', async () => {
    const { user, onOpenPlugin } = renderCenter(
      [],
      [makeIndexEntry({ name: 'spoolman', title: 'Spoolman', version: '0.2.0' })],
      { spoolman: '0.1.0' },
    )
    const bell = await screen.findByRole('button', { name: /notifications/i })
    expect(await within(bell).findByText('1')).toBeInTheDocument()
    await user.click(bell)
    await user.click(await screen.findByRole('button', { name: /view plugin/i }))
    expect(onOpenPlugin).toHaveBeenCalledWith('spoolman')
  })

  it('re-arms the auth notice on mount so a still-broken state shows unread again', async () => {
    localStorage.setItem('b3d.noticeState', JSON.stringify({ read: ['sources-need-auth'], dismissed: [], seen: {} }))
    const { user } = renderCenter([authFailedSource()])
    const bell = await screen.findByRole('button', { name: /notifications/i })
    expect(await within(bell).findByText('1')).toBeInTheDocument()
    await user.click(bell)
    expect(screen.getByText(/just now/i)).toBeInTheDocument()
  })

  it('dismiss all clears every notice at once', async () => {
    const { user } = renderCenter([authFailedSource()])
    const bell = await screen.findByRole('button', { name: /notifications/i })
    await within(bell).findByText('1')
    await user.click(bell)
    await user.click(await screen.findByRole('button', { name: /dismiss all/i }))
    expect(await screen.findByText(/all caught up/i)).toBeInTheDocument()
  })
})
