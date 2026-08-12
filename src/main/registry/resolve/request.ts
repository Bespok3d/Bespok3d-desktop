// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// How this module talks HTTP: one timeout, one failure mapping, and the detached signature that rides
// beside an index at `<url>.sig`. Shared by the plain-http and GitHub transports, so a failure reads
// the same whichever one produced it and a signature is fetched the same way from either.
import { RegistryFetchError } from '../model'
import type { SourceFailureReason } from '../model'
import { LIST_FETCH_TIMEOUT_MS } from '../../net/fetch-deadlines'

// github.com drops the connection on roughly half the first asks from a cold process, and one dropped
// connection used to lose a whole plugin list: the store then showed a short catalog and the log showed
// a wall of "skipped ... fetch failed". Asking again costs nothing when the host answers, and three
// asks still left lists missing on the bench, so five is what a full store takes. Only a dropped
// connection is re-asked: a timeout means the host is slow or unreachable, and asking a slow host four
// more times just makes the user wait five times as long.
const ASKS_AFTER_A_DROPPED_CONNECTION = 4
const DROPPED_CONNECTION_CODES = ['UND_ERR_SOCKET', 'ECONNRESET', 'EPIPE']

export function httpGet(url: string, headers: Record<string, string>, timeoutMs: number = LIST_FETCH_TIMEOUT_MS): Promise<Response> {
  return askTheHost(url, headers, timeoutMs, ASKS_AFTER_A_DROPPED_CONNECTION)
}

function askTheHost(url: string, headers: Record<string, string>, timeoutMs: number, asksLeft: number): Promise<Response> {
  return fetch(url, { headers, signal: AbortSignal.timeout(timeoutMs) }).catch(function askAgainOrGiveUp(error: Error) {
    if (asksLeft === 0 || !droppedConnection(error)) return networkError(error)

    return askTheHost(url, headers, timeoutMs, asksLeft - 1)
  })
}

function droppedConnection(error: Error): boolean {
  var cause = (error as { cause?: { code?: unknown } }).cause

  return DROPPED_CONNECTION_CODES.includes(String(cause?.code ?? ''))
}

function networkError(error: Error): never {
  throw new RegistryFetchError('network', error.message)
}

// GitHub answers a spent anonymous ration with the same 403 it answers a forbidden repo with, and only
// this header tells them apart. Getting it wrong offers "sign in, you may have access to this private
// list" to someone whose list is public and whose real problem is that the machine has read too much
// this hour.
const RATION_REMAINING = 'x-ratelimit-remaining'

function rationSpent(response: Response): boolean {
  return response.status === 403 && response.headers.get(RATION_REMAINING) === '0'
}

export function httpReason(response: Response): SourceFailureReason {
  if (rationSpent(response)) return 'ratelimited'
  if (response.status === 401 || response.status === 403) return 'auth'
  if (response.status === 404) return 'notfound'

  return 'network'
}

// Reached only after a transport's unconditional re-ask, so a 304 here answers a request that carried
// NO validators: there is nothing the server can be calling unchanged. There is no index to serve and
// no reason better than 'network' to file it under, so the message carries the mechanism instead - a
// generic `HTTP 304` in a log tells whoever reads it nothing about which side is broken.
export function httpFailure(response: Response, transport: string): RegistryFetchError {
  if (response.status === 304) return new RegistryFetchError('network', `${transport} answered 304 to a request that sent no validators`)
  if (rationSpent(response)) return new RegistryFetchError('ratelimited', `${transport} 403, the anonymous hourly request ration is spent`)

  return new RegistryFetchError(httpReason(response), `${transport} ${response.status}`)
}

// A connector call that never reached the host. 'Not connected' is the one failure a user can act on -
// no token is stored - so it is the one that names the fix; everything else is a network story.
export function connectorFailure(error: Error): never {
  if (/not connected/i.test(error.message)) {
    throw new RegistryFetchError('auth', 'Sign in to GitHub in Settings > Git Host to load this private list')
  }
  throw new RegistryFetchError('network', error.message)
}

// A signature's absence is ordinary (most lists are unsigned) and never fails the fetch, so every
// failure path here collapses to null.
// It asks again on a dropped connection for the same reason the index does, and for a sharper one: a
// signature that never arrives reads to the user as "this list is unsigned", which is a different and
// worse statement than "that fetch failed".
export async function fetchSignatureAt(signatureUrl: string, headers: Record<string, string> = {}): Promise<string | null> {
  const response = await askTheHost(signatureUrl, headers, LIST_FETCH_TIMEOUT_MS, ASKS_AFTER_A_DROPPED_CONNECTION).catch(() => null)
  if (!response?.ok) return null

  return response.text().catch(() => null)
}

// The `<url>.sig` convention, for a transport whose index url is a plain path. A transport whose url
// carries a query string (an API ref, say) cannot append to it and builds its own signature url.
export function fetchSignatureBeside(indexUrl: string, headers: Record<string, string> = {}): Promise<string | null> {
  return fetchSignatureAt(`${indexUrl}.sig`, headers)
}
