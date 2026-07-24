// Given a registry ref, produce a FetchedRegistry. This file is the ROUTER and nothing else: it picks
// the transport the ref names and hands over. Each transport is a sibling file (`github-transport`,
// `http-transport`, `disk-transport`) over the shared HTTP mechanics in `request`, and all three
// converge on `served-index` so parsing plus verification happen in ONE place - what gets verified and
// what gets used can never be two different things (ADR-0009 publisher tier).
import type { RegistryRef, FetchedRegistry } from '../model'
import { fetchDiskRegistry } from './disk-transport'
import { isHttpUrl, fetchHttpRegistry } from './http-transport'
import { toGitHubListRef, fetchGitHubRegistry } from './github-transport'

// Ordered by specificity: the `github:` scheme first, then plain http(s), and a disk path is what is
// left when no scheme claims the ref.
export function fetchGitHostRegistry(ref: RegistryRef): Promise<FetchedRegistry> {
  const gitHubList = toGitHubListRef(ref.url)
  if (gitHubList) return fetchGitHubRegistry(ref, gitHubList)
  if (isHttpUrl(ref.url)) return fetchHttpRegistry(ref)

  return fetchDiskRegistry(ref)
}
