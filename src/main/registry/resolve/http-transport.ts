// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// Plain http(s), the transport most lists arrive on. Conditional GET against the cache: an etag hit
// costs one round trip and no body, which is what keeps a store of many lists cheap to refresh.
import type { RegistryRef, FetchedRegistry } from '../model'
import { loadCache, conditionalHeaders } from './cache'
import { httpGet, httpFailure, fetchSignatureBeside } from './request'
import { toFetchedRegistry, cacheServedIndex, withRetriedSignature } from './served-index'

export function isHttpUrl(url: string): boolean {
  return url.startsWith('http://') || url.startsWith('https://')
}

// A 304 with no usable cache entry is unanswerable: the server says "what you have is current" and we
// have nothing. It happens when the entry was dropped after the request went out (legacy shape, key
// mismatch) or when a proxy invents the status. Re-ask once without validators rather than letting it
// fall through to the not-ok throw and surface as a bogus 'network' failure.
export async function fetchHttpRegistry(ref: RegistryRef): Promise<FetchedRegistry> {
  const cached = loadCache().get(ref.url)
  const response = await httpGet(ref.url, conditionalHeaders(cached))
  if (response.status === 304 && cached) return toFetchedRegistry(ref, await withRetriedSignature(ref.url, cached, () => fetchSignatureBeside(ref.url)), true)

  return servedHttpRegistry(ref, response.status === 304 ? await httpGet(ref.url, {}) : response)
}

async function servedHttpRegistry(ref: RegistryRef, response: Response): Promise<FetchedRegistry> {
  if (!response.ok) throw httpFailure(response.status, 'HTTP')
  const served = { bytes: await response.text(), signature: await fetchSignatureBeside(ref.url) }
  cacheServedIndex(ref.url, served, response)

  return toFetchedRegistry(ref, served, false)
}
