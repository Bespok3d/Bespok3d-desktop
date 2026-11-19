// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { setup } from '../../test/harness'
import { makeT } from '../../i18n'
import { BatchInstallProgress } from './InstallProgress'
import { reduceBatchProgress } from './progress'
import type { BatchProgressState } from './progress'

const en = makeT('en')

function rowNamed(container: HTMLElement, label: string): Element | undefined {
  return Array.from(container.querySelectorAll('.batch-row')).find((row) => row.querySelector('.batch-row-id')?.textContent === label)
}

function state(over: Partial<BatchProgressState>): BatchProgressState {
  return {
    printerId: 'p1', ids: ['spoolman', 'fluidd', 'mainsail'], startedIds: ['spoolman', 'fluidd'], current: 'fluidd',
    failedIds: [], skippedIds: [], turnEndedIds: [], phaseLabel: 'Place config', restarting: false, done: false, ...over,
  }
}

describe('BatchInstallProgress', () => {
  it('lists every plugin with its status, phase, and the running count', () => {
    const { container } = setup(<BatchInstallProgress title="Installing plugins" state={state({})} />)
    expect(screen.getByText('Installing plugins')).toBeInTheDocument()
    expect(screen.getByText(en('batch_progress.count', { done: 2, total: 5 }))).toBeInTheDocument()
    expect(rowNamed(container, 'spoolman')).toHaveClass('done')
    expect(rowNamed(container, 'fluidd')).toHaveClass('installing')
    expect(screen.getByText('Place config')).toBeInTheDocument()
    expect(rowNamed(container, 'mainsail')).toHaveClass('pending')
  })

  it('marks a plugin failed and the restart row at work once the restart step begins', () => {
    const { container } = setup(
      <BatchInstallProgress title="Installing plugins" state={state({ startedIds: ['spoolman', 'fluidd', 'mainsail'], current: null, restarting: true, phaseLabel: null, failedIds: ['fluidd'] })} />,
    )
    expect(rowNamed(container, en('batch_progress.step_restart'))).toHaveClass('installing')
    expect(rowNamed(container, 'fluidd')).toHaveClass('failed')
    expect(screen.getByText(en('batch_progress.count', { done: 4, total: 5 }))).toBeInTheDocument()
  })

  it('shows getting the printer ready at work before the first plugin starts', () => {
    const planned = reduceBatchProgress(null, 'p1', { type: 'plan', ids: ['spoolman', 'fluidd'] })!
    const { container } = setup(<BatchInstallProgress title="Installing plugins" state={planned} />)
    expect(rowNamed(container, en('batch_progress.step_prepare'))).toHaveClass('installing')
    expect(rowNamed(container, en('batch_progress.step_restart'))).toHaveClass('pending')
  })

  it('shows a plugin the printer left out without a tick', () => {
    const planned = reduceBatchProgress(null, 'p1', { type: 'plan', ids: ['spoolman', 'fluidd'] })
    const started = reduceBatchProgress(planned, 'p1', { type: 'plugin', pluginId: 'fluidd', index: 0, total: 2 })
    const leftOut = reduceBatchProgress(started, 'p1', { type: 'outcome', pluginId: 'fluidd', ok: false, skipped: true })!
    const { container } = setup(<BatchInstallProgress title="Installing plugins" state={leftOut} />)
    const skippedRow = rowNamed(container, 'fluidd')
    expect(skippedRow).toHaveClass('skipped')
    expect(skippedRow?.textContent).toContain('fluidd')
    expect(skippedRow?.textContent).not.toContain('✓')
    expect(skippedRow?.textContent).toContain('−')
  })

  it('keeps a plugin named like a step apart from that step', () => {
    const { container } = setup(<BatchInstallProgress title="Installing plugins" state={state({ ids: ['restart', 'prepare'], startedIds: ['restart'], current: 'restart' })} />)
    expect([rowNamed(container, 'restart'), rowNamed(container, en('batch_progress.step_restart'))].map((row) => row?.className)).toEqual(['batch-row installing', 'batch-row pending'])
    expect(container.querySelectorAll('.batch-row')).toHaveLength(4)
  })

  it('scrolls the plugin being worked on into view as the run moves down the list', () => {
    const scrolled = vi.spyOn(Element.prototype, 'scrollIntoView')
    const { container, rerender } = setup(<BatchInstallProgress title="Installing plugins" state={state({})} />)
    rerender(<BatchInstallProgress title="Installing plugins" state={state({ startedIds: ['spoolman', 'fluidd', 'mainsail'], current: 'mainsail' })} />)
    expect(scrolled.mock.instances.at(-1)).toBe(container.querySelector('.batch-row.installing'))
    scrolled.mockRestore()
  })

  it('keeps the plugin the printer started in view when it sits lower in the list', () => {
    const scrolled = vi.spyOn(Element.prototype, 'scrollIntoView')
    const planned = reduceBatchProgress(null, 'p1', { type: 'plan', ids: ['spoolman', 'fluidd', 'mainsail'] })
    const startedLast = reduceBatchProgress(planned, 'p1', { type: 'plugin', pluginId: 'mainsail', index: 0, total: 3 })!
    const { container } = setup(<BatchInstallProgress title="Installing plugins" state={startedLast} />)
    expect(container.querySelector('.batch-row.installing')?.textContent).toContain('mainsail')
    expect(scrolled.mock.instances.at(-1)).toBe(container.querySelector('.batch-row.installing'))
    scrolled.mockRestore()
  })
})
