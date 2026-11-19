// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect } from 'vitest'
import { reduceBatchProgress, rowStatus, completedCount, activeRowIndex, preparingStatus, restartStatus, progressSteps } from './progress'
import type { BatchProgressState } from './progress'

function plan(ids: string[]): BatchProgressState {
  return reduceBatchProgress(null, 'printer-1', { type: 'plan', ids })!
}

describe('reduceBatchProgress transitions', () => {
  it('starts a fresh run from a plan, all pending', () => {
    const state = plan(['a', 'b', 'c'])
    expect(state.ids).toEqual(['a', 'b', 'c'])
    expect(completedCount(state)).toBe(0)
    expect(state.ids.map((pluginId) => rowStatus(state, pluginId))).toEqual(['pending', 'pending', 'pending'])
  })

  it('ticks earlier plugins done as a later one starts', () => {
    var state = plan(['a', 'b', 'c'])
    state = reduceBatchProgress(state, 'printer-1', { type: 'plugin', pluginId: 'a', index: 0, total: 3 })!
    state = reduceBatchProgress(state, 'printer-1', { type: 'plugin', pluginId: 'b', index: 1, total: 3 })!
    expect(state.ids.map((pluginId) => rowStatus(state, pluginId))).toEqual(['done', 'installing', 'pending'])
    expect(completedCount(state)).toBe(2)
  })

  it('ignores events for a different printer', () => {
    const state = plan(['a'])
    expect(reduceBatchProgress(state, 'other', { type: 'plugin', pluginId: 'a', index: 0, total: 1 })).toBe(state)
  })
})

describe('reduceBatchProgress phases and restart', () => {
  it('shows the current plugin phase label and clears it on the next plugin', () => {
    var state = plan(['a', 'b'])
    state = reduceBatchProgress(state, 'printer-1', { type: 'plugin', pluginId: 'a', index: 0, total: 2 })!
    state = reduceBatchProgress(state, 'printer-1', { type: 'phase', label: 'Place config', ok: true })!
    expect(state.phaseLabel).toBe('Place config')
    state = reduceBatchProgress(state, 'printer-1', { type: 'plugin', pluginId: 'b', index: 1, total: 2 })!
    expect(state.phaseLabel).toBeNull()
  })

  it('marks the installing plugin failed on a failed phase', () => {
    var state = plan(['a', 'b'])
    state = reduceBatchProgress(state, 'printer-1', { type: 'plugin', pluginId: 'a', index: 0, total: 2 })!
    state = reduceBatchProgress(state, 'printer-1', { type: 'phase', label: 'Patch failed', ok: false })!
    expect(rowStatus(state, 'a')).toBe('failed')
  })

  it('marks every plugin done once the restart step starts, with the restart still to finish', () => {
    var state = plan(['a', 'b'])
    state = reduceBatchProgress(state, 'printer-1', { type: 'plugin', pluginId: 'a', index: 0, total: 2 })!
    state = reduceBatchProgress(state, 'printer-1', { type: 'plugin', pluginId: '(services)', index: 2, total: 2 })!
    expect(state.restarting).toBe(true)
    expect(state.ids.map((pluginId) => rowStatus(state, pluginId))).toEqual(['done', 'done'])
    expect([restartStatus(state), completedCount(state), progressSteps(state).length]).toEqual(['installing', 3, 4])
  })
})

// The printer installs a batch providers first, so it can start on a plugin that sits lower in the list.
describe('reduceBatchProgress when the printer works in another order than the list', () => {
  it('ticks the plugin the printer names, not the row at its position', () => {
    var state = plan(['a', 'b', 'c'])
    state = reduceBatchProgress(state, 'printer-1', { type: 'plugin', pluginId: 'c', index: 0, total: 3 })!
    expect(state.ids.map((pluginId) => rowStatus(state, pluginId))).toEqual(['pending', 'pending', 'installing'])
    state = reduceBatchProgress(state, 'printer-1', { type: 'plugin', pluginId: 'a', index: 1, total: 3 })!
    expect(state.ids.map((pluginId) => rowStatus(state, pluginId))).toEqual(['installing', 'pending', 'done'])
    expect(completedCount(state)).toBe(2)
  })

  it('marks the plugin the printer is on failed, not the one at its position', () => {
    var state = plan(['a', 'b'])
    state = reduceBatchProgress(state, 'printer-1', { type: 'plugin', pluginId: 'b', index: 0, total: 2 })!
    state = reduceBatchProgress(state, 'printer-1', { type: 'phase', label: 'Patch failed', ok: false })!
    expect(state.failedIds).toEqual(['b'])
    expect(state.ids.map((pluginId) => rowStatus(state, pluginId))).toEqual(['pending', 'failed'])
  })

  it('keeps the plugin the printer is on in view, then the restart row', () => {
    var state = plan(['a', 'b', 'c'])
    expect(activeRowIndex(progressSteps(state))).toBe(0)
    state = reduceBatchProgress(state, 'printer-1', { type: 'plugin', pluginId: 'c', index: 0, total: 3 })!
    expect(activeRowIndex(progressSteps(state))).toBe(3)
    state = reduceBatchProgress(state, 'printer-1', { type: 'plugin', pluginId: '(services)', index: 3, total: 3 })!
    expect(activeRowIndex(progressSteps(state))).toBe(4)
    state = reduceBatchProgress(state, 'printer-1', { type: 'done', ok: true })!
    expect(activeRowIndex(progressSteps(state))).toBe(-1)
  })
})

