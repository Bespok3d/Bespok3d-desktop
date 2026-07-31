// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// Every way a public list can be read with no account at all, tried in order until one answers. A
// public catalog must load for someone who has never heard of GitHub, so the token is the LAST resort
// and never the first: `api.github.com` rations an anonymous caller to 60 requests an hour per IP and
// one catalog load costs about 22 of them, so the third load of the day used to answer 403 and the
// store rendered empty. Release-asset downloads and raw repo files carry no such ration.
//
// Nothing here ever sends an Authorization header. An anonymous read of a public file must not spend
// the signed-in user's own hourly ration either.
import { RegistryFetchError } from '../model'
import { resolveHttpIndex } from './http-transport'
import type { ResolvedIndex } from './served-index'
import { activeConnector } from '../../git-host'

// Which of several dead avenues to name the user: the one whose fix he can act on. A spent ration and
// a private list both point at signing in, so they outrank a 404 (nothing to sign in for) and an
// unreachable host (signing in cannot reach it either).
const ACTIONABLE_FIRST: Partial<Record<string, number>> = { ratelimited: 3, auth: 2, notfound: 1 }

export interface AvenueWalk {
  resolved: ResolvedIndex | null
  failure: RegistryFetchError | null
}

function rank(failure: RegistryFetchError): number {
  return ACTIONABLE_FIRST[failure.reason] ?? 0
}

function moreActionable(sofar: RegistryFetchError | null, next: RegistryFetchError): RegistryFetchError {
  if (!sofar) return next

  return rank(next) > rank(sofar) ? next : sofar
}

// A parse failure counts as a dead avenue like any other: bytes that are not an index are not an
// index, and the next avenue may still hold the real one. Anything that is not a classified transport
// failure is a bug in this app rather than a fact about the host, so it travels up untouched.
function asAvenueFailure(error: Error): RegistryFetchError {
  if (error instanceof RegistryFetchError) return error

  throw error
}

async function walkAvenues(urls: string[], worstSoFar: RegistryFetchError | null): Promise<AvenueWalk> {
  if (urls.length === 0) return { resolved: null, failure: worstSoFar }
  const outcome = await resolveHttpIndex(urls[0]).catch((error: Error) => asAvenueFailure(error))
  if (!(outcome instanceof RegistryFetchError)) return { resolved: outcome, failure: null }

  return walkAvenues(urls.slice(1), moreActionable(worstSoFar, outcome))
}

// The first url that serves the list, or the classified failure worth telling the user about. Each url
// is read conditionally against its own cache entry, so a revalidated avenue costs a 304 and no bytes.
export function firstOpenAvenue(urls: string[]): Promise<AvenueWalk> {
  return walkAvenues(urls, null)
}

// Whether there is a git-host token to fall back on at all. Without one, the authorized rung has
// nothing to try and would replace an accurate "the host is rationing you" with a misleading "sign in
// to read this private list"; the anonymous failure is the true one and is what the user is shown.
export function connectedToAGitHost(): Promise<boolean> {
  return Promise.resolve()
    .then(() => activeConnector().isConnected())
    .catch(() => false)
}
