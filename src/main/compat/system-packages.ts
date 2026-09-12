// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// Which catalog entries are the printer's own machinery rather than something a user chose to add.
// The daemon and each adapter's jinni arrive with enrollment and are replaced by an update; peeling
// either one off leaves an enrolled printer that cannot be managed, so the store must never offer it.
//
// Main is the only process that can KNOW both names: the daemon's own, and every registered adapter's
// declared `jinniPackage`. The renderer has neither string, and matching a `bespok3d-jinni-` prefix
// there would be a guess about what a third-party adapter calls its jinni. So the entries are marked
// here, at the boundary, before the renderer ever sees them.
import { DAEMON_PACKAGE } from '../daemon-client/version'
import { reportedVersionOrNull } from '@bespok3d/contract'
import type { Catalog } from '../registry'
import type { MergedEntry } from '../registry/model'

interface JinniCarrier {
  jinniPackage: string
}

interface RegisteredAdapter extends JinniCarrier {
  id: string
}

// What the printer answered about its own machinery. The daemon version comes off `/status` and the
// jinni version off `/capabilities`, so the two halves are read separately and arrive here together.
export interface MachineryReport {
  adapter: string
  // The id the printer was ENROLLED under, off the app's own record. A jinni reports whatever its
  // layout file says, and the klipper-linux one falls back to 'klipper-linux' (the name of the code
  // base, not of a registered id) when that file is missing. The record is then the only truth left.
  recordAdapter?: string
  daemonVersion?: string
  jinniVersion?: string
}

export function systemPackageNames(adapters: readonly JinniCarrier[]): ReadonlySet<string> {
  return new Set([DAEMON_PACKAGE, ...adapters.map((adapter) => adapter.jinniPackage)])
}

// A version the printer did not report is left out rather than filled with a placeholder: an entry
// with no real version reads as installed-at-nothing, which makes every catalog version look newer
// and puts a permanent Update on a card that may be perfectly current.
function versionEntry(packageName: string | undefined, version: string | undefined): Record<string, string> {
  const reported = reportedVersionOrNull(version)
  if (!packageName || !reported) return {}

  return { [packageName]: reported }
}

// Which registered adapter's jinni the printer is running. The printer's own answer comes first: it
// is the live truth, and a printer re-enrolled onto another adapter says so before the record does.
// An answer that names no registered id is not the end of the road, because the id the printer was
// enrolled under is on the record: without that second look the jinni version is silently dropped and
// the store offers to install a jinni the printer already runs.
function jinniPackageFor(reported: MachineryReport, adapters: readonly RegisteredAdapter[]): string | undefined {
  const asReported = adapters.find((adapter) => adapter.id === reported.adapter)
  if (asReported) return asReported.jinniPackage

  return adapters.find((adapter) => adapter.id === reported.recordAdapter)?.jinniPackage
}

// The versions the printer's machinery is actually running, keyed by package name so the store can
// read them exactly like a plugin's. The daemon's own package list covers the plugin tree, and the
// machinery lives outside it, so without this the store has no version for either the daemon or the
// jinni and offers to install a printer what it is already running.
export function runningMachineryVersions(reported: MachineryReport, adapters: readonly RegisteredAdapter[]): Record<string, string> {
  const jinniPackage = jinniPackageFor(reported, adapters)

  return { ...versionEntry(DAEMON_PACKAGE, reported.daemonVersion), ...versionEntry(jinniPackage, reported.jinniVersion) }
}

// The flag is WRITTEN on every entry, never passed through: a published list that declared
// `system_package: true` about its own plugin would otherwise hand itself a card with no way to
// remove it. What this build carries decides, not what a list says about itself.
function markOneEntry(entry: MergedEntry, systemNames: ReadonlySet<string>): MergedEntry {
  return { ...entry, system_package: systemNames.has(entry.name) }
}

export function markSystemPackages(catalog: Catalog, adapters: readonly JinniCarrier[]): Catalog {
  const systemNames = systemPackageNames(adapters)

  return { ...catalog, plugins: catalog.plugins.map((entry) => markOneEntry(entry, systemNames)) }
}
