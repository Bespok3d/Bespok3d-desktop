// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// Detached-signature verification for a fetched registry index (ADR-0009 publisher tier). The
// contract is over RAW SERVED BYTES: a signature vouches for the exact bytes the transport received,
// so verifying a re-serialized copy of the same logical content MUST fail. An inline `signature`
// field inside the index is not a thing and never will be, it would sign itself.
import * as openpgp from 'openpgp'
import type { SignatureCheck } from '../model'

// The trust anchor. A detached signature names its issuer, but that claim is forgeable and only
// worth the key it is checked against, so the org's registry signing key travels WITH the app rather
// than arriving beside the list it vouches for. Mirrors main-index/keys/bespok3d-list.pub.asc; the
// fingerprint is DERIVED from this key at verify time, never declared as a constant beside it.
export const OFFICIAL_LIST_PUBLIC_KEY = `-----BEGIN PGP PUBLIC KEY BLOCK-----

mQINBGoe+wUBEADJjkI85zRmpx2XmaU2e7eb1OGR0Khw0z5dByvQ0odMovBhInK4
mmWR1d+DL2yLt8QNh421LGuBd1iWXSx6jTKPi8PcxBSxfhfJydJWIji58HFN/sTd
dyk+I20Ln9k0B0A8BpLnSzVUTEKYrqYiRSAJcPVkrA1myp3X4kUt/DyqERHE/HF+
bmwMsW0pgpdvs1umUOV7EdpADWorfWcWFOGKFJSGbd8K3hjFR9IPt6sPeKsUGU5U
01hdFp89a/DAX/Q2LGQP/v+WNUpNQtj6CMPRPc2sjNcyH16m9EsIugkWoimxsoSk
gKAoINq+gQtp/qckQiXoApXnB1ewQfWmz0C+zAoSL/qXd/QEpStZhgvlDX4eOeUl
LdOLleRnwqorNgz4Qr96C1uETJF2ew8iZm5v4nPOidP9eG0OOrYsiHjmiOubD3A9
V6GLGiaVuRNJ1dIew615bOmOhQY/8Sa32QoUeDYVDEL4pZxyk+fuxObvBGfvRFdG
wuuVvEXX0L+Ne7KSHSVUXQGGobjfrektB8OSOFpAM9iGAhtH/lCXq8OjogjzoetE
47JflKHZLmAaspl16WrsRk+GPxGwAf8ckAs7GxgaxbTECkeauG2Iqcmme1k+3kmK
NQBrQq5NMz4A+OMN0g/4BO/S8RkLtxC1cjDCZ72MNgzh4lt+to91Vr8R6wARAQAB
tFFCZXNwb2szZCBSZWdpc3RyeSBTaWduaW5nIEtleSAob2ZmaWNpYWwgbGlzdCBz
aWduaW5nIGtleSkgPHJlZ2lzdHJ5QGJlc3BvazNkLm9yZz6JAm0EEwEIAFcWIQRn
mTlVWBn7X2Qj3GjEOI52v6m04AUCah77BRsUgAAAAAAEAA5tYW51MiwyLjUrMS4x
MiwwLDMCGwMFCwkIBwICIgIGFQoJCAsCBBYCAwECHgcCF4AACgkQxDiOdr+ptOAq
7BAAlCoYtauXk8As3ajW2IJLUOYHxtal+h4UUaXiiNKwgtZBbnIZByfDZ68veDoP
SQ3PfKLKgypuJqGNRKCORiP/zw2Co7AqwHgsG9G5B48SsDIQlRX1nad5Acc5XyHN
GKqDu0mxQd9GVU96zhOknZoF4f2yrrHhrv1OYrbzHsp9ktyddfyO4izurs0zPh6B
6ln1AgbOwc+yMG3NjqpmjEgXn/5B+WCXU/9wwOC8TmOGdZHtdVgzExZEbEgRkqe+
Wzq8Or8at+CLn2BCyYyKJcRQVDNYubjpE0BsYw4t/n01PwDKlgk4Kc4JPmjAXgqh
7ZJDegBIb14+rhwptKBpr/bGHJxJQBqAPmeqIPjNYNSkXlVbToS8RRsy5/7wWm7E
UKQChOBY4CZ9+d6H7IEIkj6Cay0NRDNRGBJ8H1ePsA9P8xCU567F0iEXwKKmWPiL
lB1lLI5KScW7kfx9iHQ8NKGxhmiDbB7J/Zd+et5WZIKONit+xifU4YVOpELbhRYA
6G7i1pFOQhXLZG832pKMqHCPCpBqT5imrJ2NKYqCHyZ2aVi3gK6mpYWnzSh5Xcpv
HGkr0kOBhL1zF6g4Cn/wU26QI4mQ2eEOqBRhUTFBbBZ7fQTbFgA4AV9Gwi8L6tNB
At5hzMkILtyaJ1gDVIBv/Qmet5QtOB22Sq54rRL4W+igroM=
=DgD7
-----END PGP PUBLIC KEY BLOCK-----
`

