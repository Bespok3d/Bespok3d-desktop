// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom
import { useMemo, useState } from 'react'
import type { ReactElement } from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Mock } from 'vitest'
import { screen, act, waitFor, fireEvent } from '@testing-library/react'
import { setup } from '../../test/harness'
import { makePrinter, makeEnrollEvent } from '../../test/fixtures'
import { Enrollment } from './index'
import type { EnrollMode } from './index'
import type { Printer } from '../../data/types'
import type { PrinterRecord } from '../../env'
import type { BatchResult } from '../../../../main/daemon-client/batch-result'
import { makeT } from '../../i18n'
import { useBatchOps } from '../batch-ops'
import { HELD_REPORTS_KEY } from '../batch-ops/kept-over-a-quit'
import { usePrinterSync } from '../../hooks/printers'
import { Modal } from '../common/overlay/Modal'

const en = makeT('en')

// A wrong call to the app would come after the saved printer is read back, a few promises later, so
// a check that it never came waits for those first.
async function letPendingWorkSettle(): Promise<void> {
  await act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)))
}

function renderEnroll(mode: EnrollMode, printerOverrides = {}, handlers: Record<string, ReturnType<typeof vi.fn>> = {}) {
  var printer = makePrinter({ id: 'printer-1', ip: '192.0.2.1', adapter: 'snapmaker-u1', status: 'online', ...printerOverrides })
  var onEnrolled = handlers.onEnrolled ?? vi.fn()
  var onEscalateRecovery = handlers.onEscalateRecovery ?? vi.fn()
  var onRebuildPrinter = handlers.onRebuildPrinter ?? vi.fn()
  var onExpectedRestart = handlers.onExpectedRestart ?? vi.fn()
  var onClose = handlers.onClose ?? vi.fn()
  var onOpRecorded = handlers.onOpRecorded ?? vi.fn()
  var rendered = setup(
    <Enrollment printer={printer} mode={mode} onEnrolled={onEnrolled as (updated: Printer) => void} onOpRecorded={onOpRecorded as (updated: Printer) => void} onClose={onClose as () => void} onEscalateRecovery={onEscalateRecovery as () => void} onRebuildPrinter={onRebuildPrinter as () => void} onExpectedRestart={onExpectedRestart as (printerId: string) => void} />,
  )

  return { ...rendered, onEnrolled, onOpRecorded, onEscalateRecovery, onRebuildPrinter, onExpectedRestart }
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

    await waitFor(() => expect(b3d.printers.enroll).toHaveBeenCalledWith('printer-1', '192.0.2.1', 'snapmaker-u1', 'root', '', 22, undefined, false))

    act(() => emit.enrollProgress(makeEnrollEvent({ status: 'running', stepLabel: 'Deploying daemon', stepIndex: 1 })))
    expect(screen.getByText('Deploying daemon')).toBeInTheDocument()

    act(() => emit.enrollProgress(makeEnrollEvent({ status: 'done', stepLabel: 'Finished', stepIndex: 13, totalSteps: 14 })))
    expect(screen.getByText('Printer enrolled successfully')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Done' }))
    await waitFor(() => expect(onEnrolled).toHaveBeenCalledWith(expect.objectContaining({ id: 'printer-1', status: 'managed' })))
  })

  // A second press before the window goes away used to run everything after Done twice.
  it('reports the printer once when Done is pressed twice', async () => {
    var { user, emit, b3d, onEnrolled } = renderEnroll('enroll')
    await waitFor(() => expect(b3d.printers.enroll).toHaveBeenCalled())
    act(() => emit.enrollProgress(makeEnrollEvent({ status: 'done', stepLabel: 'Finished', stepIndex: 13, totalSteps: 14 })))

    await user.dblClick(screen.getByRole('button', { name: 'Done' }))

    await waitFor(() => expect(onEnrolled).toHaveBeenCalled())
    await act(async () => { await Promise.resolve() })
    expect(onEnrolled).toHaveBeenCalledOnce()
  })
})

describe('Enrollment custom SSH credentials', () => {
  it('shows the form, tests the connection, and enrolls with the entered credentials', async () => {
    var { user, b3d, container } = renderEnroll('enroll', { customSshCredentials: true })
    var password = container.querySelector('input[type="password"]') as HTMLInputElement

    await screen.findByDisplayValue('root')
    await user.type(password, 'secret')

    await user.click(screen.getByRole('button', { name: 'Test connection' }))
    expect(b3d.printers.checkSsh).toHaveBeenCalledWith('192.0.2.1', 'root', 'secret', 22)

    await user.click(screen.getByRole('button', { name: 'Start enrollment' }))
    expect(b3d.printers.enroll).toHaveBeenCalledWith('printer-1', '192.0.2.1', 'snapmaker-u1', 'root', 'secret', 22, undefined, false)
  })
})

// Launched from the Force menu, the printer reporting a newer daemon than the app ships must not stop
// the run: the flag has to reach the main process, or the menu offers something it cannot deliver.
describe('Enrollment launched from the Force menu', () => {
  it('asks for a forced enroll and a forced repair', async () => {
    var printer = makePrinter({ id: 'printer-1', ip: '192.0.2.1', adapter: 'snapmaker-u1', status: 'online' })
    var { b3d } = setup(<Enrollment printer={printer} mode="enroll" forced onEnrolled={vi.fn()} onClose={vi.fn()} onEscalateRecovery={vi.fn()} onExpectedRestart={vi.fn()} />)

    await waitFor(() => expect(b3d.printers.enroll).toHaveBeenCalledWith('printer-1', '192.0.2.1', 'snapmaker-u1', 'root', '', 22, undefined, true))

    const forcedRepair = setup(<Enrollment printer={printer} mode="repair" forced onEnrolled={vi.fn()} onClose={vi.fn()} onEscalateRecovery={vi.fn()} onExpectedRestart={vi.fn()} />)
    await forcedRepair.user.click(screen.getByRole('button', { name: 'Repair daemon' }))

    await waitFor(() => expect(forcedRepair.b3d.printers.repair).toHaveBeenCalledWith('printer-1', '192.0.2.1', 'root', '', 22, true))
  })
})

