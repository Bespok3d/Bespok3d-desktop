import type { Printer } from '../types'
import { isNewerVersion } from '../../utils/version'

// The deployed jinni is older than the one this app build ships (the jinni versions independently of
// the daemon). Only a STRICTLY NEWER bundled jinni counts as lagging: a device on the same or a newer
// jinni is never nagged, so we never propose a downgrade. "unknown" means a daemon too old to report
// it, so we never nag in that case either.
export function jinniLags(deviceVersion: string | undefined, bundledVersion: string): boolean {
  if (!deviceVersion || deviceVersion === 'unknown') return false

  return isNewerVersion(bundledVersion, deviceVersion)
}

export interface PendingUpdates {
  daemon: boolean
  jinni: boolean
}

export type UpdateCalloutKind = 'daemon' | 'jinni' | 'both'

// The device-side updates pending for a printer, gated to `managed`: an offline, unenrolled, or
// daemon-down printer cannot be updated, so it must never prompt one (that was the offline-row bug).
// Both can be true at once; the caller decides whether to show two attention badges or one action.
export function pendingUpdates(printer: Printer, adapterJinniVersion: string | undefined): PendingUpdates {
  if (printer.status !== 'managed') return { daemon: false, jinni: false }

  return {
    daemon: Boolean(printer.daemonUpdateAvailable),
    jinni: Boolean(adapterJinniVersion) && jinniLags(printer.jinniVersion, adapterJinniVersion as string),
  }
}

// The single update a row should offer. When both lag it is one action ('both') that runs the daemon
// update, which redeploys the jinni in the same pass; a jinni-only action fires only when the daemon is
// already current. Returns null when nothing is pending (or the printer is not managed).
export function updateCallout(printer: Printer, adapterJinniVersion: string | undefined): UpdateCalloutKind | null {
  const pending = pendingUpdates(printer, adapterJinniVersion)
  if (pending.daemon && pending.jinni) return 'both'
  if (pending.daemon) return 'daemon'
  if (pending.jinni) return 'jinni'

  return null
}
