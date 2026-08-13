// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// What the published lists last offered for the printer's own machinery: the daemon, and each
// adapter's jinni. Both ship as their own signed packages precisely so a fix reaches printers
// without an app release behind it, and a daemon release that needs a newer jinni moves the pair.
//
// Every reader of "which version would this app install" is synchronous, so what the last list pass
// learned is written down here rather than asked for again. A leaf on purpose: the catalog read
// stamps it and the daemon and jinni sides read it, so none of them imports another.
import { isReleaseNewer } from '@bespok3d/contract'
import { loadSettings, saveSettings } from '../settings'
import type { MergedEntry } from './model'

// Which entries are machinery is decided by this build (compat/system-packages writes the flag from
// the daemon's own name plus every registered adapter's declared jinni package), never by what a
// published list claims about itself.
export function stampOfferedSystemVersions(plugins: readonly MergedEntry[]): void {
  const machinery = plugins.filter((entry) => entry.system_package)
  if (machinery.length === 0) return

  rememberOffers(Object.fromEntries(machinery.map((entry) => [entry.name, entry.version])))
}

// The offer the app has just acted on, written down as the bytes are opened. The deploy path reads
// the lists for itself, so without this a printer could be handed a published daemon while every
// version this app names still said the copy in the build, and the next repair would be refused as a
// downgrade off a version the app itself installed.
export function rememberOfferedSystemVersion(packageName: string, version: string): void {
  rememberOffers({ [packageName]: version })
}

function rememberOffers(offers: Record<string, string>): void {
  saveSettings({ offeredSystemVersions: { ...loadSettings().offeredSystemVersions, ...offers } })
}

// The version this app would put on a printer for one machinery package: what the lists offered when
// they were last read, or the copy this build ships when that is the newer of the two. A published
// list that is behind the build never drags a printer backwards, and a machine that has never read a
// list gets exactly what it always got.
export function installableVersion(packageName: string, shippedVersion: string): string {
  const offered = loadSettings().offeredSystemVersions?.[packageName]

  return offered && isReleaseNewer(shippedVersion, offered) ? offered : shippedVersion
}

// Forgetting an offer the app could not act on: the download failed, so the printer is getting the
// copy this build ships and every version reader has to say so, or the version check after the
// upload refuses a daemon that is on the printer and working. The next list read stamps the offer
// again, and the update is offered again with it.
export function forgetOfferedSystemVersion(packageName: string): void {
  const remembered = Object.entries(loadSettings().offeredSystemVersions ?? {})

  saveSettings({ offeredSystemVersions: Object.fromEntries(remembered.filter(([name]) => name !== packageName)) })
}
