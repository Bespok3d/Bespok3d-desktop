// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { MigrationOffer } from './offer'

// The two shapes of a change read differently to the user: one plugin leaves and others take over its
// job, or one plugin stays and starts working differently. Every sentence the banner and the dialog
// show comes in both, and which of the two is showing is decided here once rather than at each line.
export function migrationCopyKey(offer: MigrationOffer, base: string): string {
  return offer.comingOffThePrinter ? `migration.${base}` : `migration.${base}_in_place`
}
