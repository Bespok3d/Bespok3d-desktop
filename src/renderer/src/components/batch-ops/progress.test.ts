// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect } from 'vitest'
import { reduceBatchProgress, rowStatus, completedCount, activeRowIndex } from './progress'
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
    expect(completedCount(state)).toBe(1)
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

  it('marks every plugin done and counts all once the restart step starts', () => {
    var state = plan(['a', 'b'])
    state = reduceBatchProgress(state, 'printer-1', { type: 'plugin', pluginId: 'a', index: 0, total: 2 })!
    state = reduceBatchProgress(state, 'printer-1', { type: 'plugin', pluginId: '(services)', index: 2, total: 2 })!
    expect(state.restarting).toBe(true)
    expect(completedCount(state)).toBe(2)
    expect(state.ids.map((pluginId) => rowStatus(state, pluginId))).toEqual(['done', 'done'])
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
    expect(completedCount(state)).toBe(1)
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
    expect(activeRowIndex(state)).toBe(-1)
    state = reduceBatchProgress(state, 'printer-1', { type: 'plugin', pluginId: 'c', index: 0, total: 3 })!
    expect(activeRowIndex(state)).toBe(2)
    state = reduceBatchProgress(state, 'printer-1', { type: 'plugin', pluginId: '(services)', index: 3, total: 3 })!
    expect(activeRowIndex(state)).toBe(3)
  })
})
