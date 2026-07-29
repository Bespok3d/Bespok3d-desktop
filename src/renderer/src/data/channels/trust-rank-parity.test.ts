// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// The drift guard over the two trust rank tables: SOURCE_TRUST_RANK here in the renderer, and
// TRUST_RANK inside the registry resolver. The tier NAMES are single-sourced (TrustTier is an alias of
// RegistryTrust), but each table writes its own ORDER, and nothing else would notice if the two
// disagreed: the store would then rank a plugin's sources one way while the resolver had already
// picked a winner the other way. This test reads the resolver's order behaviourally, through the
// dedupe it drives, so no production export exists purely for a test.
import { describe, it, expect } from 'vitest'
import { dedupeEntries } from '../../../../main/registry/resolve/merge'
import type { MergedEntry } from '../../../../main/registry/model'
import { SOURCE_TRUST_RANK } from './index'
import type { TrustTier } from '../types'

const TRUST_TIERS = Object.keys(SOURCE_TRUST_RANK) as TrustTier[]

// The same plugin offered by two lists differing only in the trust each list was granted, so the
// dedupe winner is decided by trust order alone.
function cameraOfferedBy(trust: TrustTier): MergedEntry {
  return { name: 'camera', version: '1.0.0', trust, signer: null, registry_url: `registry:${trust}` }
}

// The loser is passed FIRST, so a resolver that had lost its trust ordering would keep it (first-seen
// wins on a tie) and this test would fail rather than pass by accident.
function resolverPickBetween(expectedWinner: TrustTier, expectedLoser: TrustTier): TrustTier {
  return dedupeEntries([cameraOfferedBy(expectedLoser), cameraOfferedBy(expectedWinner)])[0].trust
}

function tierPairsThisTableRanksHigherFirst(): Array<[TrustTier, TrustTier]> {
  return TRUST_TIERS.flatMap((higherTier) =>
    TRUST_TIERS
      .filter((lowerTier) => SOURCE_TRUST_RANK[lowerTier] < SOURCE_TRUST_RANK[higherTier])
      .map((lowerTier): [TrustTier, TrustTier] => [higherTier, lowerTier]),
  )
}

describe('SOURCE_TRUST_RANK matches the registry resolver order', () => {
  it('picks the same winner as the resolver for every pair of tiers', () => {
    const pairs = tierPairsThisTableRanksHigherFirst()
    const tierCount = TRUST_TIERS.length
    // Every tier holds a distinct rank, so all ordered pairs are present: an empty or short list here
    // would mean this table had collapsed two tiers and the loop below proved nothing.
    expect(pairs).toHaveLength((tierCount * (tierCount - 1)) / 2)
    pairs.forEach(([higherTier, lowerTier]) => expect(resolverPickBetween(higherTier, lowerTier)).toBe(higherTier))
  })
})
