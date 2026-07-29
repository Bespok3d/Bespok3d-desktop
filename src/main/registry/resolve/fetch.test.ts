// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// The cache holds bytes, never a verdict. These tests pin that: a 304 hit re-runs verification on the
// stored bytes instead of reusing whatever the last run concluded, because anything able to edit the
// cache file could otherwise hand itself a trusted badge. Verification is spied rather than real: the
// production verifier pins the org key, so no fixture can produce a positive result through it.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as openpgp from 'openpgp'
import type { RegistryRef, SignatureCheck } from '../model'
import type { CacheEntry } from './cache'
import { fetchGitHostRegistry } from './fetch'

const mocks = vi.hoisted(() => ({ entries: new Map<string, CacheEntry>(), writeCache: vi.fn(), verifyIndexSignature: vi.fn() }))

// Mocking ./cache with a factory also keeps ../../app-paths (and with it electron) out of the run.
vi.mock('./cache', () => ({ loadCache: () => mocks.entries, writeCache: mocks.writeCache, conditionalHeaders: () => ({}) }))
vi.mock('./verify', () => ({ verifyIndexSignature: mocks.verifyIndexSignature }))
vi.mock('../../git-host', () => ({ activeConnector: () => ({ getFile: () => Promise.resolve(null) }) }))

const REGISTRY_URL = 'https://lists.example.invalid/index.json'
const GITHUB_URL = 'github:bespok3d-fixture/list-repo/index.json'
const SIGNER_FINGERPRINT = '679939555819FB5F6423DC68C4388E76BFA9B4E0'
const FIXTURE_INDEX = { schema_version: 1, name: 'Fixture List', publisher: 'PLACEHOLDER', updated: '2026-01-01', plugins: [] }
const FIXTURE_BYTES = `${JSON.stringify(FIXTURE_INDEX, null, 2)}\n`
const FIXTURE_SIGNATURE = '-----BEGIN PGP SIGNATURE-----\n\nOBVIOUSLY-FAKE-FIXTURE-SIGNATURE\n-----END PGP SIGNATURE-----\n'

function listRef(): RegistryRef {
  return { url: REGISTRY_URL, trust: 'project', locked: true }
}

function gitHubRef(): RegistryRef {
  return { url: GITHUB_URL, trust: 'project', locked: true }
}

function seedCacheAt(cacheKey: string, bytes: string, signature: string | null): void {
  mocks.entries.set(cacheKey, { key: cacheKey, bytes, signature, etag: 'W/"fixture-etag"', lastModified: null, fetchedAt: 0 })
}

function seedCache(bytes: string, signature: string | null): void {
  seedCacheAt(REGISTRY_URL, bytes, signature)
}

function stubNotModified(): void {
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ status: 304, ok: false })))
}

// The GitHub transport asks for its signature at `index.json.sig?ref=main`, so a trailing-string match
// on `.sig` would miss it and answer with the index instead.
function isSignatureUrl(url: string): boolean {
  return /\.sig(\?|$)/.test(url)
}

function servedResponse(url: string, signatureStatus: number): unknown {
  if (isSignatureUrl(url)) return { ok: signatureStatus === 200, status: signatureStatus, text: () => Promise.resolve(FIXTURE_SIGNATURE) }

  return { ok: true, status: 200, text: () => Promise.resolve(FIXTURE_BYTES), headers: new Headers({ etag: 'W/"fresh"' }) }
}

function stubServedIndex(signatureStatus: number): void {
  vi.stubGlobal('fetch', vi.fn((url: string) => Promise.resolve(servedResponse(url, signatureStatus))))
}

function stubBrokenSignatureBody(): void {
  vi.stubGlobal('fetch', vi.fn((url: string) => {
    if (isSignatureUrl(url)) return Promise.resolve({ ok: true, status: 200, text: () => Promise.reject(new Error('body stream aborted')) })

    return Promise.resolve(servedResponse(url, 404))
  }))
}

