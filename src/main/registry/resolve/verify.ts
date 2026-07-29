// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// Detached-signature verification for a fetched registry index (ADR-0009 publisher tier). The
// contract is over RAW SERVED BYTES: a signature vouches for the exact bytes the transport received,
// so verifying a re-serialized copy of the same logical content MUST fail. An inline `signature`
// field inside the index is not a thing and never will be, it would sign itself.
import * as openpgp from 'openpgp'

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

// The fingerprint of the key whose signature over these exact bytes checks out, or null when there
// is no proof: no signature, a malformed one, or one issued by a key we do not pin. Absence of proof
// is never an error here (NO-DOWNGRADE): the caller renders it as trust tier 'unknown' and the list
// still loads, so a signing mistake costs a wrong badge rather than a dead store.
export async function verifyIndexSignature(servedBytes: string, armoredSignature: string | null): Promise<string | null> {
  if (!armoredSignature) return null

  return fingerprintOfValidSigner(servedBytes, armoredSignature, OFFICIAL_LIST_PUBLIC_KEY)
}

// Who a proved fingerprint belongs to, in a word a person can read. A fingerprint is evidence, not
// something to show anyone, and the check above accepts exactly one pinned key, so a fingerprint that
// came back non-null can only be that key's. Null carries through as "nobody proved this", which is
// what the store shows instead of repeating a publisher line no signature stands behind.
export function provedSigner(fingerprint: string | null): string | null {
  return fingerprint === null ? null : OFFICIAL_SIGNER_NAME
}

const OFFICIAL_SIGNER_NAME = 'Bespok3d'
