// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// One refresh pass: ask the listed plugins' own repos what they last released, so the store shows a
// publisher's fix without the org republishing any list.
//
// NOTHING RUNS THIS ON ITS OWN. The pass is started by a person saying yes to it, never by start-up
// and never by a timer, because the app has 60 anonymous requests an hour for the whole address and
// the owner decides how they are spent.
//
// PACED, NOT ALL AT ONCE. The entries the owner can see without scrolling are asked first, as one
// batch, so the listing he is looking at settles first. The rest follows about five at a time with a
// pause between groups. A repo asked inside the freshness window is skipped, and the whole pass runs
// under the per-hour cap in `release-asks`, which is spent at the request itself so nothing here can
// overrun it.
//
// The pass only WRITES THE CACHE. Nothing in it decides what the store shows: every catalog read
// applies the cached release itself, so a pass that is cut short by the cap, a dead network or a quit
// leaves a listing that is simply less fresh, never one that is wrong.
import { askLatestRelease } from './resolve/latest-release'
import { publishingRepoOf } from './resolve/publishing-repo'
import { withCachedRelease } from './resolve/refresh-entry'
import { FRESHNESS_WINDOW_MS, releaseAskAllowed, repoAskedAt, repoKey } from './resolve/release-asks'
import type { MergedEntry } from './model'
import type { PublishingRepo } from './resolve/publishing-repo'

// About a screenful of the store grid. Not a layout measurement and it does not need to be: being
// roughly right about what is on screen is what buys the owner his first impression fast.
const VISIBLE_FIRST_ENTRIES = 12
// Five at a time with a pause between: a listing this size finishes in a few seconds, and GitHub is
// never handed a burst.
const GROUP_SIZE = 5
const PAUSE_BETWEEN_GROUPS_MS = 1500

// One plugin that has released something newer than the list says, with both numbers.
export interface RefreshedVersion {
  pluginName: string
  listedVersion: string
  freshVersion: string
}

export interface RefreshPassResult {
  askedRepos: number
  moved: RefreshedVersion[]
}

interface RefreshPassOptions {
  pauseMs?: number
}

function variantsOf(entry: MergedEntry): MergedEntry[] {
  return entry.variants ?? [entry]
}

// Variants included, not just the winner: the update badge can be reading a variant (a published copy
// beside a local build), so refreshing only the shown one would leave the badge on a stale number.
function publishingRepoOrNone(entry: MergedEntry): PublishingRepo[] {
  const repo = publishingRepoOf(entry)

  return repo ? [repo] : []
}

// One ask per repo, in listing order. A co-repo that publishes several of these plugins is one repo and
// therefore one request; a bundled entry has no repo and costs nothing.
function distinctRepos(entries: readonly MergedEntry[]): PublishingRepo[] {
  const inListingOrder = entries.flatMap(variantsOf).flatMap(publishingRepoOrNone)

  return [...new Map(inListingOrder.map((repo) => [repoKey(repo), repo])).values()]
}

function askIsDue(repo: PublishingRepo, now: number): boolean {
  const askedAt = repoAskedAt(repo, now)

  return askedAt === null || now - askedAt >= FRESHNESS_WINDOW_MS
}

function inGroups(repos: readonly PublishingRepo[]): PublishingRepo[][] {
  const groupCount = Math.ceil(repos.length / GROUP_SIZE)

  return Array.from({ length: groupCount }, (_, group) => repos.slice(group * GROUP_SIZE, (group + 1) * GROUP_SIZE))
}

// The visible entries' repos first, then everything else, and one pacing rule over the whole queue.
// Being on screen decides the ORDER, never the pace: a screenful asked in one burst is the "all at
// once" the owner ruled out, and at five at a time the visible ones still settle in a few seconds.
function plannedGroups(entries: readonly MergedEntry[], now: number): PublishingRepo[][] {
  const visibleKeys = new Set(distinctRepos(entries.slice(0, VISIBLE_FIRST_ENTRIES)).map(repoKey))
  const due = distinctRepos(entries).filter((repo) => askIsDue(repo, now))
  const visibleFirst = [
    ...due.filter((repo) => visibleKeys.has(repoKey(repo))),
    ...due.filter((repo) => !visibleKeys.has(repoKey(repo))),
  ]

  return inGroups(visibleFirst)
}

function pause(ms: number): Promise<void> {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

async function askGroups(groups: readonly PublishingRepo[][], pauseMs: number): Promise<number> {
  const [group, ...rest] = groups
  // Bounded by the per-hour cap over the group size, so this recursion is a handful of frames deep at
  // its worst and never grows with the plugin count.
  if (!group || !releaseAskAllowed()) return 0
  // One repo's failure is consumed here so it cannot take the group down with it: the pass has no way
  // to report a single repo anyway, and the entry simply stays on the version its list published.
  await Promise.all(group.map((repo) => askLatestRelease(repo).catch(() => null)))
  if (rest.length === 0) return group.length
  await pause(pauseMs)

  return group.length + (await askGroups(rest, pauseMs))
}

// What the person who asked for the refresh is shown: every plugin that now reads differently from
// the list, with the number it was published at and the number its own repo has released. An empty
// list means the pass changed nothing anyone can see.
function movedVersions(entries: readonly MergedEntry[]): RefreshedVersion[] {
  const moved = entries.flatMap(variantsOf)
    .map((entry) => ({ pluginName: entry.name, listedVersion: entry.version, freshVersion: withCachedRelease(entry).version }))
    .filter((row) => row.freshVersion !== row.listedVersion)

  // A plugin published in several variants has moved once, not once per variant.
  return moved.filter((row, index) => moved.findIndex((sameName) => sameName.pluginName === row.pluginName) === index)
}

export async function runRefreshPass(entries: readonly MergedEntry[], options: RefreshPassOptions = {}): Promise<RefreshPassResult> {
  const askedRepos = await askGroups(plannedGroups(entries, Date.now()), options.pauseMs ?? PAUSE_BETWEEN_GROUPS_MS)

  return { askedRepos, moved: movedVersions(entries) }
}