const WRITE_LAYER_REFUSAL = "This printer's write layer was reset. Run full recovery to rebuild it."

describe('Enrollment failure handling', () => {
  it('retries from the failed step', async () => {
    var { user, emit, b3d } = renderEnroll('enroll')
    await waitFor(() => expect(b3d.printers.enroll).toHaveBeenCalledTimes(1))

    act(() => emit.enrollProgress(makeEnrollEvent({ status: 'failed', stepId: 'deploy-daemon', stepLabel: 'Deploy daemon', error: 'boom', stepIndex: 3 })))
    await user.click(screen.getByRole('button', { name: 'More' }))
    await user.click(screen.getByRole('button', { name: 'Start from step' }))

    expect(b3d.printers.enroll).toHaveBeenLastCalledWith('printer-1', '192.0.2.1', 'snapmaker-u1', 'root', '', 22, 'deploy-daemon', false)
  })

  // The op rejects a moment after the step it stopped on fails. That rejection used to clear the
  // progress screen, taking the step's own reason and the Run Recovery button with it, and left the
  // user looking at "Operation failed" with nothing but Close.
  it('keeps the failed step, its reason and the way out when the operation itself rejects', async () => {
    var refuse: ((reason: Error) => void) | undefined
    var { user, emit, b3d, onEscalateRecovery } = renderEnroll('repair')
    vi.mocked(b3d.printers.repair).mockReturnValue(new Promise((_resolve, reject) => { refuse = reject }))
    await user.click(screen.getByRole('button', { name: 'Repair daemon' }))
    await waitFor(() => expect(b3d.printers.repair).toHaveBeenCalled())

    act(() => emit.enrollProgress(makeEnrollEvent({ status: 'failed', stepId: 'check-write-layer', stepLabel: 'Checking the write layer', error: WRITE_LAYER_REFUSAL, stepIndex: 0 })))
    await act(async () => { refuse?.(new Error(WRITE_LAYER_REFUSAL)) })

    expect(screen.getByText(WRITE_LAYER_REFUSAL)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Report this problem' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Run Recovery' }))
    expect(onEscalateRecovery).toHaveBeenCalledOnce()
  })

  it('offers recovery escalation when a repair fails', async () => {
    var { user, emit, b3d, onEscalateRecovery } = await renderAndSayGo('repair')
    await waitFor(() => expect(b3d.printers.repair).toHaveBeenCalled())

    act(() => emit.enrollProgress(makeEnrollEvent({ status: 'failed', stepId: 'deploy-daemon', stepLabel: 'Deploy daemon', error: 'boom', stepIndex: 3 })))
    await user.click(screen.getByRole('button', { name: 'Run Recovery' }))
    expect(onEscalateRecovery).toHaveBeenCalledOnce()
  })

  // Full recovery is the end of the line the daemon fix escalates into, so its own failure used to
  // leave the user with nothing to press. Rebuilding re-enrols the printer and puts the plugins back.
  it('offers rebuilding the printer when the full recovery itself fails', async () => {
    var { user, emit, b3d, onRebuildPrinter } = await renderAndSayGo('recovery')
    await act(async () => { await Promise.resolve() })
    expect(b3d.printers.enroll).toHaveBeenCalled()

    act(() => emit.enrollProgress(makeEnrollEvent({ status: 'failed', stepId: 'deploy-daemon', stepLabel: 'Deploy daemon', error: 'boom', stepIndex: 3 })))
    expect(screen.getByText('boom')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Rebuild Printer' }))
    expect(onRebuildPrinter).toHaveBeenCalledOnce()
  })

  it('offers no next step when a plain enrollment fails, because there is nothing further to try', async () => {
    var { emit, b3d } = await renderAndSayGo('enroll')
    await act(async () => { await Promise.resolve() })
    expect(b3d.printers.enroll).toHaveBeenCalled()

    act(() => emit.enrollProgress(makeEnrollEvent({ status: 'failed', stepId: 'deploy-daemon', stepLabel: 'Deploy daemon', error: 'boom', stepIndex: 3 })))
    expect(screen.getByText('boom')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Run Recovery' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Rebuild Printer' })).not.toBeInTheDocument()
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
    var printer = makePrinter({ id: 'printer-1', ip: '192.0.2.1', adapter: 'snapmaker-u1', status: 'online' })
    var { user, emit, b3d } = setup(<EscalationHarness printer={printer} />)

    await user.click(screen.getByRole('button', { name: 'Repair daemon' }))
    await waitFor(() => expect(b3d.printers.repair).toHaveBeenCalled())
    act(() => emit.enrollProgress(makeEnrollEvent({ status: 'failed', stepId: 'check-write-layer', stepLabel: 'Checking the write layer', error: 'write layer reset', stepIndex: 0 })))

    await user.click(screen.getByRole('button', { name: 'Run Recovery' }))
    await waitFor(() => expect(b3d.printers.enroll).toHaveBeenCalledWith('printer-1', '192.0.2.1', 'snapmaker-u1', 'root', '', 22, undefined, false))
  })
})

