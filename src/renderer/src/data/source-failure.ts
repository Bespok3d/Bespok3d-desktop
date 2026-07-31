// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// An empty store is a dead end unless it says WHY it is empty and what fixes it. The failures a
// sign-in fixes and the ones it does not are kept apart here: offering "sign in to GitHub" to someone
// whose machine is offline sends him round a loop that cannot end, and staying silent about a spent
// anonymous request ration leaves him thinking the catalog is empty.
import type { SourceRow, SourceFailureReason } from './types'

// Ordered by what the reader can do about it. Several sources can fail at once for different reasons,
// and the one worth naming is the one with an action behind it.
const ACTIONABLE_FIRST: SourceFailureReason[] = ['ratelimited', 'auth', 'notfound', 'network', 'empty']
const REACHED_BY_SIGNING_IN: SourceFailureReason[] = ['ratelimited', 'auth', 'notfound']

// 'filtered' = there are plugins but the search or the filters hide them. 'ratelimited' = GitHub is
// rationing anonymous reads from this network and signing in raises the ration. 'auth' = the list is
// private or gone. 'offline' = GitHub was not reachable at all. 'empty' = the list arrived and had
// nothing in it, which is the publisher's end and not this machine's. 'none' = genuinely nothing
// available.
export type EmptyStoreReason = 'ratelimited' | 'auth' | 'offline' | 'empty' | 'filtered' | 'none'

const NAMED_BY_FAILURE: Partial<Record<SourceFailureReason, EmptyStoreReason>> = {
  ratelimited: 'ratelimited',
  auth: 'auth',
  notfound: 'auth',
  network: 'offline',
  empty: 'empty',
}

const FIXED_BY_SIGNING_IN: EmptyStoreReason[] = ['ratelimited', 'auth']

export function offersSignIn(reason: EmptyStoreReason): boolean {
  return FIXED_BY_SIGNING_IN.includes(reason)
}

// The one row's own answer, for the Repositories pane, where each source is listed with its own state.
export function signInWouldReach(source: SourceRow): boolean {
  return source.status === 'failed' && !!source.reason && REACHED_BY_SIGNING_IN.includes(source.reason)
}

function firstActionableFailure(sources: SourceRow[]): SourceFailureReason | null {
  const failed = sources.filter((source) => source.status === 'failed')

  return ACTIONABLE_FIRST.find((reason) => failed.some((source) => source.reason === reason)) ?? null
}

export function emptyStoreReason(hasCatalog: boolean, sources: SourceRow[]): EmptyStoreReason {
  if (hasCatalog) return 'filtered'
  const failure = firstActionableFailure(sources)
  if (!failure) return 'none'

  return NAMED_BY_FAILURE[failure] ?? 'none'
}