// The printer says how each turn ended; until it did, a plugin left out was ticked like one installed.
describe('reduceBatchProgress when the printer says how a turn ended', () => {
  it('shows a plugin the printer left out as skipped, never ticked, through the restart', () => {
    var state = plan(['zerotier', 'camera'])
    state = reduceBatchProgress(state, 'printer-1', { type: 'plugin', pluginId: 'zerotier', index: 0, total: 2 })!
    state = reduceBatchProgress(state, 'printer-1', { type: 'outcome', pluginId: 'zerotier', ok: false, skipped: true })!
    state = reduceBatchProgress(state, 'printer-1', { type: 'plugin', pluginId: 'camera', index: 1, total: 2 })!
    state = reduceBatchProgress(state, 'printer-1', { type: 'outcome', pluginId: 'camera', ok: true, skipped: false })!
    state = reduceBatchProgress(state, 'printer-1', { type: 'plugin', pluginId: '(services)', index: 2, total: 2 })!
    expect(state.ids.map((pluginId) => rowStatus(state, pluginId))).toEqual(['skipped', 'done'])
  })

  it('marks a plugin failed when its turn failed before any phase ran', () => {
    var state = plan(['camera'])
    state = reduceBatchProgress(state, 'printer-1', { type: 'plugin', pluginId: 'camera', index: 0, total: 1 })!
    state = reduceBatchProgress(state, 'printer-1', { type: 'outcome', pluginId: 'camera', ok: false, skipped: false })!
    state = reduceBatchProgress(state, 'printer-1', { type: 'done', ok: false })!
    expect(rowStatus(state, 'camera')).toBe('failed')
  })

  it('lets the printer\'s word that a turn went well clear a phase that failed during it', () => {
    var state = plan(['camera'])
    state = reduceBatchProgress(state, 'printer-1', { type: 'plugin', pluginId: 'camera', index: 0, total: 1 })!
    state = reduceBatchProgress(state, 'printer-1', { type: 'phase', label: 'Start service failed', ok: false })!
    state = reduceBatchProgress(state, 'printer-1', { type: 'outcome', pluginId: 'camera', ok: true, skipped: false })!
    state = reduceBatchProgress(state, 'printer-1', { type: 'done', ok: true })!
    expect(rowStatus(state, 'camera')).toBe('done')
  })

  it('ignores the outcome of a plugin that is not in the list', () => {
    const state = plan(['camera'])
    expect(reduceBatchProgress(state, 'printer-1', { type: 'outcome', pluginId: 'broken', ok: false, skipped: false })).toBe(state)
  })
})

// The closing restart can switch off a plugin whose turn had ended, and the printer says so last.
describe('reduceBatchProgress when the closing restart switches a plugin off', () => {
  it('turns a ticked plugin to failed when the closing restart switches it off', () => {
    var state = plan(['camera'])
    state = reduceBatchProgress(state, 'printer-1', { type: 'plugin', pluginId: 'camera', index: 0, total: 1 })!
    state = reduceBatchProgress(state, 'printer-1', { type: 'outcome', pluginId: 'camera', ok: true, skipped: false })!
    state = reduceBatchProgress(state, 'printer-1', { type: 'plugin', pluginId: '(services)', index: 1, total: 1 })!
    state = reduceBatchProgress(state, 'printer-1', { type: 'outcome', pluginId: 'camera', ok: false, skipped: false })!
    expect(rowStatus(state, 'camera')).toBe('failed')
  })

  it('turns a plugin left out to failed when the closing restart switches it off', () => {
    var state = plan(['camera'])
    state = reduceBatchProgress(state, 'printer-1', { type: 'plugin', pluginId: 'camera', index: 0, total: 1 })!
    state = reduceBatchProgress(state, 'printer-1', { type: 'outcome', pluginId: 'camera', ok: false, skipped: true })!
    state = reduceBatchProgress(state, 'printer-1', { type: 'plugin', pluginId: '(services)', index: 1, total: 1 })!
    state = reduceBatchProgress(state, 'printer-1', { type: 'outcome', pluginId: 'camera', ok: false, skipped: false })!
    expect([rowStatus(state, 'camera'), state.skippedIds]).toEqual(['failed', []])
  })
})

