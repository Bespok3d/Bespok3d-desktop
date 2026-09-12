// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect } from 'vitest'
import * as openpgp from 'openpgp'
import { TRUSTED_PACKAGE_ANCHORS } from './trust-anchors'
import type { TrustAnchor } from './trust-anchors'

// Mirrors main-index/keys/bespok3d-list.pub.asc and main-index/keys/lixnix-publisher.pub.asc. The
// fingerprints are derived from the bundled keys here so that a pasted-wrong key, or one that quietly
// stopped matching the registered copy, fails a test rather than refusing every package at install.
const REGISTRY_FINGERPRINT = '679939555819FB5F6423DC68C4388E76BFA9B4E0'
const PUBLISHER_FINGERPRINT = '03034E2A08882463984D06E96098E51D45A94591'

async function derivedAnchor(anchor: TrustAnchor): Promise<{ fingerprint: string; tier: TrustAnchor['tier'] }> {
  const key = await openpgp.readKey({ armoredKey: anchor.armoredKey })

  return { fingerprint: key.getFingerprint().toUpperCase(), tier: anchor.tier }
}

describe('TRUSTED_PACKAGE_ANCHORS', () => {
  it('anchors the registry key and the publisher key, both at tier project', async () => {
    const anchors = await Promise.all(TRUSTED_PACKAGE_ANCHORS.map(derivedAnchor))
    expect(anchors).toEqual([
      { fingerprint: REGISTRY_FINGERPRINT, tier: 'project' },
      { fingerprint: PUBLISHER_FINGERPRINT, tier: 'project' },
    ])
  })
})
