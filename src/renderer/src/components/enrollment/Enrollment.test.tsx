// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom
import { useState } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { screen, act, waitFor } from '@testing-library/react'
import { setup } from '../../test/harness'
import { makePrinter, makeEnrollEvent } from '../../test/fixtures'
import { Enrollment } from './index'
import type { EnrollMode } from './index'
import type { Printer } from '../../data/types'

function renderEnroll(mode: EnrollMode, printerOverrides = {}, handlers: Record<string, ReturnType<typeof vi.fn>> = {}) {
  var printer = makePrinter({ id: 'printer-1', ip: '10.0.0.1', adapter: 'snapmaker-u1', status: 'online', ...printerOverrides })
  var onEnrolled = handlers.onEnrolled ?? vi.fn()
  var onEscalateRecovery = handlers.onEscalateRecovery ?? vi.fn()
  var onExpectedRestart = handlers.onExpectedRestart ?? vi.fn()
  var rendered = setup(
    <Enrollment printer={printer} mode={mode} onEnrolled={onEnrolled} onClose={vi.fn()} onEscalateRecovery={onEscalateRecovery} onExpectedRestart={onExpectedRestart} />,
  )

  return { ...rendered, onEnrolled, onEscalateRecovery, onExpectedRestart }
}

// The ops that stop plugins, re-deploy the daemon or restart the printer wait on their go-ahead
// screen, so a test that wants the op running has to press the button the user presses.
const GO_AHEAD_BUTTON: Partial<Record<EnrollMode, string>> = {
  'update-daemon': 'Update',
  'repair': 'Repair daemon',
  'deactivate': 'Deactivate',
  'reactivate': 'Reactivate',
  'uninstall': 'Remove Bespok3d',
  'reboot': 'Restart the printer',
}

async function renderAndSayGo(mode: EnrollMode, printerOverrides = {}, handlers: Record<string, ReturnType<typeof vi.fn>> = {}) {
  var rendered = renderEnroll(mode, printerOverrides, handlers)
  var goAhead = GO_AHEAD_BUTTON[mode]
  if (goAhead) await rendered.user.click(screen.getByRole('button', { name: goAhead }))

  return rendered
}