describe('Enrollment asks before it touches the printer', () => {
  it('waits for an explicit Update before running, then updates the daemon', async () => {
    var { user, b3d, onExpectedRestart } = renderEnroll('update-daemon', { daemonVersion: '0.10.20-dev' })

    expect(b3d.printers.updateDaemon).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Update' }))

    await waitFor(() => expect(b3d.printers.updateDaemon).toHaveBeenCalledWith('printer-1', '192.0.2.1', 'root', '', 22))
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
    await waitFor(() => expect(b3d.printers.deactivate).toHaveBeenCalledWith('printer-1', '192.0.2.1', 'root', 'secret', 22))
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
    await waitFor(() => expect(b3d.printers[method]).toHaveBeenCalledWith('printer-1', '192.0.2.1', 'root', '', 22))
  })
})

type RebootingOp = 'deactivate' | 'reactivate'

async function failTheRebootAfterTheOp(rendered: Awaited<ReturnType<typeof renderAndSayGo>>, rebootingOp: RebootingOp = 'deactivate') {
  await waitFor(() => expect(rendered.b3d.printers[rebootingOp]).toHaveBeenCalledTimes(1))
  act(() => rendered.emit.enrollProgress(makeEnrollEvent({ status: 'done', stepLabel: 'Removing boot hook', stepIndex: 1, totalSteps: 2 })))
  await waitFor(() => expect(rendered.b3d.printers.reboot).toHaveBeenCalledTimes(1))
  act(() => rendered.emit.enrollProgress(makeEnrollEvent({ status: 'failed', stepId: 'reboot', stepLabel: 'Restarting the printer', error: 'refused', stepIndex: 0 })))
  await rendered.user.click(screen.getByRole('button', { name: 'More' }))
}

describe('Enrollment reboots the printer after the ops that need it', () => {
  it('holds the modal on the reboot after a deactivate, so Done means the printer is back', async () => {
    var { emit, b3d, onExpectedRestart } = await renderAndSayGo('deactivate')
    await waitFor(() => expect(b3d.printers.deactivate).toHaveBeenCalled())

    act(() => emit.enrollProgress(makeEnrollEvent({ status: 'done', stepLabel: 'Removing boot hook', stepIndex: 1, totalSteps: 2 })))

    await waitFor(() => expect(b3d.printers.reboot).toHaveBeenCalledWith('printer-1', '192.0.2.1', 'root', '', 22))
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

    await waitFor(() => expect(b3d.printers.reboot).toHaveBeenCalledWith('printer-1', '192.0.2.1', 'root', '', 22))
    expect(screen.getByText('Bespok3d removed')).toBeInTheDocument()
    expect(screen.getByText('Your printer is rebooting.')).toBeInTheDocument()
  })

  // The deactivate already finished. Running it again would end on a success that never reboots.
  it.each(['Start over', 'Start from step'])('runs the failed reboot again, not the deactivate, on %s', async (buttonName) => {
    var rendered = await renderAndSayGo('deactivate')
    await failTheRebootAfterTheOp(rendered)

    await rendered.user.click(screen.getByRole('button', { name: buttonName }))

    expect(rendered.b3d.printers.reboot).toHaveBeenCalledTimes(2)
    expect(rendered.b3d.printers.deactivate).toHaveBeenCalledTimes(1)
  })

  it('runs the failed reboot again with the login the user typed, instead of asking for it', async () => {
    var rendered = await renderAndSayGo('deactivate', { customSshCredentials: true })
    await screen.findByDisplayValue('root')
    await rendered.user.type(rendered.container.querySelector('input[type="password"]') as HTMLInputElement, 'secret')
    await rendered.user.click(screen.getByRole('button', { name: 'Deactivate' }))
    await failTheRebootAfterTheOp(rendered)

    await rendered.user.click(screen.getByRole('button', { name: 'Start over' }))

    expect(rendered.b3d.printers.reboot).toHaveBeenLastCalledWith('printer-1', '192.0.2.1', 'root', 'secret', 22)
    expect(rendered.b3d.printers.reboot).toHaveBeenCalledTimes(2)
  })

  // The op is saved the moment its reboot starts, so the app shows the printer as it now is right
  // then, without closing the window or waiting for a Done the user may never press.
  it('shows the app the deactivated printer as soon as its reboot starts', async () => {
    var rendered = await renderAndSayGo('deactivate')
    await waitFor(() => expect(rendered.b3d.printers.deactivate).toHaveBeenCalled())
    vi.mocked(rendered.b3d.printers.load).mockResolvedValue([{ id: 'printer-1', status: 'deactivated', deactivated: true }] as unknown as PrinterRecord[])

    act(() => rendered.emit.enrollProgress(makeEnrollEvent({ status: 'done', stepLabel: 'Removing boot hook', stepIndex: 1, totalSteps: 2 })))

    await waitFor(() => expect(rendered.onOpRecorded).toHaveBeenCalledWith(expect.objectContaining({ id: 'printer-1', status: 'deactivated' })))
    await letPendingWorkSettle()
    expect(rendered.b3d.printers.reboot).toHaveBeenCalled()
    expect(rendered.onEnrolled).not.toHaveBeenCalled()
  })

  // The app already knows. Reporting the op done again would expect a restart that is not coming.
  it.each(['deactivate', 'reactivate'] as RebootingOp[])('only closes the window on a failed reboot after a %s', async (rebootingOp) => {
    var onClose = vi.fn()
    var rendered = await renderAndSayGo(rebootingOp, {}, { onClose })
    vi.mocked(rendered.b3d.printers.load).mockResolvedValue([{ id: 'printer-1', status: 'managed' }] as unknown as PrinterRecord[])
    await failTheRebootAfterTheOp(rendered, rebootingOp)
    await waitFor(() => expect(rendered.onOpRecorded).toHaveBeenCalled())
    await letPendingWorkSettle()
    expect(rendered.onOpRecorded).toHaveBeenCalledOnce()

    await rendered.user.click(screen.getByRole('button', { name: 'Cancel' }))
    await letPendingWorkSettle()

    expect(onClose).toHaveBeenCalledOnce()
    expect(rendered.onEnrolled).not.toHaveBeenCalled()
  })

  it('leaves the printer alone after an op that changes nothing it is running', async () => {
    var { emit, b3d } = await renderAndSayGo('repair')
    await waitFor(() => expect(b3d.printers.repair).toHaveBeenCalled())

    act(() => emit.enrollProgress(makeEnrollEvent({ status: 'done', stepLabel: 'Re-applying plugins', stepIndex: 5, totalSteps: 6 })))

    expect(screen.getByText('Daemon repaired')).toBeInTheDocument()
    expect(b3d.printers.reboot).not.toHaveBeenCalled()
  })
})

