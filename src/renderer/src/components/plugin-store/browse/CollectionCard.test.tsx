// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { setup } from '../../../test/harness'
import { makeCollection, makePlugin } from '../../../test/fixtures'
import { CollectionCard } from './CollectionCard'

const MEMBERS = [
  makePlugin({ id: 'a', name: 'a' }),
  makePlugin({ id: 'b', name: 'b' }),
  makePlugin({ id: 'c', name: 'c' }),
]
const COLLECTION = makeCollection({
  id: 'all-the-tags', name: 'all-the-tags', title: 'All the Tags',
  members: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
})

describe('CollectionCard', () => {
  it('shows the member count and how many are already installed', () => {
    setup(<CollectionCard collection={COLLECTION} plugins={MEMBERS} installedIds={['a']} onOpen={vi.fn()} />)
    expect(screen.getByText('3 plugins')).toBeInTheDocument()
    expect(screen.getByText('1 of 3 installed')).toBeInTheDocument()
  })

  it('marks the tile installed only when every member is on the printer', () => {
    const { rerender } = setup(<CollectionCard collection={COLLECTION} plugins={MEMBERS} installedIds={['a', 'b']} onOpen={vi.fn()} />)
    expect(screen.queryByText('Installed')).toBeNull()
    rerender(<CollectionCard collection={COLLECTION} plugins={MEMBERS} installedIds={['a', 'b', 'c']} onOpen={vi.fn()} />)
    expect(screen.getByText('Installed')).toBeInTheDocument()
  })

  it('opens the detail on click', async () => {
    const onOpen = vi.fn()
    const { user } = setup(<CollectionCard collection={COLLECTION} plugins={MEMBERS} installedIds={[]} onOpen={onOpen} />)
    await user.click(screen.getByText('All the Tags'))
    expect(onOpen).toHaveBeenCalled()
  })
})
