// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect } from 'vitest'
import { autoUpdateFeed } from './feed'

describe('autoUpdateFeed', () => {
  it('is null when no app repo is configured (auto-update disabled by default)', () => {
    expect(autoUpdateFeed(undefined, 'tok')).toBeNull()
  })

  it('is null when there is no token (cannot reach private release assets)', () => {
    expect(autoUpdateFeed({ owner: 'unlucio', repo: 'bespok3d-app' }, null)).toBeNull()
  })

  it('builds a private github feed when both repo and token are present', () => {
    expect(autoUpdateFeed({ owner: 'unlucio', repo: 'bespok3d-app' }, 'tok')).toEqual({
      provider: 'github', owner: 'unlucio', repo: 'bespok3d-app', private: true, token: 'tok',
    })
  })
})
