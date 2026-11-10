// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { BatchProgressEvent } from '../../../../main/daemon-client/feeds/install-progress'

// The id the daemon announces the shared deferred-restart step under (not a plugin); the reducer reads
// it as "all plugins done, now restarting".
const SERVICES_STEP = '(services)'

// Rows follow the plugin the printer names, never its position: the printer puts a batch in its own
// dependency order, which is not the order of this list, so a position would tick the wrong plugin.
export interface BatchProgressState {
  printerId: string
  ids: string[]
  // The plugins the printer has started so far.
  startedIds: string[]
  // The plugin installing now: null before the first starts and once the services restart.
  current: string | null
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
    return { printerId, ids: event.ids, startedIds: [], current: null, failedIds: [], phaseLabel: null, restarting: false, done: false }
  }
  if (!prev || prev.printerId !== printerId) return prev
  if (event.type === 'plugin') return reducePlugin(prev, event.pluginId)
  if (event.type === 'phase') return { ...prev, phaseLabel: event.label, failedIds: markFailed(prev, event.ok) }

  return { ...prev, done: true, restarting: false }
}

function reducePlugin(prev: BatchProgressState, pluginId: string): BatchProgressState {
  if (pluginId === SERVICES_STEP) return { ...prev, current: null, restarting: true, phaseLabel: null }

  return { ...prev, startedIds: [...prev.startedIds, pluginId], current: pluginId, phaseLabel: null }
}

// A failed phase belongs to the plugin currently installing, so add it to the failed set; an ok phase
// (or a phase outside a plugin, e.g. nothing is installing) leaves the set untouched.
function markFailed(state: BatchProgressState, phaseOk: boolean): string[] {
  const pluginId = state.current
  if (phaseOk || pluginId === null) return state.failedIds

  return state.failedIds.includes(pluginId) ? state.failedIds : [...state.failedIds, pluginId]
}

function startedAndLeftBehind(state: BatchProgressState, pluginId: string): boolean {
  return state.startedIds.includes(pluginId) && pluginId !== state.current
}

export function rowStatus(state: BatchProgressState, pluginId: string): RowStatus {
  if (state.failedIds.includes(pluginId)) return 'failed'
  if (state.restarting || state.done || startedAndLeftBehind(state, pluginId)) return 'done'
  if (pluginId === state.current) return 'installing'

  return 'pending'
}

// Plugins finished so far, for the "X of N" count and the bar (the whole set once restarting/done).
export function completedCount(state: BatchProgressState): number {
  if (state.restarting || state.done) return state.ids.length

  return state.ids.filter((pluginId) => startedAndLeftBehind(state, pluginId)).length
}

// The row the list keeps in view: the plugin installing now, or the restart row that follows the
// plugins once the services restart. -1 (no row) before the first plugin starts.
export function activeRowIndex(state: BatchProgressState): number {
  if (state.restarting) return state.ids.length

  return state.current === null ? -1 : state.ids.indexOf(state.current)
}
