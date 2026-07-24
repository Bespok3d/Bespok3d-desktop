// Install-time verification of a `.b3` against the trusted anchor set. This is the last point at which
// the app can still say no: past it the bytes are on the printer. Everything upstream (the index, the
// download url, the on-disk cache) is a claim about which bytes to install, and a claim is exactly what
// an attacker gets to make, so the check is over the archive itself and is redone on EVERY install,
// including a cache hit. A buffer that verified yesterday proves nothing about the file on disk today.
//
// Two refusal classes, per the NO-DOWNGRADE policy. An ABSENT signature is not a failure: it is missing
// proof, so the package installs at tier 'unknown'. A signature that is present and does not check out,
// a signed package that does not enumerate its own payload, a manifest naming a different plugin, or a
// version below what the index carries are all hard refusals in every mode, with no override.
import AdmZip from 'adm-zip'
import { compareSemanticVersions } from '../app-update/version'
import type { MergedEntry, PackageTrust } from '../registry/model'
import { parseManifest } from '../registry/local/b3-manifest'
import type { StoredManifest } from '../registry/local/b3-manifest'
import { fingerprintOfValidSigner } from '../registry/resolve/verify'
import { TRUSTED_PACKAGE_ANCHORS } from './trust-anchors'
import type { TrustAnchor } from './trust-anchors'
import { PackageRefusedError } from './package-refused'

export { PackageRefusedError, PACKAGE_REFUSED_PREFIX } from './package-refused'

interface SignedManifest {
  // The exact zip-member bytes, never a re-serialized copy of the parsed object: the signature covers
  // these and a JSON round trip through a formatter would produce different bytes that fail to verify.
  manifestBytes: Buffer
  armoredSignature: string | null
}

function readSignedManifest(archiveBytes: Buffer, pluginId: string): SignedManifest {
  const zip = new AdmZip(archiveBytes)
  const manifestEntry = zip.getEntry('manifest.json')
  if (!manifestEntry) throw new PackageRefusedError(`the package for "${pluginId}" has no manifest.json, so nothing about it can be verified`)
  const signatureEntry = zip.getEntry('manifest.json.sig')

  return {
    manifestBytes: manifestEntry.getData(),
    armoredSignature: signatureEntry ? signatureEntry.getData().toString('utf8') : null,
  }
}

// The first anchor whose key issued a valid signature over these exact bytes. Walks the set rather
// than short-circuiting on a claimed issuer, because the issuer named inside a signature is attacker
// controlled and only the key it is checked against decides anything.
async function anchorOfValidSignature(
  manifestBytes: Buffer,
  armoredSignature: string,
  anchors: readonly TrustAnchor[],
): Promise<TrustAnchor | null> {
  const [anchor, ...remainingAnchors] = anchors
  if (!anchor) return null
  const fingerprint = await fingerprintOfValidSigner(manifestBytes, armoredSignature, anchor.armoredKey)
  if (fingerprint) return anchor

  return anchorOfValidSignature(manifestBytes, armoredSignature, remainingAnchors)
}

// Binds the package to the catalog entry the user actually chose. Without this a valid signature is
// not enough: a correctly signed package of a DIFFERENT plugin, or an older signed release of the same
// one, would sail through signature verification and install in place of what was asked for.
function refuseUnlessManifestMatchesEntry(manifest: StoredManifest, entry: MergedEntry): void {
  if (manifest.name !== entry.name) {
    throw new PackageRefusedError(`the package served for "${entry.name}" contains plugin "${manifest.name}" instead, so it was not installed`)
  }
  if (compareSemanticVersions(manifest.version, entry.version) < 0) {
    throw new PackageRefusedError(
      `the package served for "${entry.name}" is version ${manifest.version}, older than the listed ${entry.version}, so it was not installed`,
    )
  }
}

// A signed manifest that enumerates no files signs nothing of substance: the payload would ride along
// uncovered by the signature that makes the package look trustworthy. Presence and non-emptiness only;
// matching the list against the archive's actual members is a separate, stricter enforcement.
function refuseUnlessPayloadIsEnumerated(manifest: StoredManifest, pluginId: string): void {
  const packedFiles = manifest.files
  if (!Array.isArray(packedFiles) || packedFiles.length === 0) {
    throw new PackageRefusedError(`the signed package for "${pluginId}" lists no files, so its signature covers nothing that would be installed`)
  }
}

// The trust tier this package earns, or a throw if it must not be installed at all. The anchor set is
// a parameter for the same reason the index verifier's anchor is: the org's private key is a CI secret
// that never comes near this repo, so a closed-over set would leave the passing path untestable.
export async function verifiedPackageTrust(
  archiveBytes: Buffer,
  entry: MergedEntry,
  anchors: readonly TrustAnchor[] = TRUSTED_PACKAGE_ANCHORS,
): Promise<PackageTrust> {
  const { manifestBytes, armoredSignature } = readSignedManifest(archiveBytes, entry.name)
  const manifest = parseManifest(manifestBytes.toString('utf8'))
  refuseUnlessManifestMatchesEntry(manifest, entry)
  if (!armoredSignature) return 'unknown'
  const anchor = await anchorOfValidSignature(manifestBytes, armoredSignature, anchors)
  if (!anchor) {
    throw new PackageRefusedError(`the signature on the package for "${entry.name}" does not check out against any key this app trusts, so it was not installed`)
  }
  refuseUnlessPayloadIsEnumerated(manifest, entry.name)

  return anchor.tier
}
