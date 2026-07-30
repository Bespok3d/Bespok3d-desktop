// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// The pass has to stay inside what GitHub allows an unauthenticated app while still getting the owner's
// visible listing current first. What is asserted here is therefore the order, the group size, the
// window and the cap, plus the rule that one silent repo never costs the rest of the listing its
// refresh.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { MergedEntry } from './model'

const mocks = vi.hoisted(() => ({
  askLatestRelease: vi.fn(),
  cachedRelease: vi.fn(),
  releaseAskAllowed: vi.fn(),
  repoAskedAt: vi.fn(),
}))

vi.mock('./resolve/latest-release', () => ({
  askLatestRelease: mocks.askLatestRelease,
  cachedRelease: mocks.cachedRelease,
}))

vi.mock('./resolve/release-asks', () => ({
  FRESHNESS_WINDOW_MS: 60 * 60 * 1000,
  releaseAskAllowed: mocks.releaseAskAllowed,
  repoAskedAt: mocks.repoAskedAt,
  repoKey: (repo: { owner: string, repo: string }) => `${repo.owner}/${repo.repo}`,
}))

import { runRefreshPass } from './refresh-pass'

const ONE_MINUTE_MS = 60 * 1000

function listedIn(repo: string, pluginId: string, version = '0.1.0'): MergedEntry {
  return {
    name: pluginId,
    version,
    download_url: `https://api.github.com/repos/fixture-owner/${repo}/releases/assets/1`,
    trust: 'project',
    signer: 'fixture-publisher',
    registry_url: 'https://fixture-index.invalid/index.json',
  }
}

// One plugin per repo, named so the order they were asked in is readable in a failure.
function listingOf(count: number): MergedEntry[] {
  return Array.from({ length: count }, (_, position) => listedIn(`repo-${position}`, `plugin-${position}`))
}

function askedRepoNames(): string[] {
  return mocks.askLatestRelease.mock.calls.map((call) => String(call[0].repo))
}

const inFlight = { open: 0, peak: 0 }

beforeEach(() => {
  mocks.askLatestRelease.mockReset()
  mocks.cachedRelease.mockReset()
  mocks.cachedRelease.mockReturnValue(null)
  mocks.releaseAskAllowed.mockReturnValue(true)
  mocks.repoAskedAt.mockReturnValue(null)
  inFlight.open = 0
  inFlight.peak = 0
  mocks.askLatestRelease.mockImplementation(async () => {
    inFlight.open += 1
    inFlight.peak = Math.max(inFlight.peak, inFlight.open)
    await Promise.resolve()
    inFlight.open -= 1

    return null
  })
})

describe('the refresh pass a yes starts, its order and its pace', () => {
  it('asks the repos behind the entries on screen before the rest', async () => {
    await runRefreshPass(listingOf(20), { pauseMs: 0 })

    const onScreen = Array.from({ length: 12 }, (_, position) => `repo-${position}`)

    expect(askedRepoNames().slice(0, 12)).toEqual(onScreen)
    expect(askedRepoNames()).toHaveLength(20)
  })

  it('asks about five at a time rather than the whole listing at once', async () => {
    await runRefreshPass(listingOf(20), { pauseMs: 0 })

    expect(inFlight.peak).toBe(5)
  })

  it('asks a repo once however many of the listing it publishes', async () => {
    const coRepo = [
      listedIn('u1-extras', 'idle-timeout'),
      listedIn('u1-extras', 'gcode-colors'),
      listedIn('u1-extras', 'panel-buttons'),
    ]
    await runRefreshPass(coRepo, { pauseMs: 0 })

    expect(askedRepoNames()).toEqual(['u1-extras'])
  })

  it('asks the repo behind a variant too, so the source the badge reads is not left stale', async () => {
    const withVariant: MergedEntry = {
      ...listedIn('rfid-tools', 'rfid-tools'),
      variants: [listedIn('rfid-tools', 'rfid-tools'), listedIn('rfid-fork', 'rfid-tools')],
    }
    await runRefreshPass([withVariant], { pauseMs: 0 })

    expect(askedRepoNames()).toEqual(['rfid-tools', 'rfid-fork'])
  })
})

describe('the refresh pass a yes starts and the hour it has to live within', () => {
  it('skips a repo already asked inside the freshness window', async () => {
    mocks.repoAskedAt.mockImplementation((repo: { repo: string }, now: number) =>
      repo.repo === 'repo-1' ? now - 10 * ONE_MINUTE_MS : null)
    await runRefreshPass(listingOf(3), { pauseMs: 0 })

    expect(askedRepoNames()).toEqual(['repo-0', 'repo-2'])
  })

  it('asks again once the window has passed', async () => {
    mocks.repoAskedAt.mockImplementation((_repo: unknown, now: number) => now - 61 * ONE_MINUTE_MS)
    await runRefreshPass(listingOf(3), { pauseMs: 0 })

    expect(askedRepoNames()).toEqual(['repo-0', 'repo-1', 'repo-2'])
  })

  it('stops asking the moment the hour has no requests left', async () => {
    mocks.releaseAskAllowed.mockReturnValueOnce(true).mockReturnValue(false)
    const result = await runRefreshPass(listingOf(20), { pauseMs: 0 })

    expect(askedRepoNames()).toHaveLength(5)
    expect(result.askedRepos).toBe(5)
  })
})

describe('the refresh pass a yes starts when a repo will not answer', () => {
  it('carries on through the rest of the listing', async () => {
    mocks.askLatestRelease.mockRejectedValueOnce(new Error('network')).mockResolvedValue(null)

    await expect(runRefreshPass(listingOf(6), { pauseMs: 0 })).resolves.toMatchObject({ askedRepos: 6 })
  })
})

describe('what the pass reports back about the listing', () => {
  it('names nothing when no repo has shipped anything newer', async () => {
    const result = await runRefreshPass(listingOf(3), { pauseMs: 0 })

    expect(result.moved).toEqual([])
  })

  it('names the plugin, the listed version and the fresh one when a repo has shipped newer', async () => {
    mocks.cachedRelease.mockImplementation((repo: { repo: string }) =>
      repo.repo === 'repo-1'
        ? { version: '0.2.0', downloadUrl: 'https://api.github.com/repos/fixture-owner/repo-1/releases/assets/9' }
        : null)
    const result = await runRefreshPass(listingOf(3), { pauseMs: 0 })

    expect(result.moved).toEqual([{ pluginName: 'plugin-1', listedVersion: '0.1.0', freshVersion: '0.2.0' }])
  })
})
