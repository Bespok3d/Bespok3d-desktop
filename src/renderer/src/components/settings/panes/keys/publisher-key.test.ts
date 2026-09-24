// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it, vi } from 'vitest'
import type { KeyRecord } from '../../../../data/keyTypes'
import { publishPublisherKey, publishedKeyState, type PublisherKeyApi } from './publisher-key'

const publisherKey: KeyRecord = {
  id: 'fixture-key',
  label: 'Disposable publisher',
  isDefault: false,
  assignments: [],
  type: 'openpgp',
  fingerprint: 'fixture-fingerprint',
  fingerprintShort: 'fixture-short',
  publicKey: 'fixture-public-key',
  addedAt: '2026-09-23',
}

describe('publishPublisherKey', () => {
  it('does not record publication when GitHub rejects the public-key write', async () => {
    const api: PublisherKeyApi = {
      gitHost: {
        listRepos: vi.fn().mockResolvedValue([{ owner: 'fixture-publisher', repo: 'bespok3d-publisher' }]),
        createRepo: vi.fn(),
        getFile: vi.fn().mockResolvedValue(null),
        putFile: vi.fn().mockRejectedValue(new Error('GitHub rejected write')),
      },
      keys: {
        list: vi.fn().mockResolvedValue([publisherKey]),
        setPublishedAt: vi.fn(),
      },
    }

    await expect(publishPublisherKey(publisherKey, 'fixture-publisher', api)).rejects.toThrow('GitHub rejected write')
    expect(api.gitHost.putFile).toHaveBeenCalledWith(
      'fixture-publisher', 'bespok3d-publisher', 'keys/fixture-fingerprint/key.asc',
      publisherKey.publicKey, 'Publish signing key fixture-short', undefined,
    )
    expect(api.keys.setPublishedAt).not.toHaveBeenCalled()
  })
})

describe('publishedKeyState', () => {
  it('reports matched only when the published bytes are this public key', () => {
    expect(publishedKeyState('fixture-public-key', 'fixture-public-key')).toBe('matched')
  })

  it('reports mismatch when some other file sits at the key path', () => {
    expect(publishedKeyState('someone-elses-key', 'fixture-public-key')).toBe('mismatch')
  })

  it('reports absent when nothing is published there', () => {
    expect(publishedKeyState(null, 'fixture-public-key')).toBe('absent')
  })
})