function stubUnparseableIndex(): void {
  vi.stubGlobal('fetch', vi.fn((url: string) => {
    if (isSignatureUrl(url)) return Promise.resolve({ ok: false, status: 404 })

    return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve('<html>captive portal</html>'), headers: new Headers({ etag: 'W/"portal"' }) })
  }))
}

interface ThrowawaySigner {
  armoredSignature: string
  publicKey: string
  fingerprint: string
}

// The real private half of the org key is an Actions secret and never comes near this repo, so the
// passing path runs against a key pair generated here and discarded with the test process.
async function signWithThrowawayKey(bytesToSign: string): Promise<ThrowawaySigner> {
  const generated = await openpgp.generateKey({ userIDs: [{ name: 'Fixture Signer', email: 'signer@example.invalid' }], format: 'object' })
  const message = await openpgp.createMessage({ binary: new TextEncoder().encode(bytesToSign) })
  const armoredSignature = await openpgp.sign({ message, signingKeys: generated.privateKey, detached: true })

  return { armoredSignature, publicKey: generated.publicKey.armor(), fingerprint: generated.publicKey.getFingerprint().toUpperCase() }
}

function stubNotModifiedWithSignature(): void {
  vi.stubGlobal('fetch', vi.fn((url: string) => {
    if (isSignatureUrl(url)) return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(FIXTURE_SIGNATURE) })

    return Promise.resolve({ status: 304, ok: false })
  }))
}

function stubStaleNotModifiedThenServed(): void {
  const indexResponses = [{ status: 304, ok: false }, servedResponse(REGISTRY_URL, 200)]
  vi.stubGlobal('fetch', vi.fn((url: string) => {
    if (isSignatureUrl(url)) return Promise.resolve(servedResponse(url, 200))

    return Promise.resolve(indexResponses.shift())
  }))
}

function signedResponse(url: string, armoredSignature: string, bytes: string): unknown {
  if (isSignatureUrl(url)) return { ok: true, status: 200, text: () => Promise.resolve(armoredSignature) }

  return { ok: true, status: 200, text: () => Promise.resolve(bytes), headers: new Headers({ etag: 'W/"fresh"' }) }
}

// The module mock stays in place; the REAL predicate is wired through it so the path from served bytes
// to a rendered signer runs end to end without a second copy of the transport under test.
async function useRealVerifier(armoredTrustAnchor: string): Promise<void> {
  const { fingerprintOfValidSigner } = await vi.importActual<typeof import('./verify')>('./verify')
  mocks.verifyIndexSignature.mockImplementation((bytes: string, signature: string | null) => (signature ? fingerprintOfValidSigner(bytes, signature, armoredTrustAnchor).then(asSignatureCheck) : Promise.resolve({ proof: 'unsigned' })))
}

// The real verifier's own last step: a fingerprint means signed, no fingerprint from a signature that
// WAS served means failed. Mirrored here so the wired-through predicate returns what callers read.
function asSignatureCheck(fingerprint: string | null): SignatureCheck {
  return fingerprint === null ? { proof: 'failed' } : { proof: 'signed', fingerprint }
}

