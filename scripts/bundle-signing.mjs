// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// The trust half of the app's bundled build (app-bundle.mjs owns discovery, packing and the catalog;
// this owns identity and signatures). The bundled index and the .b3 files beside it are the artifacts
// the app itself verifies at install time (src/main/store/verify-package.ts), so a
// bundled build that packs unsigned ships packages the app can only ever rate 'unknown' and never
// exercises its own refusal path locally.
//
// The armored private key arrives ONLY through the environment, never argv: an ASCII-armored key
// starts with `-----BEGIN`, which node's parseArgs refuses as an option value, and an argv-borne
// private key is readable by every process on the machine through ps. REGISTRY_SIGNING_KEY is the same
// name main-index's assemble.mjs reads and the org's release workflows already carry, so one key
// serves every producer of a signed Bespok3d artifact.

export const SIGNING_KEY_VAR = 'REGISTRY_SIGNING_KEY'

// The one place the list public key is checked in, in the sibling repo that publishes the online
// index. The bundled build reads it rather than keeping its own copy, so the fingerprint the offline
// index advertises and the one the online index advertises cannot drift apart.
const LIST_PUBLIC_KEY_RELPATH = ['..', 'main-index', 'keys', 'bespok3d-list.pub.asc']

// The publisher is DERIVED, never typed in, and it is derived from the key that ACTUALLY SIGNED this
// build whenever there is one: a publisher taken from anywhere else is a second claim that can
// disagree with the signatures beside it, and a build signed by one key while advertising another
// produces packages the app REFUSES (a mismatched signature is tampering, not a missing badge) while
// reporting success. An unsigned build has no signature to agree with, so it advertises the org's
// published list key, and a checkout without the sibling main-index keeps the caller's placeholder.
export async function listPublisher(fsPromises, join, sourceRoot, builder, placeholderPublisher, signingKey) {
  if (signingKey) return builder.signingKeyFingerprint(signingKey)
  const armoredKey = await readListPublicKey(fsPromises, join, sourceRoot)
  if (armoredKey === null) return placeholderPublisher

  return builder.publicKeyFingerprint(armoredKey)
}

// A checkout without the sibling main-index has no published identity to advertise, which is a normal
// state. Anything else (an unreadable key file, a path renamed mid key-rotation) is NOT: swallowing it
// would advertise the placeholder publisher on a build that is otherwise a real signed release.
async function readListPublicKey(fsPromises, join, sourceRoot) {
  const keyPath = join(sourceRoot, ...LIST_PUBLIC_KEY_RELPATH)

  return fsPromises.readFile(keyPath, 'utf8').catch((readFailure) => {
    if (readFailure.code === 'ENOENT') return null
    throw readFailure
  })
}

// The same identity the index advertises is written into every packed manifest, so a package and the
// catalog entry that offers it never name two different publishers. It runs on skipped archives too (a
// .b3 an earlier build packed still carries that build's publisher) and it runs BEFORE signing, because
// the signature covers the manifest bytes this rewrites.
export function stampPublisher(builder, packages, publisher) {
  return packages.filter((packed) => builder.stampManifestPublisherInPlace(packed.path, publisher)).length
}

// Every packed .b3 gets its manifest signed, the skipped ones included: skip-unchanged decides whether
// the ARCHIVE had to be rebuilt, which says nothing about whether it already carries a signature from
// this key (a .b3 packed by an earlier unsigned build is unchanged and unsigned). Signing is a replace,
// so re-signing an already-signed archive is a no-op in effect rather than a second entry. With no key
// the same reasoning runs backwards: a signature an earlier keyed build left inside an archive this run
// did not repack is REFUSED at install, so an unsigned build peels it rather than serving it.
export async function signPackages(builder, packages, signingKey) {
  if (!signingKey) return { signed: 0, peeled: packages.filter((packed) => builder.unsignManifestInPlace(packed.path)).length }
  await Promise.all(packages.map((packed) => builder.signManifestInPlace(packed.path, signingKey)))

  return { signed: packages.length, peeled: 0 }
}

// index.json and its signature are ONE artifact, so they are written together, and a run that produced
// no signature DELETES the stale one: a signature that no longer matches the index beside it reads to
// the app as tampering, not as an unsigned index. Signing happens BEFORE anything is written (a signing
// failure leaves the previous good pair untouched) and the stale signature goes BEFORE the new index
// bytes, so a run interrupted between the two writes leaves an unsigned index (trust tier 'unknown')
// rather than an index its neighbouring signature no longer matches (a hard refusal).
export async function writeSignedIndex(fsPromises, indexPath, bytes, signingKey, builder) {
  const signature = signingKey ? await builder.signDetached(Buffer.from(bytes, 'utf8'), signingKey) : null
  await fsPromises.rm(`${indexPath}.sig`, { force: true })
  await fsPromises.writeFile(indexPath, bytes)
  if (signature === null) return false
  await fsPromises.writeFile(`${indexPath}.sig`, signature)

  return true
}
