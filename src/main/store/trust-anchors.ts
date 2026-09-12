// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
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
import { LIXNIX_PUBLISHER_PUBLIC_KEY, OFFICIAL_LIST_PUBLIC_KEY } from '../registry/resolve/verify'

export interface TrustAnchor {
  armoredKey: string
  tier: PackageTrust
}

// The org's two keys: the registry key that signs the curated index, and the publisher key b3-builder
// signs with when the org releases plugins of its own. Both are Bespok3d's, so both confer 'project';
// a community publisher's key lands here as another entry at 'community', not as a second code path.
export const TRUSTED_PACKAGE_ANCHORS: readonly TrustAnchor[] = [
  { armoredKey: OFFICIAL_LIST_PUBLIC_KEY, tier: 'project' },
  { armoredKey: LIXNIX_PUBLISHER_PUBLIC_KEY, tier: 'project' },
]