beforeEach(() => {
  mocks.entries.clear()
  mocks.writeCache.mockClear()
  mocks.verifyIndexSignature.mockReset().mockResolvedValue({ proof: 'signed', fingerprint: SIGNER_FINGERPRINT })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('fetchGitHostRegistry on a 304', () => {
  it('re-verifies the cached bytes rather than trusting the stored entry', async () => {
    seedCache(FIXTURE_BYTES, FIXTURE_SIGNATURE)
    stubNotModified()
    const fetched = await fetchGitHostRegistry(listRef())
    expect(mocks.verifyIndexSignature).toHaveBeenCalledWith(FIXTURE_BYTES, FIXTURE_SIGNATURE)
    expect(fetched).toMatchObject({ fromCache: true, signature: { proof: 'signed', fingerprint: SIGNER_FINGERPRINT } })
  })

  it('verifies again on every hit, so no verdict is ever memoized', async () => {
    seedCache(FIXTURE_BYTES, FIXTURE_SIGNATURE)
    stubNotModified()
    await fetchGitHostRegistry(listRef())
    await fetchGitHostRegistry(listRef())
    expect(mocks.verifyIndexSignature).toHaveBeenCalledTimes(2)
  })

  // NO-DOWNGRADE in WARN mode: a cached list whose signature no longer checks out loses its badge,
  // not its place in the store. The trust layer renders that as tier 'failed'.
  it('still loads a cached list whose signature no longer checks out', async () => {
    seedCache(FIXTURE_BYTES.replace('Fixture List', 'Tampered List'), FIXTURE_SIGNATURE)
    stubNotModified()
    mocks.verifyIndexSignature.mockResolvedValue({ proof: 'failed' })
    const fetched = await fetchGitHostRegistry(listRef())
    expect(fetched.signature).toEqual({ proof: 'failed' })
    expect(fetched.index.name).toBe('Tampered List')
  })
})

describe('fetchGitHostRegistry on a fresh 200', () => {
  it('caches the raw bytes and the signature, never the verification verdict', async () => {
    stubServedIndex(200)
    await fetchGitHostRegistry(listRef())
    const [cacheKey, entry] = mocks.writeCache.mock.calls[0]
    expect(cacheKey).toBe(REGISTRY_URL)
    expect(entry).toMatchObject({ bytes: FIXTURE_BYTES, signature: FIXTURE_SIGNATURE })
    // The stored signature is the armored .sig text and never what verifying it concluded, so a cached
    // list is checked again on every hit instead of inheriting a verdict somebody could write by hand.
    expect(entry).not.toHaveProperty('signature.proof')
  })

  it('loads a list whose sibling .sig is absent, with no proof of a signer', async () => {
    stubServedIndex(404)
    mocks.verifyIndexSignature.mockResolvedValue({ proof: 'unsigned' })
    const fetched = await fetchGitHostRegistry(listRef())
    expect(mocks.verifyIndexSignature).toHaveBeenCalledWith(FIXTURE_BYTES, null)
    expect(fetched.signature).toEqual({ proof: 'unsigned' })
  })

  // A .sig that answers 200 and then dies mid-body is a broken signature, not a broken list. The
  // rejected read collapses to null so the list keeps loading with no proof of a signer.
  it('loads the list when the sibling .sig body fails mid-stream', async () => {
    stubBrokenSignatureBody()
    mocks.verifyIndexSignature.mockResolvedValue({ proof: 'unsigned' })
    const fetched = await fetchGitHostRegistry(listRef())
    expect(mocks.verifyIndexSignature).toHaveBeenCalledWith(FIXTURE_BYTES, null)
    expect(fetched.index.name).toBe('Fixture List')
  })

  // A captive portal answers 200 with HTML. Caching those bytes beside a fresh etag would 304 against
  // them forever, leaving the source dead until the cache file was deleted by hand.
  it('does not cache a 200 whose body is not an index', async () => {
    stubUnparseableIndex()
    await expect(fetchGitHostRegistry(listRef())).rejects.toThrow('did not parse')
    expect(mocks.writeCache).not.toHaveBeenCalled()
  })
})

describe('a cached entry whose signature never arrived', () => {
  // The .sig read failed for network reasons and got cached as null beside a fresh etag. Every later
  // fetch 304s against that etag, so without a retry the list reads 'unknown' forever.
  it('retries the sibling .sig on a 304 hit and verifies with what arrives', async () => {
    seedCache(FIXTURE_BYTES, null)
    stubNotModifiedWithSignature()
    const fetched = await fetchGitHostRegistry(listRef())
    expect(mocks.verifyIndexSignature).toHaveBeenCalledWith(FIXTURE_BYTES, FIXTURE_SIGNATURE)
    expect(fetched.signature).toEqual({ proof: 'signed', fingerprint: SIGNER_FINGERPRINT })
  })

  it('writes the recovered signature back so the next run does not re-fetch it', async () => {
    seedCache(FIXTURE_BYTES, null)
    stubNotModifiedWithSignature()
    await fetchGitHostRegistry(listRef())
    const [cacheKey, entry] = mocks.writeCache.mock.calls[0]
    expect(cacheKey).toBe(REGISTRY_URL)
    expect(entry).toMatchObject({ signature: FIXTURE_SIGNATURE })
  })

  it('leaves the cache untouched when the retry fails too', async () => {
    seedCache(FIXTURE_BYTES, null)
    stubNotModified()
    const fetched = await fetchGitHostRegistry(listRef())
    expect(mocks.writeCache).not.toHaveBeenCalled()
    expect(fetched.fromCache).toBe(true)
  })
})

describe('a 304 with no usable cache entry', () => {
  // The entry was dropped after the request went out (legacy shape, key mismatch) or a proxy invented
  // the status. Falling through to the not-ok throw would surface it as a bogus 'network' failure.
  it('re-asks once without validators instead of failing', async () => {
    stubStaleNotModifiedThenServed()
    const fetched = await fetchGitHostRegistry(listRef())
    expect(fetched.index.name).toBe('Fixture List')
    expect(fetched.fromCache).toBe(false)
  })

  // The re-ask sends no validators, so a second 304 is the server misbehaving, not a cache miss. It
  // has to say so: filed as a bare 'HTTP 304' it reads like any other transport error and whoever
  // reads the log goes looking for the fault on our side.
  it('names the unconditional 304 when the server answers 304 a second time', async () => {
    stubNotModified()
    await expect(fetchGitHostRegistry(listRef())).rejects.toThrow('HTTP answered 304 to a request that sent no validators')
  })

  it('names the unconditional 304 on the github transport too', async () => {
    stubNotModified()
    await expect(fetchGitHostRegistry(gitHubRef())).rejects.toThrow('GitHub answered 304 to a request that sent no validators')
  })
})

describe('the github transport', () => {
  it('reports a 304 hit as cached, not as freshly read', async () => {
    seedCacheAt(GITHUB_URL, FIXTURE_BYTES, FIXTURE_SIGNATURE)
    stubNotModified()
    const fetched = await fetchGitHostRegistry(gitHubRef())
    expect(fetched.fromCache).toBe(true)
  })

  it('reports a served 200 as fresh', async () => {
    stubServedIndex(200)
    const fetched = await fetchGitHostRegistry(gitHubRef())
    expect(fetched.fromCache).toBe(false)
  })

  it('retries a missing sibling .sig on a 304 hit', async () => {
    seedCacheAt(GITHUB_URL, FIXTURE_BYTES, null)
    stubNotModifiedWithSignature()
    await fetchGitHostRegistry(gitHubRef())
    expect(mocks.verifyIndexSignature).toHaveBeenCalledWith(FIXTURE_BYTES, FIXTURE_SIGNATURE)
  })
})

describe('end to end with real signature verification', () => {
  it('reports the signer of bytes that genuinely verify', async () => {
    const signer = await signWithThrowawayKey(FIXTURE_BYTES)
    await useRealVerifier(signer.publicKey)
    vi.stubGlobal('fetch', vi.fn((url: string) => Promise.resolve(signedResponse(url, signer.armoredSignature, FIXTURE_BYTES))))
    const fetched = await fetchGitHostRegistry(listRef())
    expect(fetched.signature).toEqual({ proof: 'signed', fingerprint: signer.fingerprint })
  })

  // NO-DOWNGRADE: one changed byte costs the badge, never the list.
  it('still loads a list whose bytes were changed after signing', async () => {
    const signer = await signWithThrowawayKey(FIXTURE_BYTES)
    await useRealVerifier(signer.publicKey)
    const tampered = FIXTURE_BYTES.replace('Fixture List', 'Tampered List')
    vi.stubGlobal('fetch', vi.fn((url: string) => Promise.resolve(signedResponse(url, signer.armoredSignature, tampered))))
    const fetched = await fetchGitHostRegistry(listRef())
    expect(fetched.signature).toEqual({ proof: 'failed' })
    expect(fetched.index.name).toBe('Tampered List')
  })
})
