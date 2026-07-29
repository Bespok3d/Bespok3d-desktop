// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ReleaseChannel } from '../settings'
import type { InstallLog, PluginRecoveryResult, RecoverResult } from '@bespok3d/contract'
import type { MergedEntry, PackageTrust } from '../registry/model'
import type { PrinterRecord } from '../printers'

export interface BatchProvenance {
  installedSources: Record<string, string>
  installedChannels: Record<string, ReleaseChannel>
  installedPackageTrust: Record<string, PackageTrust>
  installLogs: Record<string, InstallLog>
  appliedPluginVars: Record<string, Record<string, string>>
  appliedPluginVarsAt: Record<string, string>
}

// What verifying each package at resolve time established, carried through the batch so it can be
// recorded afterwards. Kept together because both halves are keyed the same way and are only valid for
// the exact bytes that were posted; recomputing either one after the fact would prove nothing.
export interface BatchEvidence {
  entryById: Map<string, MergedEntry>
  trustById: Map<string, PackageTrust>
}

// The plugins a batch installed OK that we still have a catalog entry for: the ones whose
// source/channel/log we can record. A failed plugin (deactivated on the device) is left out.
function installedOk(result: RecoverResult, entryById: Map<string, MergedEntry>): PluginRecoveryResult[] {
  return result.results.filter((pluginResult) => pluginResult.ok && entryById.has(pluginResult.pluginId))
}

function batchLog(pluginResult: PluginRecoveryResult, now: number): InstallLog {
  return { pluginId: pluginResult.pluginId, timestamp: now, ok: pluginResult.ok, phases: pluginResult.log }
}

// Per-plugin install state for a batch, mirroring what runStoreInstall records for a single install:
// each OK plugin's source URL, release channel, install log, and (for the plugins the user picked,
// not auto-added deps) the vars this computer sent, merged onto the record's existing maps. This is
// why the detail Log tab, the endpoints flyout, the source/channel badges, and the Config tab's
// last-known values work after a batch and not just after a single install. Pure (the timestamp is
// passed in), so it is testable.
export function recordBatchOutcome(record: PrinterRecord, result: RecoverResult, evidence: BatchEvidence, now: number, varsByPluginId: Map<string, Record<string, string> | undefined>): BatchProvenance {
  const { entryById, trustById } = evidence
  const ok = installedOk(result, entryById)
  function entryOf(pluginId: string): MergedEntry {
    return entryById.get(pluginId) as MergedEntry
  }
  const sources = ok.map((pluginResult) => [pluginResult.pluginId, entryOf(pluginResult.pluginId).registry_url] as const)
  const channels = ok.map((pluginResult) => [pluginResult.pluginId, entryOf(pluginResult.pluginId).channel as ReleaseChannel] as const)
  // A plugin whose bytes were never verified must not be recorded as 'unknown', which is the tier of a
  // package that WAS checked and simply carried no signature. Absent stays absent.
  const trusted = ok.filter((pluginResult) => trustById.has(pluginResult.pluginId))
  const trust = trusted.map((pluginResult) => [pluginResult.pluginId, trustById.get(pluginResult.pluginId) as PackageTrust] as const)
  const logs = ok.map((pluginResult) => [pluginResult.pluginId, batchLog(pluginResult, now)] as const)
  // Only plugins present in varsByPluginId (the user-picked specs) get an applied-vars entry; an
  // auto-added dep was sent without vars we can vouch for, same as the single-install path.
  const withVars = ok.filter((pluginResult) => varsByPluginId.has(pluginResult.pluginId))
  const appliedVars = withVars.map((pluginResult) => [pluginResult.pluginId, varsByPluginId.get(pluginResult.pluginId) ?? {}] as const)
  const appliedAt = withVars.map((pluginResult) => [pluginResult.pluginId, new Date(now).toISOString()] as const)

  return {
    installedSources: { ...record.installedSources, ...Object.fromEntries(sources) },
    installedChannels: { ...record.installedChannels, ...Object.fromEntries(channels) },
    installedPackageTrust: { ...record.installedPackageTrust, ...Object.fromEntries(trust) },
    installLogs: { ...record.installLogs, ...Object.fromEntries(logs) },
    appliedPluginVars: { ...record.appliedPluginVars, ...Object.fromEntries(appliedVars) },
    appliedPluginVarsAt: { ...record.appliedPluginVarsAt, ...Object.fromEntries(appliedAt) },
  }
}

// The OK plugins' versions, to fold into the installed set when a post-batch capabilities fetch fails,
// so a successful batch plugin is never dropped to "not installed" on a transient fetch hiccup.
export function batchOkVersions(result: RecoverResult, entryById: Map<string, MergedEntry>): Record<string, string> {
  const ok = installedOk(result, entryById)

  return Object.fromEntries(ok.map((pluginResult) => [pluginResult.pluginId, (entryById.get(pluginResult.pluginId) as MergedEntry).version]))
}
