// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect, vi } from 'vitest'
import * as openpgp from 'openpgp'
import { discoverPublisherKey, isDeclaredFingerprint, keyLookupSites } from './key-lookup'
import type { KeyFileRepo, KeyFileReader } from './key-lookup'
import { PUBLISHER_REPO, MAIN_INDEX_OWNER, MAIN_INDEX_REPO, keyFilePath, indexBucketKeyFile } from './repo'

const ACCOUNT = 'Fixture-Publisher'
const provenance = { host: 'github' as const, account: ACCOUNT }

interface DisposablePublisher {
  armoredPublicKey: string
  fingerprint: string
}

const generatedPublishers = new Map<string, Promise<DisposablePublisher>>()

function disposablePublisher(publisherName: string): Promise<DisposablePublisher> {
  const alreadyGenerating = generatedPublishers.get(publisherName)
  if (alreadyGenerating) return alreadyGenerating
  const generating = openpgp
    .generateKey({ userIDs: [{ name: publisherName, email: 'publisher@example.invalid' }], format: 'object' })
    .then((generated) => ({ armoredPublicKey: generated.publicKey.armor(), fingerprint: generated.publicKey.getFingerprint().toUpperCase() }))
  generatedPublishers.set(publisherName, generating)

  return generating
}

function readerRecording(served: Record<string, string | null>): { read: KeyFileReader, asked: string[] } {
  const asked: string[] = []
  const read = vi.fn(async (repo: KeyFileRepo, path: string) => {
    asked.push(`${repo.owner}/${repo.repo}/${path}`)

    return served[`${repo.owner}/${repo.repo}/${path}`] ?? null
  }) as unknown as KeyFileReader

  return { read, asked }
}

function rejectEveryRead(): Promise<string | null> {
  return Promise.reject(new Error('offline'))
}

function primaryPathFor(fingerprint: string): string {
  return `${ACCOUNT}/${PUBLISHER_REPO}/${keyFilePath(fingerprint)}`
}

function bucketPathFor(): string {
  return `${MAIN_INDEX_OWNER}/${MAIN_INDEX_REPO}/${indexBucketKeyFile(ACCOUNT)}`
}

describe('isDeclaredFingerprint', () => {
  it('accepts a forty-hex fingerprint in either letter case', () => {
    expect(isDeclaredFingerprint('ABCDEF0123456789abcdef0123456789ABCDEF01')).toBe(true)
  })

  it('refuses the unsigned-build PLACEHOLDER and anything that is not forty hex', () => {
    expect(isDeclaredFingerprint('PLACEHOLDER')).toBe(false)
    expect(isDeclaredFingerprint('abc')).toBe(false)
    expect(isDeclaredFingerprint(undefined)).toBe(false)
  })
})

describe('keyLookupSites', () => {
  it('puts the conventional publisher repository first and the main-index key bucket second', () => {
    expect(keyLookupSites(provenance, 'ABCD1234')).toEqual([
      { owner: ACCOUNT, repo: PUBLISHER_REPO, path: keyFilePath('ABCD1234') },
      { owner: MAIN_INDEX_OWNER, repo: MAIN_INDEX_REPO, path: indexBucketKeyFile(ACCOUNT) },
    ])
  })

  it('spells the bucket filename from the lowercased account, the way the committed keys are named', () => {
    expect(indexBucketKeyFile('LixNix')).toBe('keys/lixnix-publisher.pub.asc')
  })
})

describe('discoverPublisherKey primary and fallback lookup', () => {
  it('accepts the key the conventional publisher repository serves', async () => {
    const publisher = await disposablePublisher('Primary Site')
    const path = primaryPathFor(publisher.fingerprint)
    const { read, asked } = readerRecording({ [path]: publisher.armoredPublicKey })
    expect(await discoverPublisherKey(provenance, publisher.fingerprint, read)).toBe(publisher.armoredPublicKey)
    expect(asked).toEqual([path])
  })

  it('falls back to the main-index key bucket when the publisher repository holds nothing', async () => {
    const publisher = await disposablePublisher('Fallback Site')
    const { read, asked } = readerRecording({ [bucketPathFor()]: publisher.armoredPublicKey })
    expect(await discoverPublisherKey(provenance, publisher.fingerprint, read)).toBe(publisher.armoredPublicKey)
    expect(asked).toEqual([primaryPathFor(publisher.fingerprint), bucketPathFor()])
  })

  it('reports no key when neither site holds one', async () => {
    const publisher = await disposablePublisher('Absent Key')
    const { read } = readerRecording({})
    expect(await discoverPublisherKey(provenance, publisher.fingerprint, read)).toBeNull()
  })
})

describe('discoverPublisherKey only accepts the declared key itself', () => {
  it('rejects a served key whose own fingerprint is not the declared one and keeps walking', async () => {
    const declared = await disposablePublisher('Declared Publisher')
    const impostor = await disposablePublisher('Impostor Publisher')
    const impostorPath = primaryPathFor(declared.fingerprint)
    const { read, asked } = readerRecording({
      [impostorPath]: impostor.armoredPublicKey,
      [bucketPathFor()]: declared.armoredPublicKey,
    })
    expect(await discoverPublisherKey(provenance, declared.fingerprint, read)).toBe(declared.armoredPublicKey)
    expect(asked).toEqual([impostorPath, bucketPathFor()])
  })

  it('reports no key when every site holds the wrong one', async () => {
    const declared = await disposablePublisher('Wrong Everywhere')
    const impostor = await disposablePublisher('Wrong Key Only')
    const { read } = readerRecording({
      [primaryPathFor(declared.fingerprint)]: impostor.armoredPublicKey,
      [bucketPathFor()]: impostor.armoredPublicKey,
    })
    expect(await discoverPublisherKey(provenance, declared.fingerprint, read)).toBeNull()
  })

  it('treats bytes that are no key like an empty site and keeps walking', async () => {
    const publisher = await disposablePublisher('Garbage File')
    const { read } = readerRecording({
      [primaryPathFor(publisher.fingerprint)]: 'not a key at all',
      [bucketPathFor()]: publisher.armoredPublicKey,
    })
    expect(await discoverPublisherKey(provenance, publisher.fingerprint, read)).toBe(publisher.armoredPublicKey)
  })
})

describe('discoverPublisherKey unreachable and unasked lookups', () => {
  it('reports no key when every read fails the way an offline machine fails', async () => {
    const publisher = await disposablePublisher('Offline')
    expect(await discoverPublisherKey(provenance, publisher.fingerprint, rejectEveryRead)).toBeNull()
  })

  it('never asks a host anything without provenance or without a declared fingerprint', async () => {
    const publisher = await disposablePublisher('No Ask')
    const { read, asked } = readerRecording({})
    expect(await discoverPublisherKey(null, publisher.fingerprint, read)).toBeNull()
    expect(await discoverPublisherKey(provenance, 'PLACEHOLDER', read)).toBeNull()
    expect(asked).toEqual([])
  })
})
