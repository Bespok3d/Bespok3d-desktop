// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect } from 'vitest'
import { normalizeRegistryUrl, configuredRegistryRef } from './url'

describe('normalizeRegistryUrl', () => {
  it('strips trailing slashes and lowercases', () => {
    expect(normalizeRegistryUrl('HTTPS://Host/List/')).toBe('https://host/list')
  })
})

describe('configuredRegistryRef', () => {
  it('is null when no registry repo is configured (bundled-only default)', () => {
    expect(configuredRegistryRef(undefined)).toBeNull()
  })

  it('builds a github-scheme root ref for the configured repo', () => {
    expect(configuredRegistryRef({ owner: 'unlucio', repo: 'bespok3d-org-registry' })).toEqual({
      url: 'github:unlucio/bespok3d-org-registry/index.json',
      trust: 'project',
      locked: false,
    })
  })
})
