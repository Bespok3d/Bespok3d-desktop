// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// Finding a third-party publisher's public key, the consumer half of the publication the Keys pane
// performs. Two facts bind identity here and neither one alone is anything: the key is looked up
// under the account that actually served the artifact (provenance, never a claimed package name),
// and the fetched key's OWN fingerprint must equal the fingerprint the artifact declares as its
// signer. Only then does a signature over the artifact's bytes mean anything.
//
// IO is a parameter (`readFile`), so the walk itself is unit-testable against any fixture host, and
// the host-backed reader stays in key-files.ts. A key the reader cannot reach (offline, HTTP
// failure), one that is absent and one whose fingerprint does not match all end the same way here:
// null, which callers surface as unproven. Never as trust.
import * as openpgp from 'openpgp'
import { APP_CHANNEL } from '../channel'
import type { PublisherProvenance } from '../registry/resolve/publishing-repo'
import { PUBLISHER_REPO, MAIN_INDEX_OWNER, MAIN_INDEX_REPO, keyFilePath, indexBucketKeyFile } from './repo'

export interface KeyFileRepo {
  owner: string
  repo: string
  ref?: string
}

export type KeyFileReader = (repo: KeyFileRepo, path: string) => Promise<string | null>

export type PublisherKeyLookup = (provenance: PublisherProvenance | null, declaredFingerprint: string) => Promise<string | null>

export interface KeyLookupSite {
  owner: string
  repo: string
  path: string
  ref?: string
}

const FINGERPRINT = /^[0-9a-f]{40}$/i

// Whether a claimed `publisher` field names a signing key at all. `PLACEHOLDER` is what an unsigned
// build leaves behind, so it must never reach a lookup: it names no key and pretending otherwise
// would turn a plain unsigned artifact into a mysterious lookup failure.
export function isDeclaredFingerprint(candidate: unknown): candidate is string {
  return typeof candidate === 'string' && FINGERPRINT.test(candidate)
}

// The conventional publisher repository comes first, then the org's account-named key bucket.
// Staging and Dev also check registered keys on main-index/dev after both sites miss: a candidate
// key can be named for its plugin rather than the GitHub account that published the signed list.
export function keyLookupSites(provenance: PublisherProvenance, declaredFingerprint: string): KeyLookupSite[] {
  return [
    { owner: provenance.account, repo: PUBLISHER_REPO, path: keyFilePath(declaredFingerprint) },
    { owner: MAIN_INDEX_OWNER, repo: MAIN_INDEX_REPO, path: indexBucketKeyFile(provenance.account) },
  ]
}

// The armored public key of exactly the declared publisher, or null. A site that answers with a
// different key (or with bytes that are no key) does not hold the declared publisher's key, so the
// walk continues: the fingerprint match is the acceptance rule, not the path a file happened at.
export async function discoverPublisherKey(
  provenance: PublisherProvenance | null,
  declaredFingerprint: string,
  readFile: KeyFileReader,
  candidateSites?: () => Promise<KeyLookupSite[]>,
): Promise<string | null> {
  if (!provenance || !isDeclaredFingerprint(declaredFingerprint)) return null
  const sites = keyLookupSites(provenance, declaredFingerprint)
  const publishedKey = await firstMatchingKey(sites, declaredFingerprint, readFile)
  if (publishedKey || !candidateSites) return publishedKey

  return firstMatchingKey(await candidateSites().catch(() => []), declaredFingerprint, readFile)
}

async function firstMatchingKey(sites: KeyLookupSite[], declaredFingerprint: string, readFile: KeyFileReader): Promise<string | null> {
  const [site, ...remainingSites] = sites
  if (!site) return null
  const armoredKey = await matchingKeyAtSite(site, declaredFingerprint, readFile)
  if (armoredKey) return armoredKey

  return firstMatchingKey(remainingSites, declaredFingerprint, readFile)
}

async function matchingKeyAtSite(site: KeyLookupSite, declaredFingerprint: string, readFile: KeyFileReader): Promise<string | null> {
  const candidate = await readFile({ owner: site.owner, repo: site.repo, ref: site.ref }, site.path).catch(() => null)
  if (!candidate) return null
  const fetchedFingerprint = await ownFingerprint(candidate).catch(() => null)
  if (fetchedFingerprint?.toLowerCase() !== declaredFingerprint.toLowerCase()) return null

  return candidate
}

async function ownFingerprint(armoredKey: string): Promise<string> {
  const parsed = await openpgp.readKey({ armoredKey })

  return parsed.getFingerprint()
}

// The host-backed lookup used in production. key-files.ts is imported lazily because it reaches the
// git-host connector (and through it Electron's keychain); the walk above must stay loadable in a
// plain unit-test process that never models any of that.
export async function discoverPublisherKeyFromHost(provenance: PublisherProvenance | null, declaredFingerprint: string): Promise<string | null> {
  const { readPublishedKeyFile, indexKeySites } = await import('./key-files')
  const candidateSites = APP_CHANNEL.indexBranches.includes('dev') ? () => indexKeySites('dev') : undefined

  return discoverPublisherKey(provenance, declaredFingerprint, readPublishedKeyFile, candidateSites)
}
