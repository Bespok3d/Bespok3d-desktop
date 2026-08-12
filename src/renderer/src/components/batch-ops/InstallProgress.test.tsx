// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { setup } from '../../test/harness'
import { makeT } from '../../i18n'
import { BatchInstallProgress } from './InstallProgress'
import type { BatchProgressState } from './progress'

const en = makeT('en')

function state(over: Partial<BatchProgressState>): BatchProgressState {
  return {
    printerId: 'p1', ids: ['spoolman', 'fluidd', 'mainsail'], startedIndex: 1,
    failedIds: [], phaseLabel: 'Place config', restarting: false, done: false, ...over,
  }
}

describe('BatchInstallProgress', () => {
  it('lists every plugin with its status, phase, and the running count', () => {
    const { container } = setup(<BatchInstallProgress title="Installing plugins" state={state({})} />)
    expect(screen.getByText('Installing plugins')).toBeInTheDocument()
    expect(screen.getByText(en('batch_progress.count', { done: 1, total: 3 }))).toBeInTheDocument()
    expect(container.querySelector('.batch-row.done')?.textContent).toContain('spoolman')
    expect(container.querySelector('.batch-row.installing')?.textContent).toContain('fluidd')
    expect(screen.getByText('Place config')).toBeInTheDocument()
    expect(container.querySelector('.batch-row.pending')?.textContent).toContain('mainsail')
  })

  it('marks a plugin failed and shows the restarting row once the restart step begins', () => {
    const { container } = setup(
      <BatchInstallProgress title="Installing plugins" state={state({ startedIndex: 3, restarting: true, phaseLabel: null, failedIds: ['fluidd'] })} />,
    )
    expect(screen.getByText(en('batch_progress.restarting'))).toBeInTheDocument()
    expect(container.querySelector('.batch-row.failed')?.textContent).toContain('fluidd')
  })

  it('scrolls the plugin being worked on into view as the run moves down the list', () => {
    const scrolled = vi.spyOn(Element.prototype, 'scrollIntoView')
    const { container, rerender } = setup(<BatchInstallProgress title="Installing plugins" state={state({ startedIndex: 1 })} />)
    rerender(<BatchInstallProgress title="Installing plugins" state={state({ startedIndex: 2 })} />)
    expect(scrolled.mock.instances.at(-1)).toBe(container.querySelector('.batch-row.installing'))
    scrolled.mockRestore()
  })
})