const putBack = { pluginId: 'example-camera', ok: true, skipped: false, reason: 'back on', log: [] }
const leftOff = { pluginId: 'example-spoolman', ok: false, skipped: false, reason: 'switched off: its service did not start', log: [] }

interface ReactivateListeners {
  onPluginsLeftOff: Mock<(printerId: string, reapplied: BatchResult) => void>
  onEnrolled: Mock<(updated: Printer) => void>
  onClose: Mock<() => void>
}

function reactivateWindow(listeners: ReactivateListeners): ReactElement {
  var printer = makePrinter({ id: 'printer-1', ip: '192.0.2.1', adapter: 'snapmaker-u1', status: 'online' })

  return <Enrollment printer={printer} mode="reactivate" onOpRecorded={vi.fn()} onEscalateRecovery={vi.fn()} onExpectedRestart={vi.fn()} {...listeners} />
}

async function reactivateStarted(reactivate: () => Promise<BatchResult>, reactStrictMode = false) {
  var listeners: ReactivateListeners = { onPluginsLeftOff: vi.fn<(printerId: string, reapplied: BatchResult) => void>(), onEnrolled: vi.fn<(updated: Printer) => void>(), onClose: vi.fn<() => void>() }
  var rendered = setup(reactivateWindow(listeners), { b3d: { printers: { reactivate: vi.fn(reactivate) } }, reactStrictMode })
  vi.mocked(rendered.b3d.printers.load).mockResolvedValue([{ id: 'printer-1', status: 'managed' }] as unknown as PrinterRecord[])
  await rendered.user.click(screen.getByRole('button', { name: 'Reactivate' }))
  await waitFor(() => expect(rendered.b3d.printers.reactivate).toHaveBeenCalled())

  return { ...rendered, ...listeners }
}

async function reactivateUntilItsReboot(reapplied: BatchResult, reactStrictMode = false) {
  var rendered = await reactivateStarted(() => Promise.resolve(reapplied), reactStrictMode)
  act(() => rendered.emit.enrollProgress(makeEnrollEvent({ status: 'done', stepLabel: 'Re-applying plugins', stepIndex: 5, totalSteps: 6 })))
  await waitFor(() => expect(rendered.b3d.printers.reboot).toHaveBeenCalled())
  await letPendingWorkSettle()

  return rendered
}

async function doneOnceThePrinterIsBack(rendered: Awaited<ReturnType<typeof reactivateUntilItsReboot>>) {
  act(() => rendered.emit.enrollProgress(makeEnrollEvent({ status: 'done', stepId: 'reboot', stepLabel: 'Restarting the printer', stepIndex: 0, totalSteps: 1 })))
  await rendered.user.click(screen.getByRole('button', { name: 'Done' }))
  await waitFor(() => expect(rendered.onEnrolled).toHaveBeenCalled())
  await letPendingWorkSettle()
}

// Restarting the plugins switches off each one the printer could not put back, and the op still ends
// on its own success screen, so the app has to be told which ones were left off.
describe('Enrollment tells the app which plugins a reactivate left off', () => {
  // The printer's safety net switches the plugin off after the services restart and reports it on its
  // own services row, which is ok because the printer is working again; every plugin row stays ok.
  const switchedOffBySafetyNet = { pluginId: '(services)', ok: true, skipped: false, reason: 'Auto-recovered: deactivated example-spoolman to keep the printer working', log: [], autoDeactivated: 'example-spoolman' }

  async function reactivateAnswering(reapplied: BatchResult) {
    var rendered = await reactivateUntilItsReboot(reapplied)
    await doneOnceThePrinterIsBack(rendered)
    rendered.unmount()

    return rendered.onPluginsLeftOff
  }

  it('names the plugins the printer could not put back', async () => {
    var reapplied = { ok: false, results: [putBack, leftOff] }

    var onPluginsLeftOff = await reactivateAnswering(reapplied)

    expect(onPluginsLeftOff).toHaveBeenCalledWith('printer-1', reapplied)
  })

  it('names the plugin the printer\'s safety net switched off once the services restarted', async () => {
    var reapplied = { ok: true, results: [putBack, switchedOffBySafetyNet] }

    var onPluginsLeftOff = await reactivateAnswering(reapplied)

    expect(onPluginsLeftOff).toHaveBeenCalledWith('printer-1', reapplied)
  })

  it('names the plugin the printer walked past because it could not read its manifest', async () => {
    var reapplied = { ok: true, results: [putBack], manifestWarnings: [{ plugin: 'example-rfid', problem: 'manifest-unreadable', detail: 'manifest.json: Expecting value' }] }

    var onPluginsLeftOff = await reactivateAnswering(reapplied)

    expect(onPluginsLeftOff).toHaveBeenCalledWith('printer-1', reapplied)
  })

  it('tells the app when the printer says putting the plugins back failed, even with no plugin row', async () => {
    var reapplied = { ok: false, results: [] }

    var onPluginsLeftOff = await reactivateAnswering(reapplied)

    expect(onPluginsLeftOff).toHaveBeenCalledWith('printer-1', reapplied)
  })

  it('says nothing when every plugin went back on', async () => {
    var onPluginsLeftOff = await reactivateAnswering({ ok: true, results: [putBack] })

    expect(onPluginsLeftOff).not.toHaveBeenCalled()
  })
})

