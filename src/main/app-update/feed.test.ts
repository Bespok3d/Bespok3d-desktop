// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { autoUpdateFeed } from './feed'

const UPDATE_READER_SOURCE = readFileSync(join(__dirname, 'index.ts'), 'utf8')

describe('autoUpdateFeed', () => {
  it('is null when no app repo is configured (auto-update disabled by default)', () => {
    expect(autoUpdateFeed(undefined, 'v0.7.7-beta')).toBeNull()
  })

  // The bug this replaces: signed out, the feed came back null and the app never checked at all.
  it('arms updates for a signed-out user, with no token and never declared private', () => {
    expect(autoUpdateFeed({ owner: 'unlucio', repo: 'bespok3d-app' }, 'v0.7.8-beta-staging')).toEqual({
      provider: 'generic', url: 'https://github.com/unlucio/bespok3d-app/releases/download/v0.7.8-beta-staging/',
    })
  })

  it('uses the public tagged release asset directory and does not use the GitHub tag walker or API', () => {
    const feed = autoUpdateFeed({ owner: 'Bespok3d', repo: 'Bespok3d-desktop' }, 'v0.7.7-beta-staging')
    expect(feed?.url).toBe('https://github.com/Bespok3d/Bespok3d-desktop/releases/download/v0.7.7-beta-staging/')
    expect(UPDATE_READER_SOURCE).toContain('autoUpdater.channel = APP_CHANNEL.updateChannel')
    expect(UPDATE_READER_SOURCE).not.toContain('GitHubProvider')
    expect(UPDATE_READER_SOURCE).not.toContain('api.github.com')
  })
})