// The org's publisher key, the one b3-builder signs with when the org releases plugin lists and
// packages of its own. It joins the registry key rather than replacing it: both are Bespok3d's, so a
// list or package either one signed reads as published by Bespok3d. Mirrors
// main-index/keys/lixnix-publisher.pub.asc; as above, the fingerprint is derived at verify time.
export const LIXNIX_PUBLISHER_PUBLIC_KEY = `-----BEGIN PGP PUBLIC KEY BLOCK-----

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
2e8jQi4Q9BGRE4e9CURPXg==
=P1O8
-----END PGP PUBLIC KEY BLOCK-----
`

// Every key a served list may be signed with. Plural for the same reason the package anchor set is:
// the curated index is signed with the registry key and the org's own plugin lists with the publisher
// key, and a rotation has to accept the outgoing and the incoming key at the same time.
const OFFICIAL_LIST_KEYS: readonly string[] = [OFFICIAL_LIST_PUBLIC_KEY, LIXNIX_PUBLISHER_PUBLIC_KEY]

// The trust anchor is a parameter rather than a closed-over constant so the predicate can be exercised
// against a throwaway key pair in tests: the real private half is an Actions secret and never comes
// near this repo, so a hard-wired anchor would leave the passing case permanently untested.
//
// Signed bytes arrive as text for an index served over HTTP and as raw bytes for a `manifest.json`
// read out of a `.b3` zip member. Both are the SAME contract (a signature covers exact bytes), so the
// binary form is accepted directly rather than being routed through a decode/re-encode round trip
// that could silently alter what gets verified.
//
// openpgp raises on some malformed or unknown-issuer inputs, so the guard sits HERE and not in the
// wrapper below: this function is exported, and a direct caller reading `Promise<string | null>` must
// get null rather than an unhandled rejection.
export async function fingerprintOfValidSigner(signedBytes: string | Uint8Array, armoredSignature: string, armoredTrustAnchor: string): Promise<string | null> {
  return signerOfCheckedSignature(signedBytes, armoredSignature, armoredTrustAnchor).catch(() => null)
}

function binaryOf(signedBytes: string | Uint8Array): Uint8Array {
  return typeof signedBytes === 'string' ? new TextEncoder().encode(signedBytes) : signedBytes
}

async function signerOfCheckedSignature(signedBytes: string | Uint8Array, armoredSignature: string, armoredTrustAnchor: string): Promise<string | null> {
  const message = await openpgp.createMessage({ binary: binaryOf(signedBytes) })
  const signature = await openpgp.readSignature({ armoredSignature })
  const verificationKeys = await openpgp.readKey({ armoredKey: armoredTrustAnchor })
  const { signatures } = await openpgp.verify({ message, signature, verificationKeys })
  const [issued] = signatures
  if (!issued) return null

  return issued.verified.then(() => verificationKeys.getFingerprint().toUpperCase(), () => null)
}

// What the signature beside these bytes proved. A list served with no signature and a list served
// with a signature that does not check out are DIFFERENT facts and come back as different values:
// the first is a publisher who never signed, the second is bytes that do not match the signature
// somebody issued over them. Neither is an error here (NO-DOWNGRADE): the caller renders the outcome
// as a badge and the list still loads, so a signing mistake costs a wrong badge rather than a dead
// store. A malformed signature counts as failed: something was served in the signature's place and it
// did not stand up.
//
// The key set is a parameter for the same reason the anchor above is: the private halves are CI
// secrets that never come near this repo, so a closed-over set would leave the passing path untestable.
export async function verifyIndexSignature(servedBytes: string, armoredSignature: string | null, trustedKeys: readonly string[] = OFFICIAL_LIST_KEYS): Promise<SignatureCheck> {
  if (!armoredSignature) return { proof: 'unsigned' }
  const fingerprint = await fingerprintOfTrustedSigner(servedBytes, armoredSignature, trustedKeys)

  return fingerprint === null ? { proof: 'failed' } : { proof: 'signed', fingerprint }
}

// The fingerprint of the first pinned key that issued a valid signature over these exact bytes. Walks
// the set rather than short-circuiting on a claimed issuer, because the issuer named inside a
// signature is attacker controlled and only the key it is checked against decides anything.
async function fingerprintOfTrustedSigner(servedBytes: string, armoredSignature: string, trustedKeys: readonly string[]): Promise<string | null> {
  const [armoredKey, ...remainingKeys] = trustedKeys
  if (!armoredKey) return null
  const fingerprint = await fingerprintOfValidSigner(servedBytes, armoredSignature, armoredKey)
  if (fingerprint) return fingerprint

  return fingerprintOfTrustedSigner(servedBytes, armoredSignature, remainingKeys)
}

// Who a proved signature belongs to, in a word a person can read. A fingerprint is evidence, not
// something to show anyone, and the check above accepts only the org's own keys, so a proof that came
// back 'signed' can only be Bespok3d's. Anything else carries through as "nobody proved this", which
// is what the store shows instead of repeating a publisher line no signature stands behind.
export function provedSigner(signature: SignatureCheck): string | null {
  return signature.proof === 'signed' ? OFFICIAL_SIGNER_NAME : null
}

const OFFICIAL_SIGNER_NAME = 'Bespok3d'
