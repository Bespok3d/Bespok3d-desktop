// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// Given a registry ref, produce a FetchedRegistry. This file is the ROUTER and nothing else: it picks
// the transport the ref names and hands over. Each transport is a sibling file (`github-transport`,
// `http-transport`, `disk-transport`) over the shared HTTP mechanics in `request`, and all three
// converge on `served-index` so parsing plus verification happen in ONE place - what gets verified and
// what gets used can never be two different things (ADR-0009 publisher tier).
import type { RegistryRef, FetchedRegistry } from '../model'
import { fetchDiskRegistry } from './disk-transport'
import { isHttpUrl, fetchHttpRegistry } from './http-transport'
import { toGitHubListRef, fetchGitHubRegistry } from './github-transport'
import { toReleaseAssetListRef, fetchReleaseAssetRegistry } from './release-asset-transport'

// Ordered by specificity: the `github:` scheme first, then a release-download url (an http url whose
// path names an asset of a repo's latest release), then plain http(s), and a disk path is what is left
// when no scheme claims the ref.
export function fetchGitHostRegistry(ref: RegistryRef): Promise<FetchedRegistry> {
  const gitHubList = toGitHubListRef(ref.url)
  if (gitHubList) return fetchGitHubRegistry(ref, gitHubList)
  const releaseAsset = toReleaseAssetListRef(ref.url)
  if (releaseAsset) return fetchReleaseAssetRegistry(ref, releaseAsset)
  if (isHttpUrl(ref.url)) return fetchHttpRegistry(ref)

  return fetchDiskRegistry(ref)
}
