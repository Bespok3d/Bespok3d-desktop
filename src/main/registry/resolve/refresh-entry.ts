// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// Bring one catalog entry up to what its repo last released. This is the whole of the "the org is not
// the gate on a publisher's fix" story: a list says 0.1.9, the repo has shipped 0.1.10, and the store
// says 0.1.10 with no republish of any list.
//
// What is NOT touched: trust, signer and registry_url. The refreshed entry keeps the badge of the
// signed list entry it came from, and no new signature is asked for, because a version number is not
// what protects a printer. Install-time verification is: it refuses a package not signed by a trusted
// anchor and refuses one older than the entry says, on every install including a cache hit. So the
// worst a tampered refresh achieves is a wrong number in the store and a refusal at install.
//
// A downgrade is never applied. A repo whose latest release is behind the list (a list pinned forward,
// a release deleted) leaves the entry alone rather than walking the store backwards.
import { compareSemanticVersions } from '../../app-update/version'
import type { MergedEntry } from '../model'
import { publishingRepoOf } from './publishing-repo'
import { cachedRelease, fetchLatestRelease } from './latest-release'
import type { FreshRelease } from './latest-release'

// The channels a user gets without asking for anything unstable. An entry that declares no channel is
// one of these: an unlabelled plugin is offered to everybody, so it is held to the strictest bar.
const RISK_FREE_CHANNELS = new Set(['stable', 'lts'])

function declaredChannel(entry: MergedEntry): string {
  return typeof entry.channel === 'string' ? entry.channel : 'stable'
}

// A REFRESH MAY RAISE THE VERSION, NEVER THE RISK. `releases/latest` skips what GitHub itself marks as
// a prerelease, and that was checked rather than assumed: it is not the same claim as the user's
// channel ceiling. Nothing stops a repo from shipping `0.2.0-rc.1` as an ordinary release, and landing
// that on an entry a list publishes as stable would put an rc build in front of an owner whose ceiling
// excludes rc, with the entry still labelled stable and the renderer's ceiling filter none the wiser.
// So the version's own prerelease tail decides, and GitHub's flag is never trusted as a proxy for it.
function withinDeclaredChannel(entry: MergedEntry, version: string): boolean {
  return !version.includes('-') || !RISK_FREE_CHANNELS.has(declaredChannel(entry))
}

// The one place a release is allowed to change an entry, shared by the live ask and the cached read so
// the two can never drift into different rules about what a refresh is permitted to do.
function withRelease(entry: MergedEntry, fresh: FreshRelease | null): MergedEntry {
  if (!fresh) return entry
  if (compareSemanticVersions(fresh.version, entry.version) <= 0) return entry
  if (!withinDeclaredChannel(entry, fresh.version)) return entry

  // Together, always: raising the version without repointing the asset would make every install of
  // this plugin refuse, because the package fetched would be older than the entry now claims.
  return { ...entry, version: fresh.version, download_url: fresh.downloadUrl }
}

export async function withFreshestRelease(entry: MergedEntry): Promise<MergedEntry> {
  const repo = publishingRepoOf(entry)
  if (!repo) return entry

  return withRelease(entry, await fetchLatestRelease(repo, entry.name))
}

// The same rule against what the refresh pass already learned, with no request. This is what every
// catalog read uses, so the listing, the update badge, the notification zone, a single install and the
// batch update all see one entry with one version and one url, whatever they each came looking for.
export function withCachedRelease(entry: MergedEntry): MergedEntry {
  const repo = publishingRepoOf(entry)
  if (!repo) return entry

  return withRelease(entry, cachedRelease(repo, entry.name))
}
