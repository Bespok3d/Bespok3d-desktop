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
  // The plugins the printer left out (a provider missing or switched off). Only a printer that
  // reports how each turn ended fills it; an older one leaves every started plugin to read as done.
  skippedIds: string[]
  // The plugins whose turn the printer said had ended, so a row shows its final mark at once.
  turnEndedIds: string[]
  phaseLabel: string | null
  // Stays true once the services restart began, so the finished run still tells whether it had one.
  restarting: boolean
  done: boolean
}

export type RowStatus = 'done' | 'skipped' | 'installing' | 'failed' | 'pending'

type TurnOutcome = Extract<BatchProgressEvent, { type: 'outcome' }>

// Fold one batch event into the running state. A `plan` starts a fresh run; later events for a
// different printer are ignored (a stray feed from another op never corrupts the shown run).
export function reduceBatchProgress(prev: BatchProgressState | null, printerId: string, event: BatchProgressEvent): BatchProgressState | null {
  if (event.type === 'plan') {
    return { printerId, ids: event.ids, startedIds: [], current: null, failedIds: [], skippedIds: [], turnEndedIds: [], phaseLabel: null, restarting: false, done: false }
  }
  if (!prev || prev.printerId !== printerId) return prev
  if (event.type === 'plugin') return reducePlugin(prev, event.pluginId)
  if (event.type === 'phase') return { ...prev, phaseLabel: event.label, failedIds: markFailed(prev, event.ok) }
  if (event.type === 'outcome') return reduceOutcome(prev, event)

  return { ...prev, done: true }
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

  return listedOnlyWhen(state.failedIds, pluginId, true)
}

function listedOnlyWhen(pluginIds: string[], pluginId: string, belongs: boolean): string[] {
  const others = pluginIds.filter((listedId) => listedId !== pluginId)

  return belongs ? [...others, pluginId] : others
}

// How the printer says a plugin's turn ended is its last word on that row: it can arrive a second
// time, failed, for a plugin the closing restart switched off after its turn had gone well.
function reduceOutcome(prev: BatchProgressState, outcome: TurnOutcome): BatchProgressState {
  if (!prev.ids.includes(outcome.pluginId)) return prev
  const failed = !outcome.ok && !outcome.skipped

  return {
    ...prev,
    failedIds: listedOnlyWhen(prev.failedIds, outcome.pluginId, failed),
    skippedIds: listedOnlyWhen(prev.skippedIds, outcome.pluginId, outcome.skipped),
    turnEndedIds: listedOnlyWhen(prev.turnEndedIds, outcome.pluginId, true),
  }
}

function startedAndLeftBehind(state: BatchProgressState, pluginId: string): boolean {
  return state.startedIds.includes(pluginId) && pluginId !== state.current
}

// A turn is over once the printer said how it ended or moved past it. Only that word or that move
// settles a row: a failed phase marks the plugin on its turn, and the printer can still clear it.
function turnIsOver(state: BatchProgressState, pluginId: string): boolean {
  return state.restarting || state.done || state.turnEndedIds.includes(pluginId) || startedAndLeftBehind(state, pluginId)
}

export function rowStatus(state: BatchProgressState, pluginId: string): RowStatus {
  if (state.failedIds.includes(pluginId)) return 'failed'
  if (state.skippedIds.includes(pluginId)) return 'skipped'
  if (turnIsOver(state, pluginId)) return 'done'
  if (pluginId === state.current) return 'installing'

  return 'pending'
}

function preparingIsOver(state: BatchProgressState): boolean {
  return state.startedIds.length > 0 || state.turnEndedIds.length > 0 || state.restarting || state.done
}

export function preparingStatus(state: BatchProgressState): RowStatus {
  return preparingIsOver(state) ? 'done' : 'installing'
}

export function restartStatus(state: BatchProgressState): RowStatus {
  if (state.done) return state.restarting ? 'done' : 'skipped'

  return state.restarting ? 'installing' : 'pending'
}

interface StepState {
  status: RowStatus
  isNow: boolean
}

// One row of the shown list. A plugin row is named by its plugin id, the two other steps by their kind.
export type ProgressStep = StepState & ({ kind: 'plugin'; pluginId: string } | { kind: 'prepare' | 'restart' })

function pluginStep(state: BatchProgressState, pluginId: string): ProgressStep {
  return { kind: 'plugin', pluginId, status: rowStatus(state, pluginId), isNow: !state.done && pluginId === state.current }
}

// The list in the order it is shown, so the rows drawn, the total and the row kept in view come from one
// place. Getting ready and the services restart are steps of their own: the restart is where Klipper
// loads the new plugins and it takes longer than all the plugins together.
export function progressSteps(state: BatchProgressState): ProgressStep[] {
  return [
    { kind: 'prepare', status: preparingStatus(state), isNow: !preparingIsOver(state) },
    ...state.ids.map((pluginId) => pluginStep(state, pluginId)),
    { kind: 'restart', status: restartStatus(state), isNow: state.restarting && !state.done },
  ]
}

// Steps finished so far, for the "X of N" count and the bar: getting ready, every plugin row whose turn
// is over (so the count matches the marks shown and never goes back), and the restart once the printer
// says the batch is done. The count only reaches N when the work really has.
export function completedCount(state: BatchProgressState): number {
  const pluginsOver = state.ids.filter((pluginId) => turnIsOver(state, pluginId)).length

  return Number(preparingIsOver(state)) + pluginsOver + Number(state.done)
}

// -1 (no row) while no step is running.
export function activeRowIndex(steps: ProgressStep[]): number {
  return steps.findIndex((step) => step.isNow)
}
