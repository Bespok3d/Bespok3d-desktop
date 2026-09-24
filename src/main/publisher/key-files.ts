// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// Reading one published file off a git host, respecting the registry transport contract: anonymous
// reads first (no account, no ration spent on the signed-in user), the user's own token only as the
// fallback. A key file is not an index, so there is no `.sig` companion and no cache: a lookup that
// cannot reach the host (or has no git host at all) returns null and the caller reports an unproven
// signature. The walk above treats every such outcome the same, so no failure class is lost here.
import { httpGet } from '../registry/resolve/request'
import { activeConnector } from '../git-host'
import type { KeyFileRepo } from './key-lookup'

const RAW_FILE_BASE = 'https://raw.githubusercontent.com'
// `HEAD` resolves to whatever branch the repository defaults to, which is where the app's publish
// flow writes; `main` is the branch published artifacts are read from across this project. Both are
// tried with no credentials before the token rung, matching the list transport's avenue order.
const REFS = ['HEAD', 'main']

export async function readPublishedKeyFile(repo: KeyFileRepo, path: string): Promise<string | null> {
  const anonymous = await firstAnonymousCopy(repo, path)
  if (anonymous) return anonymous

  return authenticatedCopy(repo, path)
}

async function firstAnonymousCopy(repo: KeyFileRepo, path: string): Promise<string | null> {
  const rawUrls = REFS.map((gitRef) => `${RAW_FILE_BASE}/${repo.owner}/${repo.repo}/${gitRef}/${path}`)

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
  const file = await activeConnector().getFile(repo, path).catch(() => null)

  return file?.content ?? null
}
