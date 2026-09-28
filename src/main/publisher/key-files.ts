// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// Reading one published file off a git host, respecting the registry transport contract: anonymous
// reads first (no account, no ration spent on the signed-in user), the user's own token only as the
// fallback. A key file is not an index, so there is no `.sig` companion and no cache: a lookup that
// cannot reach the host (or has no git host at all) returns null and the caller reports an unproven
// signature. The walk above treats every such outcome the same, so no failure class is lost here.
import { httpGet } from '../registry/resolve/request'
import { activeConnector } from '../git-host'
import type { KeyFileRepo, KeyLookupSite } from './key-lookup'
import { MAIN_INDEX_OWNER, MAIN_INDEX_REPO } from './repo'

const RAW_FILE_BASE = 'https://raw.githubusercontent.com'
// `HEAD` resolves to the repository default; candidate keys explicitly request dev instead.
// Without an explicit ref, both HEAD and main are tried before the authenticated fallback.
const REFS = ['HEAD', 'main']

export async function readPublishedKeyFile(repo: KeyFileRepo, path: string): Promise<string | null> {
  const anonymous = await firstAnonymousCopy(repo, path)
  if (anonymous) return anonymous

  return authenticatedCopy(repo, path)
}

async function firstAnonymousCopy(repo: KeyFileRepo, path: string): Promise<string | null> {
  const rawUrls = (repo.ref ? [repo.ref] : REFS).map((gitRef) => `${RAW_FILE_BASE}/${repo.owner}/${repo.repo}/${gitRef}/${path}`)

  return firstServedCopy(rawUrls)
}

async function firstServedCopy(urls: string[]): Promise<string | null> {
  const [url, ...remainingUrls] = urls
  if (!url) return null
  const body = await anonymousFile(url)
  if (body) return body

  return firstServedCopy(remainingUrls)
}

async function anonymousFile(url: string): Promise<string | null> {
  const response = await httpGet(url, {}).catch(() => null)
  if (!response?.ok) return null

  return response.text().catch(() => null)
}

async function authenticatedCopy(repo: KeyFileRepo, path: string): Promise<string | null> {
  const file = await activeConnector().getFile(repo, path, repo.ref).catch(() => null)

  return file?.content ?? null
}

export async function indexKeySites(branch: string): Promise<KeyLookupSite[]> {
  const url = `https://api.github.com/repos/${MAIN_INDEX_OWNER}/${MAIN_INDEX_REPO}/contents/keys?ref=${branch}`
  const response = await httpGet(url, { Accept: 'application/vnd.github+json' }).catch(() => null)
  if (!response?.ok) return []
  const files: unknown = await response.json().catch(() => null)
  if (!Array.isArray(files)) return []

  return files.filter(isPublisherKeyFile).map((file) => ({ owner: MAIN_INDEX_OWNER, repo: MAIN_INDEX_REPO, path: file.path, ref: branch }))
}

function isPublisherKeyFile(file: unknown): file is { path: string, type: string } {
  if (!file || typeof file !== 'object') return false
  const candidate = file as { path?: unknown, type?: unknown }

  return candidate.type === 'file' && typeof candidate.path === 'string' && /^keys\/[a-z0-9-]+\.pub\.asc$/.test(candidate.path)
}
