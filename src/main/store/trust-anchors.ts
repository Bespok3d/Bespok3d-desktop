// The anchor SET a package signature is checked against at install time. Plural by construction, not
// as speculative generality: a key rotation has to trust the outgoing and the incoming key at the same
// time or every package signed by the other one becomes uninstallable overnight, and a community
// publisher's key is a real future member that must land at a LOWER tier than the org's rather than
// being bolted on as a second code path.
//
// An anchor carries the tier its signature confers, so trust is a property of WHICH key signed the
// bytes rather than a judgement made at the call site. A key absent from this list confers nothing:
// its signature is not weaker proof, it is no proof, and the package is refused.
import type { PackageTrust } from '../registry/model'
import { OFFICIAL_LIST_PUBLIC_KEY } from '../registry/resolve/verify'

export interface TrustAnchor {
  armoredKey: string
  tier: PackageTrust
}

// Seeded with the org key that already ships for index verification, because it is the only key the
// app pins today. A dedicated package-signing key (and whether it replaces this one or joins it) is
// settled where the org key material itself is settled, and lands here as another entry.
export const TRUSTED_PACKAGE_ANCHORS: readonly TrustAnchor[] = [{ armoredKey: OFFICIAL_LIST_PUBLIC_KEY, tier: 'project' }]
