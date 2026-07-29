// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { BatchProgressEvent } from '../../../../main/daemon-client/feeds/install-progress'

// The id the daemon announces the shared deferred-restart step under (not a plugin); it arrives as a
// `plugin` event with index === total, which the reducer reads as "all plugins done, now restarting".
const SERVICES_STEP = '(services)'

export interface BatchProgressState {
  printerId: string
  ids: string[]
  // The plugin currently installing (0-based); -1 before the first starts, ids.length while restarting.
  startedIndex: number
  failedIds: string[]
  phaseLabel: string | null
  restarting: boolean
  done: boolean
}

export type RowStatus = 'done' | 'installing' | 'failed' | 'pending'

// Fold one batch event into the running state. A `plan` starts a fresh run; later events for a
// different printer are ignored (a stray feed from another op never corrupts the shown run).
export function reduceBatchProgress(prev: BatchProgressState | null, printerId: string, event: BatchProgressEvent): BatchProgressState | null {
  if (event.type === 'plan') {
    return { printerId, ids: event.ids, startedIndex: -1, failedIds: [], phaseLabel: null, restarting: false, done: false }
  }
  if (!prev || prev.printerId !== printerId) return prev
  if (event.type === 'plugin') return reducePlugin(prev, event.pluginId, event.index)
  if (event.type === 'phase') return { ...prev, phaseLabel: event.label, failedIds: markFailed(prev, event.ok) }

  return { ...prev, done: true, restarting: false }
}

function reducePlugin(prev: BatchProgressState, pluginId: string, index: number): BatchProgressState {
  if (pluginId === SERVICES_STEP) return { ...prev, startedIndex: prev.ids.length, restarting: true, phaseLabel: null }

  return { ...prev, startedIndex: index, phaseLabel: null }
}

// A failed phase belongs to the plugin currently installing, so add it to the failed set; an ok phase
// (or a phase outside a plugin, e.g. nothing is installing) leaves the set untouched.
function markFailed(state: BatchProgressState, phaseOk: boolean): string[] {
  const installing = state.startedIndex >= 0 && state.startedIndex < state.ids.length
  if (phaseOk || !installing) return state.failedIds
  const pluginId = state.ids[state.startedIndex]

  return state.failedIds.includes(pluginId) ? state.failedIds : [...state.failedIds, pluginId]
}

export function rowStatus(state: BatchProgressState, index: number): RowStatus {
  if (state.failedIds.includes(state.ids[index])) return 'failed'
  if (state.restarting || state.done || index < state.startedIndex) return 'done'
  if (index === state.startedIndex) return 'installing'

  return 'pending'
}

// Plugins finished so far, for the "X of N" count and the bar (the whole set once restarting/done).
export function completedCount(state: BatchProgressState): number {
  if (state.restarting || state.done) return state.ids.length

  return Math.max(0, state.startedIndex)
}
