// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// What a batch does with a package it will not send. A batch (update all, install selected, a
// collection) is a convenience button for installing those plugins one by one, so the outcome has to
// be the same as installing them one by one: a package the app refuses costs that plugin, and the
// plugins that need it, and nothing else. Every plugin left behind is reported at the end, in the same
// per-plugin results the daemon's own failures come back in.
import type { PluginRecoveryResult } from '@bespok3d/contract'
import type { BatchResult } from '../daemon-client/batch-result'
import type { PluginUpdateSpec } from './update-batch'
import { refusedAttempt, waitingOnDependencyReason } from './failed-installs'

// A plugin whose package never left the app: refused by the signature/identity checks, or impossible
// to fetch. Both are the same to the rest of the batch, which carries on without it.
export interface UnsentPackage {
  pluginId: string
  reason: string
}

function needsAnyOf(spec: PluginUpdateSpec, missingIds: ReadonlySet<string>): boolean {
  return (spec.depIds ?? []).some((depId) => missingIds.has(depId))
}

// Every plugin the batch has to leave behind: the ones whose own package was not sent, plus the ones
// that need any of those, plus the ones that need THOSE. Recurses until a pass adds nobody, bounded by
// the number of plugins in the batch. Installing a plugin whose dependency was refused would leave the
// printer running a plugin missing the thing it was built on.
export function pluginsLeftOut(specs: readonly PluginUpdateSpec[], unsentIds: ReadonlySet<string>): Set<string> {
  const alsoLeftOut = specs.filter((spec) => !unsentIds.has(spec.pluginId)).filter((spec) => needsAnyOf(spec, unsentIds))
  if (alsoLeftOut.length === 0) return new Set(unsentIds)

  return pluginsLeftOut(specs, new Set([...unsentIds, ...alsoLeftOut.map((spec) => spec.pluginId)]))
}

// The plugins the batch still sends. A batch also carries dependencies the user never picked, added
// only to serve a plugin that was picked; once that plugin is left out, its dependency has nobody left
// to serve, and sending it alone would install something the user never asked for (and, when the
// dependency chain runs deeper than one level, hand the printer a set it will reject as incomplete).
export function pluginsStillSent(specs: readonly PluginUpdateSpec[], leftOutIds: ReadonlySet<string>): Set<string> {
  const survivingSpecs = specs.filter((spec) => !leftOutIds.has(spec.pluginId))

  return new Set(survivingSpecs.flatMap((spec) => [spec.pluginId, ...(spec.depIds ?? [])]).filter((pluginId) => !leftOutIds.has(pluginId)))
}

function missingDependencyReason(spec: PluginUpdateSpec, leftOutIds: ReadonlySet<string>): string {
  return waitingOnDependencyReason((spec.depIds ?? []).find((depId) => leftOutIds.has(depId)))
}

// One results row per plugin the batch did not send: first the packages the app itself would not send,
// each carrying the reason it was refused, then the plugins that were only waiting on one of those.
// The two reasons read differently on purpose, so the user can tell which plugin is the actual problem.
export function unsentPluginRows(specs: readonly PluginUpdateSpec[], unsent: readonly UnsentPackage[]): PluginRecoveryResult[] {
  const unsentIds = new Set(unsent.map((item) => item.pluginId))
  const leftOutIds = pluginsLeftOut(specs, unsentIds)
  const dependents = specs.filter((spec) => leftOutIds.has(spec.pluginId)).filter((spec) => !unsentIds.has(spec.pluginId))

  return [
    ...unsent.map((item) => refusedAttempt(item.pluginId, item.reason)),
    ...dependents.map((spec) => refusedAttempt(spec.pluginId, missingDependencyReason(spec, leftOutIds))),
  ]
}

// The whole batch as the user sees it: what the daemon reported for the packages that were sent, plus
// a row for every plugin that never left the app. A batch with anything left behind is not ok, even
// when every package that WAS sent installed cleanly. What the printer said about plugins it could not
// read is carried across unchanged: it is not about the packages that were sent, and rebuilding the
// answer without it would lose the one place the user is told which plugin the printer cannot account
// for.
export function batchResultWithUnsent(sentResult: BatchResult | null, unsentRows: readonly PluginRecoveryResult[]): BatchResult {
  return {
    ok: unsentRows.length === 0 && (sentResult?.ok ?? true),
    results: [...(sentResult?.results ?? []), ...unsentRows],
    manifestWarnings: sentResult?.manifestWarnings,
  }
}
