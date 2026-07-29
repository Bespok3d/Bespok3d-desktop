// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect } from 'vitest'
import type { ReleaseInfo } from '../git-host/connector'
import {
  updateStrategyForPlatform,
  autoInstallPayload,
  manualUpdatePayload,
  newestApplicableRelease,
  toReleaseRows,
} from './view'

function release(tag: string, body = ''): ReleaseInfo {
  return { id: tag, tag, name: tag, body, prerelease: true, publishedAt: null, url: `https://example.test/${tag}`, assets: [] }
}

describe('updateStrategyForPlatform', () => {
  it('auto-installs on the signed desktop platforms', () => {
    expect(updateStrategyForPlatform('darwin')).toBe('autoInstall')
    expect(updateStrategyForPlatform('win32')).toBe('autoInstall')
    expect(updateStrategyForPlatform('linux')).toBe('autoInstall')
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
