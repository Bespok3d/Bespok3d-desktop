// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { MigrationBanner } from './MigrationBanner'
import type { MigrationOffer } from './offer'

export default { title: 'App / Migration banner' }

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

// The printer is ready: the only thing left is to press the button and read what it is about to do.
export function ReadyToMove() {
  return <MigrationBanner offer={OFFER} printerName="Junior" onUpdateDaemon={noop} onStart={noop} />
}

// The daemon on the printer is older than the takeover needs, so the banner asks for that first
// instead of offering a move that would fail halfway through.
export function DaemonTooOld() {
  return <MigrationBanner offer={{ ...OFFER, requiredDaemon: '0.14.0', daemonReady: false }} printerName="Junior" onUpdateDaemon={noop} onStart={noop} />
}
