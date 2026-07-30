// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// The allowance belongs to the address, not to this process: sixty requests an hour, twenty two of them
// already spent on the published lists at every launch. So what matters here is that the ledger counts
// what was really asked, forgets it after the hour, and survives a second launch inside that hour.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { PublishingRepo } from './publishing-repo'

const mocks = vi.hoisted(() => ({ files: new Map<string, string>(), writeFileSync: vi.fn() }))

vi.mock('fs', () => ({
  readFileSync: (path: string) => {
    const stored = mocks.files.get(path)
    if (stored === undefined) throw new Error('ENOENT')

    return stored
  },
  writeFileSync: mocks.writeFileSync,
}))

vi.mock('../../app-paths', () => ({ userDataPath: (name: string) => `/fixture-user-data/${name}` }))

import { lastReleaseAskAt, recordReleaseAsk, releaseAskAllowed, repoAskedAt } from './release-asks'

const LEDGER = '/fixture-user-data/release-asks.json'
const ONE_MINUTE_MS = 60 * 1000
const NOW = 1_800_000_000_000
const REPO: PublishingRepo = { owner: 'fixture-owner', repo: 'rfid-tools' }
const OTHER_REPO: PublishingRepo = { owner: 'fixture-owner', repo: 'u1-extras' }

function ledgerHolding(asks: Array<{ repo: string, at: number }>): void {
  mocks.files.set(LEDGER, JSON.stringify(asks))
}

function asksAgo(count: number, minutesAgo: number): Array<{ repo: string, at: number }> {
  return Array.from({ length: count }, (_, position) => ({
    repo: `fixture-owner/repo-${position}`,
    at: NOW - minutesAgo * ONE_MINUTE_MS,
  }))
}

function written(): Array<{ repo: string, at: number }> {
  return JSON.parse(String(mocks.writeFileSync.mock.calls[0][1])) as Array<{ repo: string, at: number }>
}

beforeEach(() => {
  mocks.files.clear()
  mocks.writeFileSync.mockReset()
})

describe('the hour cap on release asks', () => {
  it('allows an ask when nothing has been asked yet', () => {
    expect(releaseAskAllowed(NOW)).toBe(true)
  })

  it('allows an ask while the hour still has room', () => {
    ledgerHolding(asksAgo(19, 5))

    expect(releaseAskAllowed(NOW)).toBe(true)
  })

  it('refuses once twenty have been asked inside the hour', () => {
    ledgerHolding(asksAgo(20, 5))

    expect(releaseAskAllowed(NOW)).toBe(false)
  })

  it('counts what a previous launch asked, because the allowance belongs to the address', () => {
    ledgerHolding(asksAgo(20, 50))

    expect(releaseAskAllowed(NOW)).toBe(false)
  })

  it('forgets asks older than the hour', () => {
    ledgerHolding(asksAgo(30, 61))

    expect(releaseAskAllowed(NOW)).toBe(true)
  })

  it('reads a ledger that is not a list as an empty one rather than failing the pass', () => {
    mocks.files.set(LEDGER, '{"corrupt": true}')

    expect(releaseAskAllowed(NOW)).toBe(true)
  })
})

describe('recording an ask', () => {
  it('keeps the repo it was about and when it happened', () => {
    recordReleaseAsk(REPO, NOW)

    expect(written()).toEqual([{ repo: 'fixture-owner/rfid-tools', at: NOW }])
  })

  it('drops the asks that have aged out as it writes, so the file cannot grow without bound', () => {
    ledgerHolding([...asksAgo(3, 90), { repo: 'fixture-owner/u1-extras', at: NOW - ONE_MINUTE_MS }])
    recordReleaseAsk(REPO, NOW)

    expect(written()).toEqual([
      { repo: 'fixture-owner/u1-extras', at: NOW - ONE_MINUTE_MS },
      { repo: 'fixture-owner/rfid-tools', at: NOW },
    ])
  })

  it('leaves the pass running when the ledger cannot be written', () => {
    mocks.writeFileSync.mockImplementation(() => {
      throw new Error('EROFS')
    })

    expect(() => recordReleaseAsk(REPO, NOW)).not.toThrow()
  })
})

describe('when a repo was last asked about', () => {
  it('says nothing for a repo that has not been asked inside the hour', () => {
    ledgerHolding([{ repo: 'fixture-owner/rfid-tools', at: NOW - 61 * ONE_MINUTE_MS }])

    expect(repoAskedAt(REPO, NOW)).toBeNull()
  })

  it('answers with the most recent ask about that repo and no other', () => {
    ledgerHolding([
      { repo: 'fixture-owner/rfid-tools', at: NOW - 40 * ONE_MINUTE_MS },
      { repo: 'fixture-owner/rfid-tools', at: NOW - 12 * ONE_MINUTE_MS },
      { repo: 'fixture-owner/u1-extras', at: NOW - ONE_MINUTE_MS },
    ])

    expect(repoAskedAt(REPO, NOW)).toBe(NOW - 12 * ONE_MINUTE_MS)
    expect(repoAskedAt(OTHER_REPO, NOW)).toBe(NOW - ONE_MINUTE_MS)
  })
})

describe('how old the listing is', () => {
  it('is the most recent ask about any repo', () => {
    ledgerHolding([
      { repo: 'fixture-owner/rfid-tools', at: NOW - 40 * ONE_MINUTE_MS },
      { repo: 'fixture-owner/u1-extras', at: NOW - 9 * ONE_MINUTE_MS },
    ])

    expect(lastReleaseAskAt(NOW)).toBe(NOW - 9 * ONE_MINUTE_MS)
  })

  it('says nothing when the listing has not been asked about inside the hour', () => {
    ledgerHolding(asksAgo(2, 75))

    expect(lastReleaseAskAt(NOW)).toBeNull()
  })
})
