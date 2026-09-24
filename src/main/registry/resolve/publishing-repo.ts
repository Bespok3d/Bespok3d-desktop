// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// Which repo published a listed plugin, and from that the publisher account whose key must have
// signed it. No list declares it, so it is DERIVED from the artifact's own published fields:
// `download_url` is the release asset's API url (`api.github.com/repos/<owner>/<repo>/releases/assets/<id>`)
// and `doc_url` is a blob url (`github.com/<owner>/<repo>/blob/...`). A list carries its own
// provenance in its fetch ref: the `github:owner/repo/path` scheme or the same GitHub url shapes.
// A bundled entry, whose download_url is a path relative to its list, names no repo and yields null -
// the ordinary offline case, never a failure. A claimed package name or `author` is NOT provenance and
// never enters this rule.
import type { IndexEntry } from '../model'

const ASSET_API_SLUG = /^https:\/\/api\.github\.com\/repos\/([^/]+)\/([^/]+)\//
const BLOB_SLUG = /^https:\/\/github\.com\/([^/]+)\/([^/]+)\//
const GITHUB_REF = /^github:([^/]+)\/([^/]+)\//

export interface PublishingRepo {
  owner: string
  repo: string
}

// The publisher account and host a key lookup is allowed to trust as fact. Only GitHub is named
// today: a provenance this rule cannot read yields null and therefore no third-party lookup at all.
export interface PublisherProvenance {
  host: 'github'
  account: string
}

function repoInUrl(url: unknown): PublishingRepo | null {
  if (typeof url !== 'string') return null
  const match = GITHUB_REF.exec(url) ?? ASSET_API_SLUG.exec(url) ?? BLOB_SLUG.exec(url)
  if (!match) return null

  return { owner: match[1], repo: match[2] }
}

// download_url is read first because it is the field an install actually fetches: a refresh derived
// from it can never ask a different repo than the one today's package comes from. doc_url is the
// fallback for an entry whose payload is hosted elsewhere.
export function publishingRepoOf(entry: IndexEntry): PublishingRepo | null {
  return repoInUrl(entry.download_url) ?? repoInUrl(entry.doc_url)
}

export function provenanceOfEntry(entry: IndexEntry): PublisherProvenance | null {
  const publishingRepo = publishingRepoOf(entry)
  if (!publishingRepo) return null

  return { host: 'github', account: publishingRepo.owner }
}

export function provenanceOfSourceUrl(url: string): PublisherProvenance | null {
  const publishingRepo = repoInUrl(url)
  if (!publishingRepo) return null

  return { host: 'github', account: publishingRepo.owner }
}
