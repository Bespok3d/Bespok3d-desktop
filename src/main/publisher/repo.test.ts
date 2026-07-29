// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect } from 'vitest'
import { PUBLISHER_REPO, keyFilePath } from './repo'

describe('publisher repo constants (main process)', () => {
  it('exposes the publisher repo name', () => {
    expect(PUBLISHER_REPO).toBe('bespok3d-publisher')
  })

  it('builds the key file path for a fingerprint', () => {
    expect(keyFilePath('ABCD1234')).toBe('keys/ABCD1234/key.asc')
  })
})
