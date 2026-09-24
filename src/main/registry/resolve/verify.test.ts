// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect } from 'vitest'
import * as openpgp from 'openpgp'
import { fingerprintOfValidSigner, verifyIndexSignature, provedSigner, OFFICIAL_LIST_PUBLIC_KEY } from './verify'
import type { ListVerificationContext } from './verify'
import type { PublisherKeyLookup } from '../../publisher/key-lookup'

const PINNED_FINGERPRINT = '679939555819FB5F6423DC68C4388E76BFA9B4E0'
const FIXTURE_INDEX = { schema_version: 1, name: 'Fixture List', publisher: 'PLACEHOLDER', updated: '2026-01-01', plugins: [] }

interface ThrowawaySigner {
  armoredSignature: string
  publicKey: string
  fingerprint: string
}

// The real private half of the org key is a GitHub Actions secret and never comes near this repo, so
// the PASSING path is exercised against a key pair generated here and discarded with the test process.
async function signWithThrowawayKey(bytesToSign: string): Promise<ThrowawaySigner> {
  const generated = await openpgp.generateKey({ userIDs: [{ name: 'Fixture Signer', email: 'signer@example.invalid' }], format: 'object' })
  const message = await openpgp.createMessage({ binary: new TextEncoder().encode(bytesToSign) })
  const armoredSignature = await openpgp.sign({ message, signingKeys: generated.privateKey, detached: true })

  return { armoredSignature, publicKey: generated.publicKey.armor(), fingerprint: generated.publicKey.getFingerprint().toUpperCase() }
}

// The framing the producer signs: b3-builder's write-json.ts and main-index's assemble.mjs both emit
// exactly these bytes, two-space indent with a trailing newline.
function servedBytes(index: Record<string, unknown>): string {
  return `${JSON.stringify(index, null, 2)}\n`
}

function contextWithoutDiscovery(overrides: Partial<ListVerificationContext> = {}): ListVerificationContext {
  return {
    provenance: null,
    declaredPublisher: 'PLACEHOLDER',
    publisherKeyOf: () => Promise.resolve(null),
    pinnedTrustAnchor: OFFICIAL_LIST_PUBLIC_KEY,
    ...overrides,
  }
}

// Signs with a key treated as the pinned anchor of this context, so the pinned passing path is
// exercised the same way the anchor-set tests of verify-package exercise theirs.
async function pinnedContextFor(served: string): Promise<{ armoredSignature: string, context: ListVerificationContext }> {
  const signer = await signWithThrowawayKey(served)

  return {
    armoredSignature: signer.armoredSignature,
    context: contextWithoutDiscovery({ pinnedTrustAnchor: signer.publicKey }),
  }
}

describe('fingerprintOfValidSigner', () => {
  it('returns the signer fingerprint for a detached signature over the exact served bytes', async () => {
    const served = servedBytes(FIXTURE_INDEX)
    const signer = await signWithThrowawayKey(served)
    expect(await fingerprintOfValidSigner(served, signer.armoredSignature, signer.publicKey)).toBe(signer.fingerprint)
  })

  it('rejects bytes tampered with after signing', async () => {
    const signer = await signWithThrowawayKey(servedBytes(FIXTURE_INDEX))
    const tampered = servedBytes({ ...FIXTURE_INDEX, publisher: 'ATTACKER' })
    expect(await fingerprintOfValidSigner(tampered, signer.armoredSignature, signer.publicKey)).toBeNull()
  })

  // The signature vouches for BYTES, not for the object they decode to. A re-serialized copy of the
  // same logical index is a different byte string and must fail, which is why nothing downstream is
  // ever allowed to verify a JSON.stringify of an already-parsed index.
  it('rejects a re-serialized copy of the same logical index', async () => {
    const signer = await signWithThrowawayKey(servedBytes(FIXTURE_INDEX))
    expect(await fingerprintOfValidSigner(JSON.stringify(FIXTURE_INDEX), signer.armoredSignature, signer.publicKey)).toBeNull()
  })

  // openpgp raises on a signature its parser cannot read. The guard belongs HERE rather than in the
  // wrapper: this function is exported, so a direct caller reading Promise<string | null> must get
  // null and not an unhandled rejection.
  it('returns null for a signature openpgp cannot parse, rather than rejecting', async () => {
    const signer = await signWithThrowawayKey(servedBytes(FIXTURE_INDEX))
    const malformed = '-----BEGIN PGP SIGNATURE-----\n\nnot actually a signature\n-----END PGP SIGNATURE-----\n'
    expect(await fingerprintOfValidSigner(servedBytes(FIXTURE_INDEX), malformed, signer.publicKey)).toBeNull()
  })
})

