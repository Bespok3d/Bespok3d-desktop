// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it, vi } from 'vitest'
import * as openpgp from 'openpgp'

const host = vi.hoisted(() => ({ connected: true, account: { login: 'example-publisher', name: 'Publisher' }, files: new Map<string, string>() }))
vi.mock('../git-host', () => ({ readSettings: () => ({ type: 'github' }), activeConnector: () => ({
  isConnected: () => Promise.resolve(host.connected), getAccount: () => Promise.resolve(host.account),
  getFile: (_repo: unknown, path: string) => Promise.resolve(host.files.has(path) ? { content: host.files.get(path)! } : null),
}) }))
vi.mock('../keys', () => ({ hasMatchingPrivateKey: () => Promise.resolve(false) }))

import { listPublishedAccountKeys } from './published-keys'

describe('connected account publisher keys', () => {
  it('discovers public keys with their own fingerprint but never claims to have the private half', async () => {
    const generated = await openpgp.generateKey({ type: 'ecc', curve: 'nistP521', userIDs: [{ name: 'Publisher' }] })
    const fingerprint = (await openpgp.readKey({ armoredKey: generated.publicKey })).getFingerprint().toUpperCase()
    host.files.clear()
    host.files.set('README.md', `| Publisher | 2026-01-01 | [${fingerprint}](keys/${fingerprint.toLowerCase()}/key.asc) |`)
    host.files.set(`keys/${fingerprint.toLowerCase()}/key.asc`, generated.publicKey)

    expect(await listPublishedAccountKeys()).toEqual([expect.objectContaining({ fingerprint, publicKey: generated.publicKey, hasPrivateKey: false })])
  })

  it('shows no account keys when signed out', async () => {
    host.connected = false
    expect(await listPublishedAccountKeys()).toEqual([])
    host.connected = true
  })
})