describe('Enrollment happy path', () => {
  it('auto-starts with adapter defaults, streams steps, and reports the enrolled printer on Done', async () => {
    var { user, emit, b3d, onEnrolled } = renderEnroll('enroll')

    await waitFor(() => expect(b3d.printers.enroll).toHaveBeenCalledWith('printer-1', '10.0.0.1', 'snapmaker-u1', 'root', '', 22))

    act(() => emit.enrollProgress(makeEnrollEvent({ status: 'running', stepLabel: 'Deploying daemon', stepIndex: 1 })))
    expect(screen.getByText('Deploying daemon')).toBeInTheDocument()

    act(() => emit.enrollProgress(makeEnrollEvent({ status: 'done', stepLabel: 'Finished', stepIndex: 13, totalSteps: 14 })))
    expect(screen.getByText('Printer enrolled successfully')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Done' }))
    await waitFor(() => expect(onEnrolled).toHaveBeenCalledWith(expect.objectContaining({ id: 'printer-1', status: 'managed' })))
  })
})

describe('Enrollment custom SSH credentials', () => {
  it('shows the form, tests the connection, and enrolls with the entered credentials', async () => {
    var { user, b3d, container } = renderEnroll('enroll', { customSshCredentials: true })
    var password = container.querySelector('input[type="password"]') as HTMLInputElement

    await screen.findByDisplayValue('root')
    await user.type(password, 'secret')

    await user.click(screen.getByRole('button', { name: 'Test connection' }))
    expect(b3d.printers.checkSsh).toHaveBeenCalledWith('10.0.0.1', 'root', 'secret', 22)

    await user.click(screen.getByRole('button', { name: 'Start enrollment' }))
    expect(b3d.printers.enroll).toHaveBeenCalledWith('printer-1', '10.0.0.1', 'snapmaker-u1', 'root', 'secret', 22)
  })
})

describe('Enrollment failure handling', () => {
  it('retries from the failed step', async () => {
    var { user, emit, b3d } = renderEnroll('enroll')
    await waitFor(() => expect(b3d.printers.enroll).toHaveBeenCalledTimes(1))

    act(() => emit.enrollProgress(makeEnrollEvent({ status: 'failed', stepId: 'deploy-daemon', stepLabel: 'Deploy daemon', error: 'boom', stepIndex: 3 })))
    await user.click(screen.getByRole('button', { name: 'More' }))
    await user.click(screen.getByRole('button', { name: 'Start from step' }))

    expect(b3d.printers.enroll).toHaveBeenLastCalledWith('printer-1', '10.0.0.1', 'snapmaker-u1', 'root', '', 22, 'deploy-daemon')
  })

  it('offers recovery escalation when a repair fails', async () => {
    var { user, emit, b3d, onEscalateRecovery } = await renderAndSayGo('repair')
    await waitFor(() => expect(b3d.printers.repair).toHaveBeenCalled())

    act(() => emit.enrollProgress(makeEnrollEvent({ status: 'failed', stepId: 'deploy-daemon', stepLabel: 'Deploy daemon', error: 'boom', stepIndex: 3 })))
    await user.click(screen.getByRole('button', { name: 'Run Recovery' }))
    expect(onEscalateRecovery).toHaveBeenCalledOnce()
  })
})

// App swaps the modal's mode (repair -> recovery) on the same render slot when the user escalates.
// Mirror that exactly (key by mode, onEscalateRecovery flips the mode) so the test catches the hang:
// without the key remount, the reused instance never re-runs auto-start and recovery never starts.
function EscalationHarness({ printer }: { printer: Printer }) {
  var [mode, setMode] = useState<EnrollMode>('repair')

  return (
    <Enrollment
      key={`${printer.id}-${mode}`}
      printer={printer}
      mode={mode}
      onEnrolled={vi.fn()}
      onClose={vi.fn()}
      onEscalateRecovery={() => setMode('recovery')}
      onExpectedRestart={vi.fn()}
    />
  )
}

describe('Enrollment recovery escalation actually starts recovery', () => {
  it('runs the full re-enroll after a post-OTA repair fails (no hang)', async () => {
    var printer = makePrinter({ id: 'printer-1', ip: '10.0.0.1', adapter: 'snapmaker-u1', status: 'online' })
    var { user, emit, b3d } = setup(<EscalationHarness printer={printer} />)

    await user.click(screen.getByRole('button', { name: 'Repair daemon' }))
    await waitFor(() => expect(b3d.printers.repair).toHaveBeenCalled())
    act(() => emit.enrollProgress(makeEnrollEvent({ status: 'failed', stepId: 'check-write-layer', stepLabel: 'Checking the write layer', error: 'write layer reset', stepIndex: 0 })))

    await user.click(screen.getByRole('button', { name: 'Run Recovery' }))
    await waitFor(() => expect(b3d.printers.enroll).toHaveBeenCalledWith('printer-1', '10.0.0.1', 'snapmaker-u1', 'root', '', 22))
  })
})

describe('Enrollment asks before it touches the printer', () => {
  it('waits for an explicit Update before running, then updates the daemon', async () => {
    var { user, b3d, onExpectedRestart } = renderEnroll('update-daemon', { daemonVersion: '0.10.20-dev' })

    expect(b3d.printers.updateDaemon).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Update' }))

    await waitFor(() => expect(b3d.printers.updateDaemon).toHaveBeenCalledWith('printer-1', '10.0.0.1', 'root', '', 22))
    expect(onExpectedRestart).toHaveBeenCalledWith('printer-1')
  })

  it('runs nothing on the printer while the go-ahead screen is up', async () => {
    var { b3d } = renderEnroll('deactivate')

    expect(screen.getByRole('button', { name: 'Deactivate' })).toBeInTheDocument()
    expect(b3d.printers.deactivate).not.toHaveBeenCalled()
  })

  it('offers the SSH login on that screen, and still waits for the form to be submitted', async () => {
    var { user, b3d, container } = renderEnroll('deactivate')

    await user.click(screen.getByRole('button', { name: 'Use my own SSH login' }))
    await screen.findByDisplayValue('root')
    await user.type(container.querySelector('input[type="password"]') as HTMLInputElement, 'secret')
    expect(b3d.printers.deactivate).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Deactivate' }))
    await waitFor(() => expect(b3d.printers.deactivate).toHaveBeenCalledWith('printer-1', '10.0.0.1', 'root', 'secret', 22))
  })
})

describe('Enrollment lifecycle dispatch', () => {
  it.each([
    ['deactivate', 'deactivate'],
    ['reactivate', 'reactivate'],
    ['uninstall', 'uninstall'],
    ['update-jinni', 'updateJinni'],
    ['reboot', 'reboot'],
  ] as Array<[EnrollMode, keyof Window['b3d']['printers']]>)('routes %s mode to printers.%s', async (mode, method) => {
    var { b3d } = await renderAndSayGo(mode)
    await waitFor(() => expect(b3d.printers[method]).toHaveBeenCalledWith('printer-1', '10.0.0.1', 'root', '', 22))
  })
})

describe('Enrollment reboots the printer after the ops that need it', () => {
  it('holds the modal on the reboot after a deactivate, so Done means the printer is back', async () => {
    var { emit, b3d, onExpectedRestart } = await renderAndSayGo('deactivate')
    await waitFor(() => expect(b3d.printers.deactivate).toHaveBeenCalled())

    act(() => emit.enrollProgress(makeEnrollEvent({ status: 'done', stepLabel: 'Removing boot hook', stepIndex: 1, totalSteps: 2 })))

    await waitFor(() => expect(b3d.printers.reboot).toHaveBeenCalledWith('printer-1', '10.0.0.1', 'root', '', 22))
    expect(onExpectedRestart).toHaveBeenCalledWith('printer-1')
    expect(screen.queryByText('Bespok3d deactivated')).not.toBeInTheDocument()
  })

  it('reboots after a reactivate too', async () => {
    var { emit, b3d } = await renderAndSayGo('reactivate')
    await waitFor(() => expect(b3d.printers.reactivate).toHaveBeenCalled())

    act(() => emit.enrollProgress(makeEnrollEvent({ status: 'done', stepLabel: 'Re-applying plugins', stepIndex: 5, totalSteps: 6 })))
    await waitFor(() => expect(b3d.printers.reboot).toHaveBeenCalled())
  })

  it('leaves the removal success screen up and says the printer is rebooting', async () => {
    var { emit, b3d } = await renderAndSayGo('uninstall')
    await waitFor(() => expect(b3d.printers.uninstall).toHaveBeenCalled())

    act(() => emit.enrollProgress(makeEnrollEvent({ status: 'done', stepLabel: 'Removing bespok3d from the printer', stepIndex: 1, totalSteps: 2 })))

    await waitFor(() => expect(b3d.printers.reboot).toHaveBeenCalledWith('printer-1', '10.0.0.1', 'root', '', 22))
    expect(screen.getByText('Bespok3d removed')).toBeInTheDocument()
    expect(screen.getByText('Your printer is rebooting.')).toBeInTheDocument()
  })

  it('leaves the printer alone after an op that changes nothing it is running', async () => {
    var { emit, b3d } = await renderAndSayGo('repair')
    await waitFor(() => expect(b3d.printers.repair).toHaveBeenCalled())

    act(() => emit.enrollProgress(makeEnrollEvent({ status: 'done', stepLabel: 'Re-applying plugins', stepIndex: 5, totalSteps: 6 })))

    expect(screen.getByText('Daemon repaired')).toBeInTheDocument()
    expect(b3d.printers.reboot).not.toHaveBeenCalled()
  })
})

describe('Enrollment cancel', () => {
  it('stops the work on the printer instead of throwing the user back to the start', async () => {
    var { user, emit, b3d } = renderEnroll('recovery')
    await waitFor(() => expect(b3d.printers.enroll).toHaveBeenCalled())

    act(() => emit.enrollProgress(makeEnrollEvent({ status: 'running', stepLabel: 'Deploying daemon', stepIndex: 1 })))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    await waitFor(() => expect(b3d.printers.cancelOp).toHaveBeenCalledWith('printer-1'))
    expect(screen.getByRole('button', { name: 'Cancelling…' })).toBeDisabled()
    expect(screen.getByText('Deploying daemon')).toBeInTheDocument()
  })

  it('reports what was already done once the printer stops', async () => {
    var { user, emit, b3d } = renderEnroll('recovery')
    await waitFor(() => expect(b3d.printers.enroll).toHaveBeenCalled())

    act(() => emit.enrollProgress(makeEnrollEvent({ status: 'running', stepLabel: 'Deploying daemon', stepIndex: 1 })))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    act(() => emit.enrollProgress(makeEnrollEvent({
      status: 'cancelled', stepLabel: 'Deploying daemon', stepIndex: 1,
      completedSteps: [{ id: 'unlock-overlay', label: 'Unlocking the overlay', detail: 'done' }],
    })))

    expect(screen.getByText('Cancelled')).toBeInTheDocument()
    expect(screen.getByText('Unlocking the overlay')).toBeInTheDocument()
  })
})
