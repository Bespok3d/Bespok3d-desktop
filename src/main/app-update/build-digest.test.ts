// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect } from 'vitest'
import { buildDigest, firstBuildRecord, isRebuildOfInstalled, landedBuild } from './build-digest'

function publishedBuild(version: string, ...fileDigests: string[]) {
  return { version, files: fileDigests.map((sha512) => ({ url: `app-${sha512}.zip`, sha512 })) }
}

describe('buildDigest', () => {
  it('does not depend on the order the feed lists the files in', () => {
    expect(buildDigest(publishedBuild('1.0.0', 'zip-a', 'dmg-b'))).toBe(buildDigest(publishedBuild('1.0.0', 'dmg-b', 'zip-a')))
  })
})

describe('isRebuildOfInstalled', () => {
  const installed = { version: '1.0.0-staging.1', digest: buildDigest(publishedBuild('1.0.0-staging.1', 'first-build')) }

  it('offers a rebuild published under the running version', () => {
    expect(isRebuildOfInstalled(publishedBuild('1.0.0-staging.1', 'second-build'), '1.0.0-staging.1', installed)).toBe(true)
  })

  it('does not offer the very build that is installed', () => {
    expect(isRebuildOfInstalled(publishedBuild('1.0.0-staging.1', 'first-build'), '1.0.0-staging.1', installed)).toBe(false)
  })

  it('leaves another version to the version comparison', () => {
    expect(isRebuildOfInstalled(publishedBuild('1.0.1', 'second-build'), '1.0.0-staging.1', installed)).toBe(false)
  })

  it('does not offer anything when this version has no recorded build', () => {
    expect(isRebuildOfInstalled(publishedBuild('1.0.0-staging.1', 'second-build'), '1.0.0-staging.1', undefined)).toBe(false)
    expect(isRebuildOfInstalled(publishedBuild('1.0.0-staging.1', 'second-build'), '1.0.0-staging.1', { ...installed, version: '0.9.0' })).toBe(false)
  })
})

describe('firstBuildRecord', () => {
  it('records the published build of the running version when none is recorded', () => {
    const published = publishedBuild('1.0.0', 'first-build')
    expect(firstBuildRecord(published, '1.0.0', undefined)).toEqual({ version: '1.0.0', digest: buildDigest(published) })
    expect(firstBuildRecord(published, '1.0.0', { version: '0.9.0', digest: 'old' })).toEqual({ version: '1.0.0', digest: buildDigest(published) })
  })

  it('keeps an existing record of the running version', () => {
    expect(firstBuildRecord(publishedBuild('1.0.0', 'second-build'), '1.0.0', { version: '1.0.0', digest: 'first' })).toBeNull()
  })

  it('records nothing from another version', () => {
    expect(firstBuildRecord(publishedBuild('1.0.1', 'build'), '1.0.0', undefined)).toBeNull()
  })
})

describe('landedBuild', () => {
  const pending = { version: '1.0.0', digest: 'rebuild-digest', executableStamp: 1000 }

  it('is the downloaded build once the app runs a new executable of its version', () => {
    expect(landedBuild(pending, '1.0.0', 2000)).toEqual({ version: '1.0.0', digest: 'rebuild-digest' })
  })

  it('is none while the executable that downloaded it still runs', () => {
    expect(landedBuild(pending, '1.0.0', 1000)).toBeNull()
  })

  it('is none when the app runs another version or nothing waits', () => {
    expect(landedBuild(pending, '1.0.1', 2000)).toBeNull()
    expect(landedBuild(undefined, '1.0.0', 2000)).toBeNull()
  })
})
