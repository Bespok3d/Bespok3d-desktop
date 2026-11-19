// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Printer } from '../types'
import { isUpgradeOffered } from '@bespok3d/contract'

// The jinni this app would put on a printer of one adapter: its version, the package it ships as (the
// key the printer names its jinni fingerprint under), and that build's fingerprint when one is known.
export interface JinniOffer {
  version: string
  packageName: string
  fingerprint?: string
}

type JinniOnPrinter = Pick<Printer, 'jinniVersion' | 'machineryFingerprints'>

// The deployed jinni is behind the one this app would install (the jinni versions independently of the
// daemon): a newer version, or the same version built differently when both fingerprints are known. A
// device on a newer jinni is never nagged, so we never propose a downgrade. "unknown" means a daemon
// too old to report it, so we never nag in that case either.
export function jinniLags(printer: JinniOnPrinter, offer: JinniOffer): boolean {
  if (!printer.jinniVersion || printer.jinniVersion === 'unknown') return false
  const onPrinter = { version: printer.jinniVersion, fingerprint: printer.machineryFingerprints?.[offer.packageName] }

  return isUpgradeOffered(onPrinter, offer, 'release')
}

export interface PendingUpdates {
  daemon: boolean
  jinni: boolean
}

export type UpdateCalloutKind = 'daemon' | 'jinni' | 'both'

// The device-side updates pending for a printer, gated to `managed`: an offline, unenrolled, or
// daemon-down printer cannot be updated, so it must never prompt one (that was the offline-row bug).
// Both can be true at once; the caller decides whether to show two attention badges or one action.
export function pendingUpdates(printer: Printer, adapterJinniOffer: JinniOffer | undefined): PendingUpdates {
  if (printer.status !== 'managed') return { daemon: false, jinni: false }

  return {
    daemon: Boolean(printer.daemonUpdateAvailable),
    jinni: adapterJinniOffer !== undefined && jinniLags(printer, adapterJinniOffer),
  }
}

// The single update a row should offer. When both lag it is one action ('both') that runs the daemon
// update, which redeploys the jinni in the same pass; a jinni-only action fires only when the daemon is
// already current. Returns null when nothing is pending (or the printer is not managed).
export function updateCallout(printer: Printer, adapterJinniOffer: JinniOffer | undefined): UpdateCalloutKind | null {
  const pending = pendingUpdates(printer, adapterJinniOffer)
  if (pending.daemon && pending.jinni) return 'both'
  if (pending.daemon) return 'daemon'
  if (pending.jinni) return 'jinni'

  return null
}
