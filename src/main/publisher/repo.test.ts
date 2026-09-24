// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect } from 'vitest'
import { PUBLISHER_REPO, keyFilePath, indexBucketKeyFile, MAIN_INDEX_OWNER, MAIN_INDEX_REPO } from './repo'

describe('publisher repo constants (main process)', () => {
  it('exposes the publisher repo name', () => {
    expect(PUBLISHER_REPO).toBe('bespok3d-publisher')
  })

  it('builds the key file path for a fingerprint', () => {
    expect(keyFilePath('ABCD1234')).toBe('keys/abcd1234/key.asc')
  })

  it('names the org key-bucket home and the bucket file after the lowercased account', () => {
    expect(MAIN_INDEX_OWNER).toBe('Bespok3d')
    expect(MAIN_INDEX_REPO).toBe('main-index')
    expect(indexBucketKeyFile('LixNix')).toBe('keys/lixnix-publisher.pub.asc')
  })
})