describe('verifyIndexSignature', () => {
  it('derives the pinned org fingerprint from the bundled public key', async () => {
    const pinned = await openpgp.readKey({ armoredKey: OFFICIAL_LIST_PUBLIC_KEY })
    expect(pinned.getFingerprint().toUpperCase()).toBe(PINNED_FINGERPRINT)
  })

  it('reports failed for a sound signature issued by a key that is not the pinned one', async () => {
    const served = servedBytes(FIXTURE_INDEX)
    const signer = await signWithThrowawayKey(served)
    expect(await verifyIndexSignature(served, signer.armoredSignature, contextWithoutDiscovery())).toEqual({ proof: 'failed' })
  })

  // A list nobody signed and a list whose signature did not match are two different situations and
  // must not collapse into one value: the first is a publisher who never signed, the second is the one
  // an owner should look into. NO-DOWNGRADE holds for both, neither is an error, and the list loads.
  it('reports unsigned when no signature was served, which is not the same as failed', async () => {
    expect(await verifyIndexSignature(servedBytes(FIXTURE_INDEX), null, contextWithoutDiscovery())).toEqual({ proof: 'unsigned' })
  })

  it('reports failed for a malformed signature rather than throwing', async () => {
    const malformed = '-----BEGIN PGP SIGNATURE-----\n\nnot actually a signature\n-----END PGP SIGNATURE-----\n'
    expect(await verifyIndexSignature(servedBytes(FIXTURE_INDEX), malformed, contextWithoutDiscovery())).toEqual({ proof: 'failed' })
  })

  // Unchanged project-key behavior: a proof that stands comes back as the pinned signer at the
  // project tier, and no lookup is attempted to get there.
  it('names the pinned project as the proved signer of a signature the pinned key issued', async () => {
    const served = servedBytes(FIXTURE_INDEX)

    var looked = false
    const { armoredSignature, context } = await pinnedContextFor(served)
    const proof = await verifyIndexSignature(served, armoredSignature, {
      ...context,
      publisherKeyOf: () => {
        looked = true

        return Promise.resolve(null)
      },
    })
    expect(proof).toEqual({ proof: 'signed', signer: 'Bespok3d', tier: 'project', fingerprint: expect.any(String) })
    expect(provedSigner(proof)).toBe('Bespok3d')
    expect(looked).toBe(false)
  })
})

describe('verifyIndexSignature with a third-party publisher key', () => {
  const provenance = { host: 'github' as const, account: 'fixture-publisher' }

  function lookupReturning(armoredKey: string | null): PublisherKeyLookup {
    return () => Promise.resolve(armoredKey)
  }

  // One disposable publisher: its key signs the list, its fingerprint is what the list declares, and
  // its public half is what a lookup finds. A wrong-key case reuses the bytes with another signature.
  async function signedThirdPartyList(declaredFingerprint = '0'.repeat(40)) {
    const publisher = await signWithThrowawayKey(servedBytes({ ...FIXTURE_INDEX, publisher: declaredFingerprint }))
    const served = servedBytes({ ...FIXTURE_INDEX, publisher: publisher.fingerprint.toLowerCase() })

    return { served, signed: await signWithThrowawayKey(served), publisher }
  }

  function contextForThirdParty(servedSigner: { fingerprint: string, publicKey: string }, foundKey: string | null): ListVerificationContext {
    return contextWithoutDiscovery({
      provenance,
      declaredPublisher: servedSigner.fingerprint.toLowerCase(),
      publisherKeyOf: lookupReturning(foundKey),
    })
  }

  it('proves a third-party signature through the discovered key and confers community', async () => {
    const { served, signed } = await signedThirdPartyList()
    const proof = await verifyIndexSignature(served, signed.armoredSignature, contextForThirdParty(signed, signed.publicKey))
    expect(proof).toEqual({ proof: 'signed', fingerprint: signed.fingerprint, signer: 'fixture-publisher', tier: 'community' })
    expect(provedSigner(proof)).toBe('fixture-publisher')
  })

  it('reports failed when the lookup finds no key at all', async () => {
    const { served, signed } = await signedThirdPartyList()
    expect(await verifyIndexSignature(served, signed.armoredSignature, contextForThirdParty(signed, null))).toEqual({ proof: 'failed' })
  })

  it('reports failed when the discovered key did not issue this signature', async () => {
    const { served, signed, publisher } = await signedThirdPartyList()
    const impostor = await signWithThrowawayKey(served)
    expect(await verifyIndexSignature(served, impostor.armoredSignature, contextForThirdParty(signed, publisher.publicKey))).toEqual({ proof: 'failed' })
  })
})

describe('verifyIndexSignature third-party lookup preconditions', () => {
  const provenance = { host: 'github' as const, account: 'fixture-publisher' }

  it('never looks a key up when the artifact declares no fingerprint', async () => {
    const signer = await signWithThrowawayKey(servedBytes(FIXTURE_INDEX))

    var looked = false
    const context = contextWithoutDiscovery({
      provenance,
      declaredPublisher: 'PLACEHOLDER',
      publisherKeyOf: () => {
        looked = true

        return Promise.resolve(signer.publicKey)
      },
    })
    expect(await verifyIndexSignature(servedBytes(FIXTURE_INDEX), signer.armoredSignature, context)).toEqual({ proof: 'failed' })
    expect(looked).toBe(false)
  })

  it('never looks a key up when the bytes name no readable provenance', async () => {
    const publisher = await signWithThrowawayKey(servedBytes({ ...FIXTURE_INDEX, publisher: '0'.repeat(40) }))
    const served = servedBytes({ ...FIXTURE_INDEX, publisher: publisher.fingerprint.toLowerCase() })
    const signed = await signWithThrowawayKey(served)

    var looked = false
    const context = contextWithoutDiscovery({
      provenance: null,
      declaredPublisher: signed.fingerprint.toLowerCase(),
      publisherKeyOf: () => {
        looked = true

        return Promise.resolve(signed.publicKey)
      },
    })
    expect(await verifyIndexSignature(served, signed.armoredSignature, context)).toEqual({ proof: 'failed' })
    expect(looked).toBe(false)
  })
})
