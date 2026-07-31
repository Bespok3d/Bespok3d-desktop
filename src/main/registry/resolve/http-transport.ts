// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// Plain http(s), the transport most lists arrive on. Conditional GET against the cache: an etag hit
// costs one round trip and no body, which is what keeps a store of many lists cheap to refresh.
import type { RegistryRef, FetchedRegistry } from '../model'
import { loadCache, conditionalHeaders } from './cache'
import { httpGet, httpFailure, fetchSignatureBeside } from './request'
import { toFetchedRegistry, cacheServedIndex, withRetriedSignature } from './served-index'
import type { ResolvedIndex } from './served-index'

export function isHttpUrl(url: string): boolean {
  return url.startsWith('http://') || url.startsWith('https://')
}

export async function fetchHttpRegistry(ref: RegistryRef): Promise<FetchedRegistry> {
  const resolved = await resolveHttpIndex(ref.url)

  return toFetchedRegistry(ref, resolved.served, resolved.fromCache)
}

// A 304 with no usable cache entry is unanswerable: the server says "what you have is current" and we
// have nothing. It happens when the entry was dropped after the request went out (legacy shape, key
// mismatch) or when a proxy invents the status. Re-ask once without validators rather than letting it
// fall through to the not-ok throw and surface as a bogus 'network' failure.
//
// The release-asset transport reads its list off a plain download url too, so it comes through here
// first: a status that is not an index arrives there as a mapped RegistryFetchError, which is what
// tells it to ask the host again with the user's token.
export async function resolveHttpIndex(url: string): Promise<ResolvedIndex> {
  const cached = loadCache().get(url)
  const response = await httpGet(url, conditionalHeaders(cached))
  if (response.status === 304 && cached) return { served: await withRetriedSignature(url, cached, () => fetchSignatureBeside(url)), fromCache: true }

  return servedHttpIndex(url, response.status === 304 ? await httpGet(url, {}) : response)
}

async function servedHttpIndex(url: string, response: Response): Promise<ResolvedIndex> {
  if (!response.ok) throw httpFailure(response, 'HTTP')
  const served = { bytes: await response.text(), signature: await fetchSignatureBeside(url) }
  cacheServedIndex(url, served, response)

  return { served, fromCache: false }
}