// The app takes the window down once it is told the op is done or the window was closed, so each test
// here unmounts it at that point, as the app does.
describe('Enrollment holds the reactivate report until its window is gone', () => {
  // The report opened over the reboot window while the printer was still restarting.
  it('holds the report until the window on the reboot is gone', async () => {
    var reapplied = { ok: false, results: [putBack, leftOff] }
    var rendered = await reactivateUntilItsReboot(reapplied)

    expect(rendered.onPluginsLeftOff).not.toHaveBeenCalled()
    await doneOnceThePrinterIsBack(rendered)
    expect(rendered.onPluginsLeftOff).not.toHaveBeenCalled()
    rendered.unmount()

    expect(rendered.onPluginsLeftOff).toHaveBeenCalledOnce()
    expect(rendered.onPluginsLeftOff).toHaveBeenCalledWith('printer-1', reapplied)
  })

  it('shows the report when the user closes the window on a reboot that failed', async () => {
    var reapplied = { ok: false, results: [putBack, leftOff] }
    var rendered = await reactivateUntilItsReboot(reapplied)
    act(() => rendered.emit.enrollProgress(makeEnrollEvent({ status: 'failed', stepId: 'reboot', stepLabel: 'Restarting the printer', error: 'refused', stepIndex: 0 })))
    expect(rendered.onPluginsLeftOff).not.toHaveBeenCalled()

    await rendered.user.click(screen.getByRole('button', { name: 'More' }))
    await rendered.user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(rendered.onClose).toHaveBeenCalledOnce()
    rendered.unmount()

    expect(rendered.onPluginsLeftOff).toHaveBeenCalledOnce()
    expect(rendered.onPluginsLeftOff).toHaveBeenCalledWith('printer-1', reapplied)
  })

  it('shows the report when the window is taken down without being closed', async () => {
    var reapplied = { ok: false, results: [putBack, leftOff] }
    var rendered = await reactivateUntilItsReboot(reapplied)

    rendered.unmount()

    expect(rendered.onPluginsLeftOff).toHaveBeenCalledOnce()
    expect(rendered.onPluginsLeftOff).toHaveBeenCalledWith('printer-1', reapplied)
  })

  it('gives the report to the app as it is when the window goes, not as it was when it opened', async () => {
    var reapplied = { ok: false, results: [putBack, leftOff] }
    var rendered = await reactivateUntilItsReboot(reapplied)
    var onPluginsLeftOffNow = vi.fn()
    rendered.rerender(reactivateWindow({ onEnrolled: rendered.onEnrolled, onClose: rendered.onClose, onPluginsLeftOff: onPluginsLeftOffNow }))

    rendered.unmount()

    expect(rendered.onPluginsLeftOff).not.toHaveBeenCalled()
    expect(onPluginsLeftOffNow).toHaveBeenCalledWith('printer-1', reapplied)
  })

  it('shows at once a report that answers after the window is gone', async () => {
    var reapplied = { ok: false, results: [putBack, leftOff] }
    var answerTheReactivate!: (answer: BatchResult) => void
    var reactivateAnswer = new Promise<BatchResult>(function capture(resolve) { answerTheReactivate = resolve })
    var rendered = await reactivateStarted(() => reactivateAnswer)
    rendered.unmount()

    await act(async () => answerTheReactivate(reapplied))

    expect(rendered.onPluginsLeftOff).toHaveBeenCalledOnce()
    expect(rendered.onPluginsLeftOff).toHaveBeenCalledWith('printer-1', reapplied)
  })

  it('holds the report in a development build too, where the window is mounted twice', async () => {
    var reapplied = { ok: false, results: [putBack, leftOff] }
    var rendered = await reactivateUntilItsReboot(reapplied, true)

    expect(rendered.onPluginsLeftOff).not.toHaveBeenCalled()
    rendered.unmount()

    expect(rendered.onPluginsLeftOff).toHaveBeenCalledOnce()
    expect(rendered.onPluginsLeftOff).toHaveBeenCalledWith('printer-1', reapplied)
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

// The progress feed only reports on an operation the printer actually started. Anything that stops the
// operation before that point has to say so on screen, or the modal sits on a bar that never moves.
describe('Enrollment operation that never starts', () => {
  function renderWithPrinters(printers: Record<string, unknown>) {
    var printer = makePrinter({ id: 'printer-1', ip: '192.0.2.1', adapter: 'snapmaker-u1', status: 'online' })

    return setup(
      <Enrollment printer={printer} mode="recovery" onEnrolled={vi.fn()} onClose={vi.fn()} onEscalateRecovery={vi.fn()} onExpectedRestart={vi.fn()} />,
      { b3d: { printers } },
    )
  }

  it('says so when the printer has no adapter to log in with', async () => {
    var { container } = renderWithPrinters({ adapterGet: vi.fn().mockResolvedValue(null) })

    expect(await screen.findByText('This could not be started on the printer.')).toBeInTheDocument()
    expect(screen.getByText('snapmaker-u1')).toBeInTheDocument()
    expect(container.querySelector('.progress-bar.indeterminate')).toBeNull()
  })

  it('says so when the adapter cannot be read', async () => {
    var { container } = renderWithPrinters({ adapterGet: vi.fn().mockRejectedValue(new Error('adapter registry unreachable')) })

    expect(await screen.findByText('This could not be started on the printer.')).toBeInTheDocument()
    expect(screen.getByText('adapter registry unreachable')).toBeInTheDocument()
    expect(container.querySelector('.progress-bar.indeterminate')).toBeNull()
  })

  // Desktop issue 40: the printer refused the SSH login of a repair.
  it('tells a refused SSH login in user words instead of the SSH library words', async () => {
    var { user, b3d } = renderEnroll('repair')
    vi.mocked(b3d.printers.repair).mockRejectedValue(new Error("Error invoking remote method 'printers:repair': Error: All configured authentication methods failed"))
    await user.click(screen.getByRole('button', { name: 'Repair daemon' }))

    expect(await screen.findByText(en('failure.ssh_login_refused'))).toBeInTheDocument()
    expect(screen.queryByText(/All configured authentication methods failed/)).toBeNull()
  })

  // Desktop issue 55: the SSH login of an uninstall never finished.
  it('tells an SSH login that never finished in user words instead of the SSH library words', async () => {
    var { user, b3d } = renderEnroll('uninstall')
    vi.mocked(b3d.printers.uninstall).mockRejectedValue(new Error("Error invoking remote method 'printers:uninstall': Error: Timed out while waiting for handshake"))
    await user.click(screen.getByRole('button', { name: 'Remove Bespok3d' }))

    expect(await screen.findByText(en('failure.ssh_no_handshake'))).toBeInTheDocument()
    expect(screen.queryByText(/Timed out while waiting for handshake/)).toBeNull()
  })

  it('says so when the printer refuses the operation', async () => {
    var { container } = renderWithPrinters({ enroll: vi.fn().mockRejectedValue(new Error('printer is busy printing')) })

    expect(await screen.findByText('This could not be started on the printer.')).toBeInTheDocument()
    expect(screen.getByText('printer is busy printing')).toBeInTheDocument()
    expect(container.querySelector('.progress-bar.indeterminate')).toBeNull()
  })
})

// A failed step used to send Cancel and Start over back to the first screen. With no login form to show,
// that screen was a bar nothing would ever move, whose Cancel did nothing and which had no Close.
describe('Enrollment after a step fails', () => {
  it('closes the window on Cancel', async () => {
    var onClose = vi.fn()
    var { user, emit, b3d } = renderEnroll('enroll', {}, { onClose })
    await waitFor(() => expect(b3d.printers.enroll).toHaveBeenCalledTimes(1))
    act(() => emit.enrollProgress(makeEnrollEvent({ status: 'failed', stepId: 'preflight', stepLabel: 'Checking the printer', error: 'refused', stepIndex: 0 })))

    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onClose).toHaveBeenCalledOnce()
  })

  it('runs the enrollment again from the first step on Start over', async () => {
    var { user, emit, b3d } = renderEnroll('enroll')
    await waitFor(() => expect(b3d.printers.enroll).toHaveBeenCalledTimes(1))
    act(() => emit.enrollProgress(makeEnrollEvent({ status: 'failed', stepId: 'preflight', stepLabel: 'Checking the printer', error: 'refused', stepIndex: 0 })))

    await user.click(screen.getByRole('button', { name: 'More' }))
    await user.click(screen.getByRole('button', { name: 'Start over' }))

    expect(b3d.printers.enroll).toHaveBeenCalledTimes(2)
    expect(b3d.printers.enroll).toHaveBeenLastCalledWith('printer-1', '192.0.2.1', 'snapmaker-u1', 'root', '', 22, undefined, false)
  })

  // The login the app tried was refused. Sending it again would only be refused again, so Start over goes
  // back to the go-ahead, where the user can give their own.
  it('goes back to the go-ahead on Start over after a repair, offering their own login', async () => {
    var { user, emit, b3d } = await renderAndSayGo('repair')
    await waitFor(() => expect(b3d.printers.repair).toHaveBeenCalledTimes(1))
    act(() => emit.enrollProgress(makeEnrollEvent({ status: 'failed', stepId: 'deploy-daemon', stepLabel: 'Deploy daemon', error: 'refused', stepIndex: 1 })))

    await user.click(screen.getByRole('button', { name: 'More' }))
    await user.click(screen.getByRole('button', { name: 'Start over' }))

    expect(screen.getByRole('button', { name: en('enroll.creds.own') })).toBeInTheDocument()
    expect(b3d.printers.repair).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: 'Repair daemon' }))
    await waitFor(() => expect(b3d.printers.repair).toHaveBeenCalledTimes(2))
  })

  // A repair run again restarts the daemon again, so the app must not take the gap for a lost printer.
  it('tells the app to expect the daemon restart when a repair runs again from its step', async () => {
    var { user, emit, b3d, onExpectedRestart } = await renderAndSayGo('repair')
    await waitFor(() => expect(b3d.printers.repair).toHaveBeenCalledTimes(1))
    act(() => emit.enrollProgress(makeEnrollEvent({ status: 'failed', stepId: 'deploy-daemon', stepLabel: 'Deploy daemon', error: 'refused', stepIndex: 1 })))

    await user.click(screen.getByRole('button', { name: 'More' }))
    await user.click(screen.getByRole('button', { name: 'Start from step' }))

    expect(b3d.printers.repair).toHaveBeenCalledTimes(2)
    expect(onExpectedRestart).toHaveBeenCalledTimes(2)
  })

  it('goes back to the login form on Start over when the printer has its own login', async () => {
    var { user, emit, b3d, container } = renderEnroll('enroll', { customSshCredentials: true })
    await screen.findByDisplayValue('root')
    await user.type(container.querySelector('input[type="password"]') as HTMLInputElement, 'secret')
    await user.click(screen.getByRole('button', { name: 'Start enrollment' }))
    act(() => emit.enrollProgress(makeEnrollEvent({ status: 'failed', stepId: 'preflight', stepLabel: 'Checking the printer', error: 'refused', stepIndex: 0 })))

    await user.click(screen.getByRole('button', { name: 'More' }))
    await user.click(screen.getByRole('button', { name: 'Start over' }))

    expect(await screen.findByRole('button', { name: 'Start enrollment' })).toBeInTheDocument()
    expect(b3d.printers.enroll).toHaveBeenCalledTimes(1)
  })
})

