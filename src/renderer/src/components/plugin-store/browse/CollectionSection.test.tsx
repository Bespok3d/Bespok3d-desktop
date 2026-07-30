// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import { setup } from '../../../test/harness'
import { makeT } from '../../../i18n'
import { makeCollection, makePlugin } from '../../../test/fixtures'
import { CollectionSection } from './CollectionSection'

const en = makeT('en')

const MEMBERS = [makePlugin({ id: 'rfid-ntag', name: 'rfid-ntag', title: 'RFID Reader' })]
const COLLECTIONS = [
  makeCollection({ id: 'all-the-tags', name: 'all-the-tags', title: 'All the Tags', members: [{ id: 'rfid-ntag' }] }),
]

function renderShelf() {
  return setup(<CollectionSection collections={COLLECTIONS} plugins={MEMBERS} installedIds={[]} onOpen={vi.fn()} />)
}

describe('CollectionSection folding', () => {
  beforeEach(() => localStorage.clear())

  it('starts open and folds the tiles away on the arrow', async () => {
    const { user } = renderShelf()
    expect(screen.getByText('All the Tags')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: en('store.section.collapse') }))
    expect(screen.queryByText('All the Tags')).toBeNull()
    expect(screen.getByText(en('collection.section_title'))).toBeInTheDocument()
  })

  it('remembers the folded shelf across a remount', async () => {
    const { user, unmount } = renderShelf()
    await user.click(screen.getByRole('button', { name: en('store.section.collapse') }))
    unmount()

    renderShelf()
    expect(screen.queryByText('All the Tags')).toBeNull()
    expect(screen.getByRole('button', { name: en('store.section.expand') })).toBeInTheDocument()
  })
})
