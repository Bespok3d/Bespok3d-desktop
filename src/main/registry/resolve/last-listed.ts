// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// When a list fails to load, its plugins vanish from the store and the user cannot tell anything is
// missing. This reads the last good copy of that list from the cache, only for the plugin names, so
// the store can say what the failure hides. The copy goes through the same parse and verify path as
// any cache hit, and the names never enter the catalog, so a stale or tampered copy can never make a
// plugin installable.
import { RegistryFetchError } from '../model'
import type { RegistryRef, IndexEntry } from '../model'
import { loadCache } from './cache'
import { toFetchedRegistry } from './served-index'
import { toGitHubListRef, anonymousAvenues } from './github-transport'
import { isHttpUrl } from './http-transport'

// Each transport caches under the url it actually read: a `github:` list under its anonymous avenues,
// any http list (a release download included) under its own url. A disk list is never cached.
function cacheKeysOf(ref: RegistryRef): string[] {
  const gitHubList = toGitHubListRef(ref.url)
  if (gitHubList) return anonymousAvenues(gitHubList)

  return isHttpUrl(ref.url) ? [ref.url] : []
}

function shownName(entry: IndexEntry): string {
  return typeof entry.title === 'string' && entry.title.length > 0 ? entry.title : entry.name
}

// Null means no good copy was ever saved, which is a different fact from a copy that listed nothing.
export async function lastListedNames(ref: RegistryRef): Promise<string[] | null> {
  const cache = loadCache()
  const cached = cacheKeysOf(ref).map((key) => cache.get(key)).find(Boolean)
  if (!cached) return null
  const registry = await toFetchedRegistry(ref, cached, true).catch(() => null)

  return registry ? registry.index.plugins.map(shownName) : null
}

// Only a classified transport failure is a fact about the list. Anything else is a bug in this app and
// travels up untouched, as it does everywhere else in the resolver.
export async function withLastListed(ref: RegistryRef, error: Error): Promise<never> {
  if (!(error instanceof RegistryFetchError)) throw error

  throw new RegistryFetchError(error.reason, error.message, await lastListedNames(ref))
}
