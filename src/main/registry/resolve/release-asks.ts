// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// How many times this app has asked GitHub about a release in the last hour, and when it last asked
// about each repo. Two jobs, one ledger: the hard cap that keeps the app from running the owner out of
// requests, and the freshness window that keeps a repo from being asked twice in the same hour.
//
// EVERY ASK IS COUNTED, INCLUDING ONE ANSWERED 304. Whether GitHub charges a not-modified answer
// against the anonymous allowance is not something this app can observe (the allowance is only visible
// in response headers this transport does not read back), so the throttle is designed so the answer
// cannot change correctness: counting a free ask costs a little freshness, while not counting a
// charged one would overrun the allowance and take the published lists down with it.
//
// It is a file and not memory: two launches inside the same hour share one allowance,
// because the allowance belongs to the address and not to the process.
import { writeFileSync } from 'fs'
import { userDataPath } from '../../app-paths'
import { readJsonFile } from '../../json-store'
import type { PublishingRepo } from './publishing-repo'

const ONE_HOUR_MS = 60 * 60 * 1000
// Anonymous GitHub allows 60 requests an hour per address and start-up already spends about 22 on the
// eleven published lists. Twenty for release reads holds one whole pass at about 42, which leaves the
// rest of the hour for a second launch, a refresh the owner asks for and every plugin page he opens.
const ASKS_PER_HOUR = 20
// A repo asked inside this window is not asked again. It is the same hour that decides whether an
// install is offered a refresh first, on purpose: one definition of recent, in one place.
export const FRESHNESS_WINDOW_MS = ONE_HOUR_MS

interface ReleaseAsk {
  repo: string
  at: number
}

export function repoKey(repo: PublishingRepo): string {
  return `${repo.owner}/${repo.repo}`
}

function ledgerPath(): string {
  return userDataPath('release-asks.json')
}

function asksInTheLastHour(now: number): ReleaseAsk[] {
  const recorded = readJsonFile<ReleaseAsk[]>(ledgerPath(), [])
  const asks = Array.isArray(recorded) ? recorded : []

  return asks.filter((ask) => typeof ask?.at === 'number' && now - ask.at < ONE_HOUR_MS)
}

export function releaseAskAllowed(now = Date.now()): boolean {
  return asksInTheLastHour(now).length < ASKS_PER_HOUR
}

// Written before the request goes out, never after: a request that is sent and then times out has
// still been spent, and a ledger that only counts answered asks would undercount its way past the cap.
export function recordReleaseAsk(repo: PublishingRepo, now = Date.now()): void {
  const kept = [...asksInTheLastHour(now), { repo: repoKey(repo), at: now }]
  try {
    writeFileSync(ledgerPath(), JSON.stringify(kept), 'utf-8')
  } catch (error) {
    console.warn(`[registry] release ask ledger not written: ${String(error)}`)
  }
}

export function repoAskedAt(repo: PublishingRepo, now = Date.now()): number | null {
  const mine = asksInTheLastHour(now)
    .filter((ask) => ask.repo === repoKey(repo))
    .map((ask) => ask.at)

  return mine.length === 0 ? null : Math.max(...mine)
}

// The age of the whole listing, as the newest ask on it: what an install-time prompt states as hh:mm.
// null means nothing has been asked inside the hour, which reads as "older than an hour" and is the
// honest answer on a first launch as much as on a stale one.
export function lastReleaseAskAt(now = Date.now()): number | null {
  const asks = asksInTheLastHour(now).map((ask) => ask.at)

  return asks.length === 0 ? null : Math.max(...asks)
}
