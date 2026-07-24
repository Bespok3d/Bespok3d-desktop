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
    var { user, emit, b3d, onEscalateRecovery } = renderEnroll('repair')
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

    await waitFor(() => expect(b3d.printers.repair).toHaveBeenCalled())
    act(() => emit.enrollProgress(makeEnrollEvent({ status: 'failed', stepId: 'check-write-layer', stepLabel: 'Checking the write layer', error: 'write layer reset', stepIndex: 0 })))

    await user.click(screen.getByRole('button', { name: 'Run Recovery' }))
    await waitFor(() => expect(b3d.printers.enroll).toHaveBeenCalledWith('printer-1', '10.0.0.1', 'snapmaker-u1', 'root', '', 22))
  })
})

describe('Enrollment update-daemon confirm gate', () => {
  it('waits for an explicit Update before running, then updates the daemon', async () => {
    var { user, b3d, onExpectedRestart } = renderEnroll('update-daemon', { daemonVersion: '0.10.20-dev' })

    expect(b3d.printers.updateDaemon).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Update' }))

    await waitFor(() => expect(b3d.printers.updateDaemon).toHaveBeenCalledWith('printer-1', '10.0.0.1', 'root', '', 22))
    expect(onExpectedRestart).toHaveBeenCalledWith('printer-1')
  })
})

describe('Enrollment lifecycle dispatch', () => {
  it.each([
    ['deactivate', 'deactivate'],
    ['reactivate', 'reactivate'],
    ['uninstall', 'uninstall'],
    ['update-jinni', 'updateJinni'],
  ] as Array<[EnrollMode, keyof Window['b3d']['printers']]>)('routes %s mode to printers.%s', async (mode, method) => {
    var { b3d } = renderEnroll(mode)
    await waitFor(() => expect(b3d.printers[method]).toHaveBeenCalledWith('printer-1', '10.0.0.1', 'root', '', 22))
  })
})