// The "X of N" count follows the same word: a turn the printer ended counts at once, and stays counted.
describe('completedCount when the printer says how a turn ended', () => {
  it('counts a plugin the printer settled before starting any plugin', () => {
    var state = plan(['broken', 'camera'])
    state = reduceBatchProgress(state, 'printer-1', { type: 'outcome', pluginId: 'broken', ok: false, skipped: false })!
    state = reduceBatchProgress(state, 'printer-1', { type: 'plugin', pluginId: 'camera', index: 0, total: 1 })!
    expect(rowStatus(state, 'broken')).toBe('failed')
    expect(completedCount(state)).toBe(2)
    state = reduceBatchProgress(state, 'printer-1', { type: 'outcome', pluginId: 'camera', ok: true, skipped: false })!
    state = reduceBatchProgress(state, 'printer-1', { type: 'done', ok: false })!
    expect(state.ids.map((pluginId) => rowStatus(state, pluginId))).toEqual(['failed', 'done'])
    expect(completedCount(state)).toBe(progressSteps(state).length)
  })

  it('ticks and counts the plugin on its turn once the printer clears a failed phase, never counting back', () => {
    var state = plan(['camera', 'spoolman'])
    state = reduceBatchProgress(state, 'printer-1', { type: 'plugin', pluginId: 'camera', index: 0, total: 2 })!
    state = reduceBatchProgress(state, 'printer-1', { type: 'phase', label: 'Start service failed', ok: false })!
    const countAfterTheFailedPhase = completedCount(state)
    state = reduceBatchProgress(state, 'printer-1', { type: 'outcome', pluginId: 'camera', ok: true, skipped: false })!
    expect([countAfterTheFailedPhase, rowStatus(state, 'camera'), completedCount(state)]).toEqual([1, 'done', 2])
  })

  it('counts the plugin on its turn as soon as the printer says it left it out', () => {
    var state = plan(['zerotier', 'camera'])
    state = reduceBatchProgress(state, 'printer-1', { type: 'plugin', pluginId: 'zerotier', index: 0, total: 2 })!
    state = reduceBatchProgress(state, 'printer-1', { type: 'outcome', pluginId: 'zerotier', ok: false, skipped: true })!
    expect([rowStatus(state, 'zerotier'), completedCount(state)]).toEqual(['skipped', 2])
  })
})

// The printer gets ready before the first plugin and restarts its services after the last, and the
// restart takes longer than all the plugins together. The count and the bar showed every plugin done
// through both, so the run looked stuck, then finished while the printer was still restarting.
describe('the steps around the plugins', () => {
  it('shows getting ready at work before the printer starts the first plugin', () => {
    var state = plan(['camera', 'spoolman'])
    expect([preparingStatus(state), restartStatus(state), completedCount(state), progressSteps(state).length]).toEqual(['installing', 'pending', 0, 4])
    state = reduceBatchProgress(state, 'printer-1', { type: 'plugin', pluginId: 'camera', index: 0, total: 2 })!
    expect([preparingStatus(state), completedCount(state)]).toEqual(['done', 1])
  })

  it('never reaches the total while the printer is restarting its services', () => {
    var state = plan(['camera', 'spoolman'])
    state = reduceBatchProgress(state, 'printer-1', { type: 'plugin', pluginId: 'camera', index: 0, total: 2 })!
    state = reduceBatchProgress(state, 'printer-1', { type: 'plugin', pluginId: 'spoolman', index: 1, total: 2 })!
    state = reduceBatchProgress(state, 'printer-1', { type: 'plugin', pluginId: '(services)', index: 2, total: 2 })!
    expect(completedCount(state)).toBeLessThan(progressSteps(state).length)
    state = reduceBatchProgress(state, 'printer-1', { type: 'done', ok: true })!
    expect([restartStatus(state), completedCount(state)]).toEqual(['done', progressSteps(state).length])
  })

  it('shows the restart left out when the printer ends the run without one', () => {
    var state = plan(['camera'])
    state = reduceBatchProgress(state, 'printer-1', { type: 'plugin', pluginId: 'camera', index: 0, total: 1 })!
    state = reduceBatchProgress(state, 'printer-1', { type: 'done', ok: true })!
    expect([restartStatus(state), activeRowIndex(progressSteps(state))]).toEqual(['skipped', -1])
  })

  it('keeps no row in view for a plugin the list does not name', () => {
    const state = reduceBatchProgress(plan(['camera']), 'printer-1', { type: 'plugin', pluginId: 'renamed', index: 0, total: 1 })!
    expect(activeRowIndex(progressSteps(state))).toBe(-1)
  })
})
