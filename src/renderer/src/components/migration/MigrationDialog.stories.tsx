// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { MigrationDialog } from './MigrationDialog'
import type { MigrationOffer } from './offer'

export default { title: 'App / Migration dialog' }

const OFFER: MigrationOffer = {
  migratingPluginId: 'klipper-motion',
  comingOffThePrinter: true,
  migratingName: 'Smoother Motion',
  summary: 'This one is not a single plugin any more: it comes off, and the 3 plugins that took over its job go on in its place.',
  arrivingNames: ['Resonance Tester', 'Shaper Calibrate', 'Toolhead'],
  daemonReady: true,
  migration: { migratingPluginId: 'klipper-motion', comingOffThePrinter: true, arrivingSpecs: [] },
}

function noop() {}

// What the move will do, in the two lists the user cares about, before anything is touched.
export function WhatIsMoving() {
  return <MigrationDialog offer={OFFER} onConfirm={noop} onCancel={noop} />
}

// One plugin retiring into one replacement reads the same way; the lists just get shorter.
export function OneForOne() {
  return <MigrationDialog offer={{ ...OFFER, migratingName: 'Spoolman Helper', arrivingNames: ['Spoolman'] }} onConfirm={noop} onCancel={noop} />
}