// The adapter refuses an Extended-firmware printer in English only, and with nothing about why a
// custom firmware is not needed. The app answers it in the owner's own language instead.
describe('Enrollment on an Extended-firmware printer', () => {
  const ADAPTER_REFUSAL = 'This printer runs the Extended firmware, which Bespok3d is not compatible with. Please revert to the stock Snapmaker firmware, then enroll.'

  it('explains that no custom firmware is needed, in place of the adapter sentence', async () => {
    var { emit, b3d } = renderEnroll('enroll')
    await waitFor(() => expect(b3d.printers.enroll).toHaveBeenCalledTimes(1))
    act(() => emit.enrollProgress(makeEnrollEvent({ status: 'failed', stepId: 'preflight', stepLabel: 'Checking the printer', error: ADAPTER_REFUSAL, stepIndex: 0 })))

    expect(screen.getByText(en('enroll.refusal.extended_firmware'))).toBeInTheDocument()
    expect(screen.queryByText(ADAPTER_REFUSAL, { exact: false })).toBeNull()
  })

  it('keeps the step words for any other refusal', async () => {
    var { emit, b3d } = renderEnroll('enroll')
    await waitFor(() => expect(b3d.printers.enroll).toHaveBeenCalledTimes(1))
    act(() => emit.enrollProgress(makeEnrollEvent({ status: 'failed', stepId: 'preflight', stepLabel: 'Checking the printer', error: 'The printer is printing or paused.', stepIndex: 0 })))

    expect(screen.getByText('The printer is printing or paused.')).toBeInTheDocument()
  })
})

