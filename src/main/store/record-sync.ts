// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { PrinterRecord } from '../printers'
import { fetchCapabilities } from '../daemon-client/client'
import { parseCaps } from '../daemon-client/status'

// Capabilities after an install, with the just-installed plugin folded in even when the device is
// briefly unreachable: the install already succeeded, so the plugin IS present at the known version.
export async function capsOrFallback(record: PrinterRecord, extraVersions: Record<string, string>): Promise<ReturnType<typeof parseCaps>> {
  try {
    return parseCaps(await fetchCapabilities(record), record.ip)
  } catch {
    const installedVersions = { ...record.installedVersions, ...extraVersions }

    return {
      installedIds: Object.keys(installedVersions),
      installedVersions,
      endpoints: record.endpoints ?? [],
      firmwareVersion: record.firmwareVersion ?? 'unknown',
      jinniVersion: record.jinniVersion ?? 'unknown',
      jinniCapabilities: record.jinniCapabilities ?? [],
      jinniExtras: record.jinniExtras ?? [],
    }
  }
}

export function capsAfterInstall(record: PrinterRecord, pluginId: string, version: string): Promise<ReturnType<typeof parseCaps>> {
  return capsOrFallback(record, { [pluginId]: version })
}

// Keep only the entries of a plugin-id-keyed record map whose plugin is still installed. Uninstall
// (and cascade removal of dependents) must drop the removed ids, or stale provenance makes a later
// fresh install read leftover data (wrong source badge, a dead log tab, outdated applied vars).
export function retainForInstalled<Value>(byPluginId: Record<string, Value> | undefined, installedIds: string[]): Record<string, Value> {
  const stillInstalled = new Set(installedIds)

  return Object.fromEntries(Object.entries(byPluginId ?? {}).filter(([pluginId]) => stillInstalled.has(pluginId)))
}

// A plugin that was just removed takes its last failed attempt with it: nothing is left on the printer
// for that reason to be about, so a later fresh install starts clean. Failed attempts are NOT pruned to
// the installed set the way provenance is - a plugin that never installed at all is exactly the case
// that has to keep its reason.
function forgetFailuresOfRemoved(record: PrinterRecord, installedIds: string[]) {
  const removedIds = record.installedIds.filter((pluginId) => !installedIds.includes(pluginId))

  return Object.fromEntries(Object.entries(record.failedInstallLogs ?? {}).filter(([pluginId]) => !removedIds.includes(pluginId)))
}

// The per-plugin provenance pruned to the still-installed set after any removal (single or batch).
export function retainRemovalProvenance(record: PrinterRecord, installedIds: string[]) {
  return {
    failedInstallLogs: forgetFailuresOfRemoved(record, installedIds),
    installedSources: retainForInstalled(record.installedSources, installedIds),
    installedChannels: retainForInstalled(record.installedChannels, installedIds),
    installLogs: retainForInstalled(record.installLogs, installedIds),
    appliedPluginVars: retainForInstalled(record.appliedPluginVars, installedIds),
    appliedPluginVarsAt: retainForInstalled(record.appliedPluginVarsAt, installedIds),
  }
}

// The truth-ladder tier-2 record: what THIS computer sent for a plugin and when. Recorded at every
// send site (install, reconfigure, batch) so the Config tab can honestly say "as sent from this
// computer on [date]" when the daemon's live value cannot be read. A plugin sent without vars
// records the empty map: "we sent nothing" is itself a truthful last-known state.
export function recordAppliedVars(record: PrinterRecord, pluginId: string, vars: Record<string, string> | undefined, atIso: string) {
  return {
    appliedPluginVars: { ...record.appliedPluginVars, [pluginId]: vars ?? {} },
    appliedPluginVarsAt: { ...record.appliedPluginVarsAt, [pluginId]: atIso },
  }
}
