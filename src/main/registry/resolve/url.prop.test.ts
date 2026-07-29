// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { normalizeRegistryUrl } from './url'

describe('normalizeRegistryUrl properties', () => {
  it('is idempotent, lower-cased, and never keeps a trailing slash', () => {
    fc.assert(fc.property(fc.string(), (url) => {
      const normalized = normalizeRegistryUrl(url)
      expect(normalizeRegistryUrl(normalized)).toBe(normalized)
      expect(normalized).toBe(normalized.toLowerCase())
      expect(normalized.endsWith('/')).toBe(false)
    }))
  })
})
