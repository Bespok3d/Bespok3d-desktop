// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect } from 'vitest'
import type { ReleaseInfo } from '../git-host/connector'
import {
  updateStrategyForPlatform,
  autoInstallPayload,
  manualUpdatePayload,
  newestApplicableRelease,
  newestChannelRelease,
  toReleaseRows,
} from './view'

function release(tag: string, body = ''): ReleaseInfo {
  return { id: tag, tag, name: tag, body, prerelease: true, publishedAt: null, url: `https://example.test/${tag}`, assets: [] }
}

describe('updateStrategyForPlatform', () => {
  it('auto-installs on the signed desktop platforms', () => {
    expect(updateStrategyForPlatform('darwin', undefined)).toBe('autoInstall')
    expect(updateStrategyForPlatform('win32', undefined)).toBe('autoInstall')
    expect(updateStrategyForPlatform('linux', undefined)).toBe('autoInstall')
  })

  it('sends a Flatpak install to the download page, because the sandbox cannot be rewritten', () => {
    expect(updateStrategyForPlatform('linux', 'io.bespok3d.app')).toBe('openDownload')
  })
})

describe('autoInstallPayload', () => {
  it('maps a string releaseNotes', () => {
    expect(autoInstallPayload({ version: '0.1.0-alpha.14', releaseNotes: 'Fixed a bug.' })).toEqual({
      version: '0.1.0-alpha.14',
      action: 'autoInstall',
      releaseNotesMarkdown: 'Fixed a bug.',
    })
  })

  it('joins an array of release notes', () => {
    const payload = autoInstallPayload({
      version: '0.1.0-alpha.14',
      releaseNotes: [
        { version: '0.1.0-alpha.14', note: 'New thing.' },
        { version: '0.1.0-alpha.13', note: 'Old thing.' },
      ],
    })
    expect(payload.releaseNotesMarkdown).toBe('New thing.\n\nOld thing.')
  })

  it('tolerates absent release notes', () => {
    expect(autoInstallPayload({ version: '0.1.0-alpha.14', releaseNotes: null }).releaseNotesMarkdown).toBe('')
  })
})

describe('manualUpdatePayload', () => {
  it('builds an openDownload payload from a release', () => {
    expect(manualUpdatePayload(release('v0.1.0-alpha.14', 'Notes here.'))).toEqual({
      version: '0.1.0-alpha.14',
      action: 'openDownload',
      releaseNotesMarkdown: 'Notes here.',
      releaseUrl: 'https://example.test/v0.1.0-alpha.14',
    })
  })
})

describe('newestApplicableRelease', () => {
  it('picks the newest release strictly newer than the installed version', () => {
    const releases = [release('v0.1.0-alpha.12'), release('v0.1.0-alpha.15'), release('v0.1.0-alpha.14')]
    expect(newestApplicableRelease(releases, '0.1.0-alpha.13')?.tag).toBe('v0.1.0-alpha.15')
  })

  it('returns null when the installed version is current', () => {
    expect(newestApplicableRelease([release('v0.1.0-alpha.13')], '0.1.0-alpha.13')).toBeNull()
  })
})

describe('newestChannelRelease', () => {
  it('keeps Live offers on the beta or bare Live line and excludes staging and legacy pre', () => {
    const candidates = [release('v0.7.8-beta-staging'), release('v0.7.8-pre'), release('v0.7.8-beta'), release('v0.7.8')]
    expect(newestChannelRelease(candidates, '0.7.7-beta', 'live')?.tag).toBe('v0.7.8-beta')
    expect(newestChannelRelease([release('v0.7.8-beta-staging')], '0.7.7-beta', 'live')).toBeNull()
    expect(newestChannelRelease([release('v1.0.0')], '0.9.9-beta', 'live')?.tag).toBe('v1.0.0')
    expect(newestChannelRelease([release('v0.7.8')], '0.7.7-beta', 'live')).toBeNull()
    expect(newestApplicableRelease([release('v0.7.8-beta-staging')], '0.7.7-beta')?.tag).toBe('v0.7.8-beta-staging')
  })

  it('offers only newer terminal staging labels to Staging and nothing to development', () => {
    const candidates = [release('v0.7.8-beta-staging'), release('v0.7.6-beta-staging'), release('v0.7.9-beta')]
    expect(newestChannelRelease(candidates, '0.7.7-beta-staging', 'staging')?.tag).toBe('v0.7.8-beta-staging')
    expect(newestChannelRelease(candidates, '0.7.9-beta-staging', 'staging')).toBeNull()
    expect(newestChannelRelease([release('v0.7.8-staging')], '0.7.7-beta-staging', 'staging')?.tag).toBe('v0.7.8-staging')
    expect(newestChannelRelease(candidates, '0.7.7-beta', 'development')).toBeNull()
  })

  it('uses the same Staging candidate on macOS, Windows and Linux auto-install paths', () => {
    const stagingReleases = [release('v0.7.8-beta-staging'), release('v0.7.9-beta')]
    const platforms: NodeJS.Platform[] = ['darwin', 'win32', 'linux']
    platforms.forEach((platform) => {
      expect(updateStrategyForPlatform(platform, undefined)).toBe('autoInstall')
      expect(newestChannelRelease(stagingReleases, '0.7.7-beta-staging', 'staging')?.tag).toBe('v0.7.8-beta-staging')
    })
  })
})

describe('toReleaseRows', () => {
  it('orders releases newest first and flags the installed one', () => {
    const rows = toReleaseRows(
      [release('v0.1.0-alpha.12'), release('v0.1.0-alpha.14'), release('v0.1.0-alpha.13')],
      '0.1.0-alpha.13',
    )
    expect(rows.map((row) => row.tag)).toEqual(['v0.1.0-alpha.14', 'v0.1.0-alpha.13', 'v0.1.0-alpha.12'])
    expect(rows.map((row) => row.isCurrent)).toEqual([false, true, false])
    expect(rows[0].version).toBe('0.1.0-alpha.14')
  })
})
