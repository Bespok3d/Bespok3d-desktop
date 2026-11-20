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

const RUNNING_STAMP = 1000

describe('isRebuildOfInstalled', () => {
  const installed = { version: '1.0.0-staging.1', digest: buildDigest(publishedBuild('1.0.0-staging.1', 'first-build')), executableStamp: RUNNING_STAMP }

  it('offers a rebuild published under the running version', () => {
    expect(isRebuildOfInstalled(publishedBuild('1.0.0-staging.1', 'second-build'), '1.0.0-staging.1', installed, RUNNING_STAMP)).toBe(true)
  })

  it('does not offer the very build that is installed', () => {
    expect(isRebuildOfInstalled(publishedBuild('1.0.0-staging.1', 'first-build'), '1.0.0-staging.1', installed, RUNNING_STAMP)).toBe(false)
  })

  it('leaves another version to the version comparison', () => {
    expect(isRebuildOfInstalled(publishedBuild('1.0.1', 'second-build'), '1.0.0-staging.1', installed, RUNNING_STAMP)).toBe(false)
  })

  it('does not offer anything when this version has no recorded build', () => {
    expect(isRebuildOfInstalled(publishedBuild('1.0.0-staging.1', 'second-build'), '1.0.0-staging.1', undefined, RUNNING_STAMP)).toBe(false)
    expect(isRebuildOfInstalled(publishedBuild('1.0.0-staging.1', 'second-build'), '1.0.0-staging.1', { ...installed, version: '0.9.0' }, RUNNING_STAMP)).toBe(false)
  })

  it('does not offer anything while no stamp tells which build runs', () => {
    expect(isRebuildOfInstalled(publishedBuild('1.0.0-staging.1', 'second-build'), '1.0.0-staging.1', installed, undefined)).toBe(false)
    expect(isRebuildOfInstalled(publishedBuild('1.0.0-staging.1', 'second-build'), '1.0.0-staging.1', { ...installed, executableStamp: undefined }, undefined)).toBe(false)
  })

  it('does not offer the running build again when its record was taken on another executable', () => {
    const recordedBeforeHandInstall = { version: '1.0.0-staging.1', digest: buildDigest(publishedBuild('1.0.0-staging.1', 'old-build')) }
    expect(isRebuildOfInstalled(publishedBuild('1.0.0-staging.1', 'running-build'), '1.0.0-staging.1', recordedBeforeHandInstall, RUNNING_STAMP)).toBe(false)
    expect(isRebuildOfInstalled(publishedBuild('1.0.0-staging.1', 'running-build'), '1.0.0-staging.1', { ...recordedBeforeHandInstall, executableStamp: 500 }, RUNNING_STAMP)).toBe(false)
  })
})

describe('firstBuildRecord', () => {
  it('records the published build of the running version when none is recorded', () => {
    const published = publishedBuild('1.0.0', 'first-build')
    const expected = { version: '1.0.0', digest: buildDigest(published), executableStamp: RUNNING_STAMP }
    expect(firstBuildRecord(published, '1.0.0', undefined, RUNNING_STAMP)).toEqual(expected)
    expect(firstBuildRecord(published, '1.0.0', { version: '0.9.0', digest: 'old', executableStamp: RUNNING_STAMP }, RUNNING_STAMP)).toEqual(expected)
  })

  it('keeps an existing record of the running build', () => {
    expect(firstBuildRecord(publishedBuild('1.0.0', 'second-build'), '1.0.0', { version: '1.0.0', digest: 'first', executableStamp: RUNNING_STAMP }, RUNNING_STAMP)).toBeNull()
  })

  it('replaces a record taken on another executable, or saved before records carried one', () => {
    const published = publishedBuild('1.0.0', 'running-build')
    const expected = { version: '1.0.0', digest: buildDigest(published), executableStamp: RUNNING_STAMP }
    expect(firstBuildRecord(published, '1.0.0', { version: '1.0.0', digest: 'old', executableStamp: 500 }, RUNNING_STAMP)).toEqual(expected)
    expect(firstBuildRecord(published, '1.0.0', { version: '1.0.0', digest: 'old' }, RUNNING_STAMP)).toEqual(expected)
  })

  it('records nothing while no stamp tells which build runs', () => {
    expect(firstBuildRecord(publishedBuild('1.0.0', 'build'), '1.0.0', undefined, undefined)).toBeNull()
  })

  it('records nothing from another version', () => {
    expect(firstBuildRecord(publishedBuild('1.0.1', 'build'), '1.0.0', undefined, RUNNING_STAMP)).toBeNull()
  })
})

describe('landedBuild', () => {
  const pending = { version: '1.0.0', digest: 'rebuild-digest', executableStamp: 1000 }

  it('is the downloaded build, stamped with the new executable, once the app runs it', () => {
    expect(landedBuild(pending, '1.0.0', 2000)).toEqual({ version: '1.0.0', digest: 'rebuild-digest', executableStamp: 2000 })
  })

  it('is none while the executable that downloaded it still runs', () => {
    expect(landedBuild(pending, '1.0.0', 1000)).toBeNull()
  })

  it('is none when the app runs another version or nothing waits', () => {
    expect(landedBuild(pending, '1.0.1', 2000)).toBeNull()
    expect(landedBuild(undefined, '1.0.0', 2000)).toBeNull()
    expect(landedBuild(pending, '1.0.0', undefined)).toBeNull()
  })
})