// An operation nobody refused, that then reports no step at all. Cancel cannot answer for a printer
// that is not answering, so without a Close button the user is shut inside the modal for good.
describe('Enrollment operation that goes quiet', () => {
  const NO_ANSWER = 'No answer from the printer yet. It may be off, on another network, or refusing the login.'

  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  async function renderAndWait(waitMs: number) {
    var onClose = vi.fn()
    var printer = makePrinter({ id: 'printer-1', ip: '192.0.2.1', adapter: 'snapmaker-u1', status: 'online' })
    setup(<Enrollment printer={printer} mode="recovery" onEnrolled={vi.fn()} onClose={onClose} onEscalateRecovery={vi.fn()} onExpectedRestart={vi.fn()} />)
    await act(async () => { await Promise.resolve() })
    await act(async () => { vi.advanceTimersByTime(waitMs) })

    return { onClose }
  }

  it('keeps the bar and only Cancel while the printer still has time to report', async () => {
    await renderAndWait(29000)

    expect(screen.queryByText(NO_ANSWER)).toBeNull()
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull()
  })

  it('says nothing answered and lets the user out once the printer has gone quiet', async () => {
    var { onClose } = await renderAndWait(30000)

    expect(screen.getByText(NO_ANSWER)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalled()
  })

  // The retry leaves the failed step on screen, so the app cannot read "a step is showing" as "the
  // printer answered". A retry that goes quiet used to shut the user in exactly as the first try did.
  it('lets the user out of a retry that goes quiet too', async () => {
    var printer = makePrinter({ id: 'printer-1', ip: '192.0.2.1', adapter: 'snapmaker-u1', status: 'online' })
    var { emit } = setup(<Enrollment printer={printer} mode="recovery" onEnrolled={vi.fn()} onClose={vi.fn()} onEscalateRecovery={vi.fn()} onExpectedRestart={vi.fn()} />)
    await act(async () => { await Promise.resolve() })
    act(() => emit.enrollProgress(makeEnrollEvent({ status: 'failed', stepId: 'deploy-daemon', stepLabel: 'Deploy daemon', error: 'boom', stepIndex: 3 })))

    fireEvent.click(screen.getByRole('button', { name: /More/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Start from step' }))
    await act(async () => { vi.advanceTimersByTime(30000) })

    expect(screen.getByText(NO_ANSWER)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument()
  })
})

// Quitting the app ends it where it stands: nothing it would have done on the way down runs, and what
// it kept stays as it was. A test can only take the window down, which hands the report over, so what
// was kept is put back as the quit left it.
function quitTheApp(rendered: { unmount: () => void }) {
  var keptAtTheQuit = localStorage.getItem(HELD_REPORTS_KEY)
  rendered.unmount()
  if (keptAtTheQuit !== null) localStorage.setItem(HELD_REPORTS_KEY, keptAtTheQuit)
}

function ignoreRestart() {
  return Promise.resolve(false)
}

// A window that closes on its own, so closing it renders nothing else of the app again.
function OtherWindow() {
  var [open, setOpen] = useState(true)
  if (!open) return null

  return <Modal><button type="button" onClick={() => setOpen(false)}>close the other window</button></Modal>
}

// The app's next launch, its batch ops wired the way the app wires them: the report of the plugins a
// reactivate left off, the close the user makes on it, and the removal of the printer. The printer list
// keeps its identity between renders, as the app's does.
function NextLaunch({ printerStatus, enrollWindowUp = false, otherWindowUp = false }: { printerStatus: Printer['status']; enrollWindowUp?: boolean; otherWindowUp?: boolean }) {
  var printers = useMemo(() => [makePrinter({ id: 'printer-1', status: printerStatus })], [printerStatus])
  var batchOps = useBatchOps(printers, () => {}, (startInstall) => startInstall(), ignoreRestart, enrollWindowUp)
  var printerSync = usePrinterSync()

  return (
    <>
      {batchOps.recoveryResults && <p>left off: {batchOps.recoveryResults.results.map((row) => row.reason).join(', ')}</p>}
      <button type="button" onClick={() => batchOps.setRecoveryResults(null)}>close the report</button>
      <button type="button" onClick={() => printerSync.handleRemovePrinter('printer-1')}>remove the printer</button>
      {otherWindowUp && <OtherWindow />}
    </>
  )
}

const LEFT_OFF_REPORT = 'left off: back on, switched off: its service did not start'

// The app quit while the window on the reactivate's reboot was up, and is launched again.
async function launchAfterAQuitDuringTheReboot(printerStatus: Printer['status'], { reactStrictMode = false, enrollWindowUp = false, otherWindowUp = false } = {}) {
  quitTheApp(await reactivateUntilItsReboot({ ok: false, results: [putBack, leftOff] }))

  return setup(<NextLaunch printerStatus={printerStatus} enrollWindowUp={enrollWindowUp} otherWindowUp={otherWindowUp} />, { reactStrictMode })
}

// The user may quit the app while the window on the reactivate's reboot is still up.
describe('Enrollment keeps the reactivate report over a quit', () => {
  beforeEach(() => localStorage.clear())

  it('shows it on the next launch once the printer answers, and not before', async () => {
    var nextLaunch = await launchAfterAQuitDuringTheReboot('offline')

    await letPendingWorkSettle()
    expect(screen.queryByText(LEFT_OFF_REPORT)).not.toBeInTheDocument()
    nextLaunch.rerender(<NextLaunch printerStatus="managed" />)

    await waitFor(() => expect(screen.getByText(LEFT_OFF_REPORT)).toBeInTheDocument())
  })

  it('shows it once a switched-off printer answers', async () => {
    await launchAfterAQuitDuringTheReboot('deactivated')

    await waitFor(() => expect(screen.getByText(LEFT_OFF_REPORT)).toBeInTheDocument())
  })

  it('waits for a window on a printer to close, which may be following a reboot itself', async () => {
    var nextLaunch = await launchAfterAQuitDuringTheReboot('managed', { enrollWindowUp: true })

    await letPendingWorkSettle()
    expect(screen.queryByText(LEFT_OFF_REPORT)).not.toBeInTheDocument()
    nextLaunch.rerender(<NextLaunch printerStatus="managed" />)

    await waitFor(() => expect(screen.getByText(LEFT_OFF_REPORT)).toBeInTheDocument())
  })

  it('waits for any other window to close, so it never opens on top of one', async () => {
    var nextLaunch = await launchAfterAQuitDuringTheReboot('managed', { otherWindowUp: true })

    await letPendingWorkSettle()
    expect(screen.queryByText(LEFT_OFF_REPORT)).not.toBeInTheDocument()
    await nextLaunch.user.click(screen.getByRole('button', { name: 'close the other window' }))

    await waitFor(() => expect(screen.getByText(LEFT_OFF_REPORT)).toBeInTheDocument())
  })

  it('shows it only once', async () => {
    var nextLaunch = await launchAfterAQuitDuringTheReboot('managed', { reactStrictMode: true })
    await waitFor(() => expect(screen.getByText(LEFT_OFF_REPORT)).toBeInTheDocument())
    await nextLaunch.user.click(screen.getByRole('button', { name: 'close the report' }))
    nextLaunch.unmount()

    setup(<NextLaunch printerStatus="managed" />)
    await letPendingWorkSettle()

    expect(screen.queryByText(LEFT_OFF_REPORT)).not.toBeInTheDocument()
  })

  it('leaves nothing for the next launch once the window has shown it', async () => {
    var rendered = await reactivateUntilItsReboot({ ok: false, results: [putBack, leftOff] })
    rendered.unmount()
    expect(rendered.onPluginsLeftOff).toHaveBeenCalledOnce()

    setup(<NextLaunch printerStatus="managed" />)
    await letPendingWorkSettle()

    expect(screen.queryByText(LEFT_OFF_REPORT)).not.toBeInTheDocument()
  })

  it('gives way to a newer report of the printer that was shown at once', async () => {
    var answerTheReactivate!: (answer: BatchResult) => void
    var reactivateAnswer = new Promise<BatchResult>(function capture(resolve) { answerTheReactivate = resolve })
    var laterReactivate: Awaited<ReturnType<typeof reactivateStarted>>
    quitTheApp(await reactivateUntilItsReboot({ ok: false, results: [putBack, leftOff] }))
    laterReactivate = await reactivateStarted(() => reactivateAnswer)
    laterReactivate.unmount()
    await act(async () => answerTheReactivate({ ok: false, results: [leftOff] }))
    expect(laterReactivate.onPluginsLeftOff).toHaveBeenCalledOnce()

    setup(<NextLaunch printerStatus="managed" />)
    await letPendingWorkSettle()

    expect(screen.queryByText(LEFT_OFF_REPORT)).not.toBeInTheDocument()
  })

  it('goes with the printer when the printer is removed', async () => {
    var nextLaunch = await launchAfterAQuitDuringTheReboot('offline')
    await nextLaunch.user.click(screen.getByRole('button', { name: 'remove the printer' }))
    nextLaunch.unmount()

    setup(<NextLaunch printerStatus="managed" />)
    await letPendingWorkSettle()

    expect(screen.queryByText(LEFT_OFF_REPORT)).not.toBeInTheDocument()
  })
})
