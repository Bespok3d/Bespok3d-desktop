// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom
import { expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { setup } from '../../../../test/harness'
import { PublishedKeysSection } from './PublishedKeysSection'

it('offers a missing published key from another local app and imports only after a click', async () => {
  const published = vi.fn().mockResolvedValue([{ fingerprint: 'A'.repeat(40), publicKey: 'published-public-key', label: 'Publisher', hasPrivateKey: false }])
  const localProfiles = vi.fn().mockResolvedValue(['Bespok3d Dev'])
  const importLocal = vi.fn().mockResolvedValue({})
  const onImported = vi.fn()
  const { user } = setup(<PublishedKeysSection onImported={onImported} />, { b3d: { keys: { published, localProfiles, importLocal } } })

  expect(await screen.findByText('The private key is not in this app.')).toBeInTheDocument()
  expect(localProfiles).not.toHaveBeenCalled()
  await user.click(screen.getByRole('button', { name: 'Find on this computer' }))
  await user.click(await screen.findByRole('button', { name: 'Import from Bespok3d Dev' }))

  expect(importLocal).toHaveBeenCalledWith('A'.repeat(40), 'Bespok3d Dev', 'published-public-key')
  expect(onImported).toHaveBeenCalledOnce()
})
