// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect } from 'vitest'
import { autoUpdateFeed } from './feed'

describe('autoUpdateFeed', () => {
  it('is null when no app repo is configured (auto-update disabled by default)', () => {
    expect(autoUpdateFeed(undefined)).toBeNull()
  })

  // The bug this replaces: signed out, the feed came back null and the app never checked at all.
  it('arms updates for a signed-out user, with no token and never declared private', () => {
    expect(autoUpdateFeed({ owner: 'unlucio', repo: 'bespok3d-app' })).toEqual({
      provider: 'github', owner: 'unlucio', repo: 'bespok3d-app',
    })
  })
})
