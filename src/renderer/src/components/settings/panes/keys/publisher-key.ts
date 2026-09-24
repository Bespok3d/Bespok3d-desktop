// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { KeyRecord } from '../../../../data/keyTypes'
import { PUBLISHER_REPO, keyFilePath, buildReadme } from '../../../../utils/publisherRepo'

export type PublisherKeyApi = {
  gitHost: Pick<Window['b3d']['gitHost'], 'listRepos' | 'createRepo' | 'getFile' | 'putFile'>
  keys: Pick<Window['b3d']['keys'], 'list' | 'setPublishedAt'>
}

const PUBLISHER_REPO_DESC = 'Bespok3d publisher identity and signing keys'

export async function updatePublisherReadme(
  keyRecord: KeyRecord,
  owner: string,
  entry: { label: string; fingerprint: string; date: string } | null,
  api: PublisherKeyApi,
): Promise<void> {
  const allKeys = await api.keys.list()
  const otherPublished = allKeys
    .filter((key) => key.id !== keyRecord.id && key.publishedAt)
    .map((key) => ({ label: key.label, fingerprint: key.fingerprint, date: key.publishedAt! }))
  const entries = entry ? [...otherPublished, entry] : otherPublished
  entries.sort((earlierEntry, laterEntry) => earlierEntry.date.localeCompare(laterEntry.date))
  const existing = await api.gitHost.getFile(owner, PUBLISHER_REPO, 'README.md')
  await api.gitHost.putFile(
    owner, PUBLISHER_REPO, 'README.md', buildReadme(entries),
    entry ? `Add ${keyRecord.label} to publisher keys` : `Remove ${keyRecord.label} from publisher keys`,
    existing?.sha,
  )
}

export type PublishedKeyState = 'absent' | 'matched' | 'mismatch'

// What the file at the conventional key path actually is: this key's public half, something else, or
// nothing. The UI reports exactly this and nothing more, so "published" always means the published
// bytes ARE this key rather than merely that some file sits at the path.
export function publishedKeyState(publishedContent: string | null, publicKey: string): PublishedKeyState {
  if (publishedContent === null) return 'absent'
  if (publishedContent === publicKey) return 'matched'

  return 'mismatch'
}

export async function publishPublisherKey(keyRecord: KeyRecord, owner: string, api: PublisherKeyApi): Promise<string> {
  const repos = await api.gitHost.listRepos()
  if (!repos.some((repo) => repo.owner === owner && repo.repo === PUBLISHER_REPO)) {
    await api.gitHost.createRepo(PUBLISHER_REPO, PUBLISHER_REPO_DESC)
  }
  const path = keyFilePath(keyRecord.fingerprint)
  const existing = await api.gitHost.getFile(owner, PUBLISHER_REPO, path)
  await api.gitHost.putFile(owner, PUBLISHER_REPO, path, keyRecord.publicKey, `Publish signing key ${keyRecord.fingerprintShort}`, existing?.sha)
  const date = new Date().toISOString().slice(0, 10)
  await updatePublisherReadme(keyRecord, owner, { label: keyRecord.label, fingerprint: keyRecord.fingerprint, date }, api)
  await api.keys.setPublishedAt(keyRecord.id, date)

  return date
}
