// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// Which repo published a listed plugin. No list declares it, so it is DERIVED from the entry's own
// published fields: `download_url` is the release asset's API url
// (`api.github.com/repos/<owner>/<repo>/releases/assets/<id>`) and `doc_url` is a blob url
// (`github.com/<owner>/<repo>/blob/...`). A bundled entry, whose download_url is a path relative to
// its list, names no repo and yields null - the ordinary offline case, never a failure.
import type { IndexEntry } from '../model'

const ASSET_API_SLUG = /^https:\/\/api\.github\.com\/repos\/([^/]+)\/([^/]+)\//
const BLOB_SLUG = /^https:\/\/github\.com\/([^/]+)\/([^/]+)\//

export interface PublishingRepo {
  owner: string
  repo: string
}

function repoInUrl(url: unknown): PublishingRepo | null {
  if (typeof url !== 'string') return null
  const match = ASSET_API_SLUG.exec(url) ?? BLOB_SLUG.exec(url)
  if (!match) return null

  return { owner: match[1], repo: match[2] }
}

// download_url is read first because it is the field an install actually fetches: a refresh derived
// from it can never ask a different repo than the one today's package comes from. doc_url is the
// fallback for an entry whose payload is hosted elsewhere.
export function publishingRepoOf(entry: IndexEntry): PublishingRepo | null {
  return repoInUrl(entry.download_url) ?? repoInUrl(entry.doc_url)
}
