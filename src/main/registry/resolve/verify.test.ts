// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect } from 'vitest'
import * as openpgp from 'openpgp'
import { fingerprintOfValidSigner, verifyIndexSignature, OFFICIAL_LIST_PUBLIC_KEY } from './verify'

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

  it('returns null for a sound signature issued by a key that is not the pinned one', async () => {
    const served = servedBytes(FIXTURE_INDEX)
    const signer = await signWithThrowawayKey(served)
    expect(await verifyIndexSignature(served, signer.armoredSignature)).toBeNull()
  })

  // NO-DOWNGRADE: an unsigned list is not an error, it is an absent proof. The caller renders null as
  // trust tier 'unknown' and the list still loads, so a signing mistake costs a badge, not the store.
  it('returns null when no signature was served', async () => {
    expect(await verifyIndexSignature(servedBytes(FIXTURE_INDEX), null)).toBeNull()
  })

  it('returns null for a malformed signature rather than throwing', async () => {
    const malformed = '-----BEGIN PGP SIGNATURE-----\n\nnot actually a signature\n-----END PGP SIGNATURE-----\n'
    expect(await verifyIndexSignature(servedBytes(FIXTURE_INDEX), malformed)).toBeNull()
  })
})
