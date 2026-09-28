// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import * as openpgp from 'openpgp'
import { activeConnector, readSettings } from '../git-host'
import { hasMatchingPrivateKey } from '../keys'
import { PUBLISHER_REPO, keyFilePath } from './repo'

export interface PublishedAccountKey {
  fingerprint: string
  publicKey: string
  label: string
  hasPrivateKey: boolean
}

function publishedFingerprints(readme: string): string[] {
  const matches = [...readme.matchAll(/\[([0-9a-f]{40})\]\(keys\/[0-9a-f]{40}\/key\.asc\)/gi)]

  return [...new Set(matches.map((match) => match[1].toUpperCase()))]
}

async function publishedKey(account: string, fingerprint: string): Promise<PublishedAccountKey | null> {
  const keyFile = await activeConnector().getFile({ owner: account, repo: PUBLISHER_REPO }, keyFilePath(fingerprint))
  if (!keyFile) return null
  const publicKey = await openpgp.readKey({ armoredKey: keyFile.content }).catch(() => null)
  if (!publicKey) return null
  if (publicKey.getFingerprint().toUpperCase() !== fingerprint) return null

  return { fingerprint, publicKey: keyFile.content, label: publicKey.getUserIDs()[0] ?? fingerprint,
    hasPrivateKey: await hasMatchingPrivateKey(fingerprint) }
}

export async function listPublishedAccountKeys(): Promise<PublishedAccountKey[]> {
  if (readSettings().type !== 'github') return []
  const connector = activeConnector()
  if (!await connector.isConnected()) return []
  const account = await connector.getAccount()
  if (!account) return []
  const readme = await connector.getFile({ owner: account.login, repo: PUBLISHER_REPO }, 'README.md')
  if (!readme) return []
  const keys = await Promise.all(publishedFingerprints(readme.content).map((fingerprint) => publishedKey(account.login, fingerprint)))

  return keys.filter((key): key is PublishedAccountKey => key !== null)
}
