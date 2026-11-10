// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom
import { beforeEach, describe, it, expect, vi } from 'vitest'
import { act, screen, waitFor } from '@testing-library/react'
import { setup } from '../../test/harness'
import { useRecoverOp } from './recover-op'
import { usePrinterSync } from '../../hooks/printers'
import { CHECKS_LEFT_KEY, HELD_REPORTS_KEY, keepFor, keptFor } from './kept-over-a-quit'

// A printer that never answers again: the report must stay behind it rather than appear anyway.
function neverAnswers() {
  return new Promise<boolean>(() => {})
}

function answersAtOnce() {
  return Promise.resolve(true)
}

// The wait ran to its time limit and the printer's daemon never answered.
function waitRanOut() {
  return Promise.resolve(false)
}

// The restart the app makes itself does not answer until the printer has gone down and come back,
// which is minutes. Everything the user is meant to be looking at has to hold for that whole time.
function stillRestarting() {
  return new Promise<boolean>(() => {})
}

// Lets a check that should not run have every chance to, before the test says it did not.
async function letPendingWorkSettle(): Promise<void> {
  await act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)))
}

// No refusal is under test here; the printer takes the recovery every time.
function refusalIsNotUnderTest() {
  return function ignoreRefusal() {}
}

const reactivateLeftOff = {
  ok: false,
  results: [{ pluginId: 'spoolman', ok: false, skipped: false, reason: 'spoolman switched off', log: [] }],
}

// The recovery, its restart and its wait, wired the way the app wires them, so what the test reads is
// what the user would be looking at.
function RecoverOpHarness({ restart, waitForBack, appRestartsItself = () => Promise.resolve(true), restartSecondsOf = () => Promise.resolve(42) }: {
  restart: () => Promise<boolean>
  waitForBack: () => Promise<boolean>
  appRestartsItself?: () => Promise<boolean>
  restartSecondsOf?: (printerId: string) => Promise<number | null>
}) {
  const recoverOp = useRecoverOp(restart, refusalIsNotUnderTest, waitForBack, restartSecondsOf, appRestartsItself)

  return (
    <>
      <button type="button" onClick={() => recoverOp.runRecover('printer-1')}>recover</button>
      <button type="button" onClick={() => recoverOp.runRecover('printer-2')}>recover another printer</button>
      <button type="button" onClick={() => recoverOp.showPluginsLeftOff(reactivateLeftOff)}>reactivate left plugins off</button>
      <button type="button" onClick={() => recoverOp.checkAfterTheirRestart('printer-1')}>they restarted the printer</button>
      <button type="button" onClick={() => recoverOp.checkAfterTheirRestart('printer-2')}>they restarted another printer</button>
      {recoverOp.recovering && <p>putting the plugins back</p>}
      {recoverOp.printerRestarting && <p>the printer is restarting</p>}
      {recoverOp.printerRestarting && <p>restart seconds: {String(recoverOp.restartSeconds)}</p>}
      {recoverOp.recoveryResults && <p>the recovery report</p>}
      {recoverOp.recoveryResults && <p>restart: {recoverOp.restartingAfterRecovery}</p>}
      {recoverOp.recoveryResults && <p>rows: {recoverOp.recoveryResults.results.map((row) => row.reason).join(', ')}</p>}
      {recoverOp.recoveryResults && <p>report ok: {String(recoverOp.recoveryResults.ok)}</p>}
    </>
  )
}

// The check left to the user's restart outlives the app, so no test may hand its own to the next.
beforeEach(() => localStorage.clear())

describe('the recovery report', () => {
  it('leaves nothing on screen for the user to read: the restarting screen is up for the whole restart', async () => {
    const recover = vi.fn().mockResolvedValue({ ok: true, results: [] })
    const { user } = setup(
      <RecoverOpHarness restart={stillRestarting} waitForBack={neverAnswers} />,
      { b3d: { store: { recover } } },
    )

    await user.click(screen.getByRole('button', { name: 'recover' }))

    await waitFor(() => expect(screen.getByText('the printer is restarting')).toBeInTheDocument())
    expect(screen.queryByText('putting the plugins back')).not.toBeInTheDocument()
    expect(screen.queryByText('the recovery report')).not.toBeInTheDocument()
  })

  it('is not shown while the printer is still restarting', async () => {
    const recover = vi.fn().mockResolvedValue({ ok: true, results: [] })
    const { user } = setup(
      <RecoverOpHarness restart={vi.fn().mockResolvedValue(true)} waitForBack={neverAnswers} />,
      { b3d: { store: { recover } } },
    )

    await user.click(screen.getByRole('button', { name: 'recover' }))

    await waitFor(() => expect(screen.getByText('the printer is restarting')).toBeInTheDocument())
    expect(screen.queryByText('the recovery report')).not.toBeInTheDocument()
  })

  it('is shown once the printer answers again', async () => {
    const recover = vi.fn().mockResolvedValue({ ok: true, results: [] })
    const { user } = setup(
      <RecoverOpHarness restart={vi.fn().mockResolvedValue(true)} waitForBack={answersAtOnce} />,
      { b3d: { store: { recover } } },
    )

    await user.click(screen.getByRole('button', { name: 'recover' }))

    await waitFor(() => expect(screen.getByText('the recovery report')).toBeInTheDocument())
    expect(screen.queryByText('the printer is restarting')).not.toBeInTheDocument()
  })

  it('is shown at once for a printer nothing restarted, since there is nothing to wait for', async () => {
    const recover = vi.fn().mockResolvedValue({ ok: true, results: [] })
    const waitForBack = vi.fn().mockImplementation(neverAnswers)
    const { user } = setup(
      <RecoverOpHarness restart={vi.fn().mockResolvedValue(false)} waitForBack={waitForBack} />,
      { b3d: { store: { recover } } },
    )

    await user.click(screen.getByRole('button', { name: 'recover' }))

    await waitFor(() => expect(screen.getByText('the recovery report')).toBeInTheDocument())
    expect(screen.queryByText('the printer is restarting')).not.toBeInTheDocument()
    expect(waitForBack).not.toHaveBeenCalled()
  })

  it('says the printer did not answer when the wait runs out, and runs nothing more', async () => {
    const recover = vi.fn().mockResolvedValue({ ok: true, results: [] })
    const restart = vi.fn().mockResolvedValue(true)
    const { user } = setup(
      <RecoverOpHarness restart={restart} waitForBack={waitRanOut} />,
      { b3d: { store: { recover } } },
    )

    await user.click(screen.getByRole('button', { name: 'recover' }))

    await waitFor(() => expect(screen.getByText('restart: not-back')).toBeInTheDocument())
    expect(recover).toHaveBeenCalledTimes(1)
    expect(restart).toHaveBeenCalledTimes(1)
  })
})

// Bespok3d-desktop#30: the printer restarted its services one by one and was then rebooted by the app.
describe('telling the printer a reboot follows', () => {
  it('tells it when the app will restart the printer itself', async () => {
    const recover = vi.fn().mockResolvedValue({ ok: true, results: [] })
    const { user } = setup(
      <RecoverOpHarness restart={vi.fn().mockResolvedValue(true)} waitForBack={answersAtOnce} appRestartsItself={() => Promise.resolve(true)} />,
      { b3d: { store: { recover } } },
    )

    await user.click(screen.getByRole('button', { name: 'recover' }))

    await waitFor(() => expect(recover).toHaveBeenCalledWith('printer-1', true))
  })

  it('does not tell it when the restart waits on the user, so the printer keeps its services restart', async () => {
    const recover = vi.fn().mockResolvedValue({ ok: true, results: [] })
    const { user } = setup(
      <RecoverOpHarness restart={vi.fn().mockResolvedValue(false)} waitForBack={answersAtOnce} appRestartsItself={() => Promise.resolve(false)} />,
      { b3d: { store: { recover } } },
    )

    await user.click(screen.getByRole('button', { name: 'recover' }))

    await waitFor(() => expect(recover).toHaveBeenCalledWith('printer-1', false))
  })
})

const pluginBack = { pluginId: 'camera', ok: true, skipped: false, reason: 'camera back', log: [] }
const rebootReplacesRestart = {
  pluginId: '(services)', ok: true, skipped: false, reason: 'the printer reboot replaces the services restart',
  log: [{ id: 'reboot-replaces-restart', label: 'the printer reboot replaces the services restart', ok: true, items: [] }],
}
const takenOffAfterTheReboot = { pluginId: '(services)', ok: false, skipped: false, reason: 'spoolman taken off', log: [], autoDeactivated: 'spoolman' }

// daemon 0.14.3: a recover the app reboots after leaves the check its services restart would have had
// to that reboot, and the app asks for it once the printer is back.
describe('the check the reboot replaced', () => {
  it('is asked for once the printer is back, and its row takes the place of the one saying the reboot replaced the restart', async () => {
    const recover = vi.fn().mockResolvedValue({ ok: true, results: [pluginBack, rebootReplacesRestart] })
    const recoverAfterReboot = vi.fn().mockResolvedValue({ ok: false, results: [takenOffAfterTheReboot] })
    const { user } = setup(
      <RecoverOpHarness restart={vi.fn().mockResolvedValue(true)} waitForBack={answersAtOnce} />,
      { b3d: { store: { recover, recoverAfterReboot } } },
    )

    await user.click(screen.getByRole('button', { name: 'recover' }))

    await waitFor(() => expect(screen.getByText('rows: camera back, spoolman taken off')).toBeInTheDocument())
    expect(recoverAfterReboot).toHaveBeenCalledWith('printer-1')
    expect(screen.getByText('report ok: false')).toBeInTheDocument()
  })

  it('puts the check row of a plugin it switched off in place of the row that said the plugin was back', async () => {
    const cameraSwitchedOff = { pluginId: 'camera', ok: false, skipped: false, reason: 'camera switched off', log: [], autoDeactivated: 'camera' }
    const recover = vi.fn().mockResolvedValue({ ok: true, results: [pluginBack, rebootReplacesRestart] })
    const recoverAfterReboot = vi.fn().mockResolvedValue({ ok: false, results: [cameraSwitchedOff, takenOffAfterTheReboot] })
    const { user } = setup(
      <RecoverOpHarness restart={vi.fn().mockResolvedValue(true)} waitForBack={answersAtOnce} />,
      { b3d: { store: { recover, recoverAfterReboot } } },
    )

    await user.click(screen.getByRole('button', { name: 'recover' }))

    await waitFor(() => expect(screen.getByText('rows: camera switched off, spoolman taken off')).toBeInTheDocument())
    expect(screen.getByText('report ok: false')).toBeInTheDocument()
  })

  it('leaves the report as the recover gave it when the check still did not run', async () => {
    const recover = vi.fn().mockResolvedValue({ ok: true, results: [pluginBack, rebootReplacesRestart] })
    const recoverAfterReboot = vi.fn().mockRejectedValue(new Error('the printer is printing'))
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { user } = setup(
      <RecoverOpHarness restart={vi.fn().mockResolvedValue(true)} waitForBack={answersAtOnce} />,
      { b3d: { store: { recover, recoverAfterReboot } } },
    )

    await user.click(screen.getByRole('button', { name: 'recover' }))

    await waitFor(() => expect(screen.getByText('rows: camera back, the printer reboot replaces the services restart')).toBeInTheDocument())
    expect(recoverAfterReboot).toHaveBeenCalledWith('printer-1')
    expect(errorLog).toHaveBeenCalled()
    errorLog.mockRestore()
  })

  it('is not asked for when the recover left nothing to the reboot', async () => {
    const recover = vi.fn().mockResolvedValue({ ok: true, results: [pluginBack] })
    const recoverAfterReboot = vi.fn()
    const { user } = setup(
      <RecoverOpHarness restart={vi.fn().mockResolvedValue(true)} waitForBack={answersAtOnce} />,
      { b3d: { store: { recover, recoverAfterReboot } } },
    )

    await user.click(screen.getByRole('button', { name: 'recover' }))

    await waitFor(() => expect(screen.getByText('the recovery report')).toBeInTheDocument())
    expect(recoverAfterReboot).not.toHaveBeenCalled()
  })

  it('is not asked for when the printer did not come back', async () => {
    const recover = vi.fn().mockResolvedValue({ ok: true, results: [pluginBack, rebootReplacesRestart] })
    const recoverAfterReboot = vi.fn()
    const { user } = setup(
      <RecoverOpHarness restart={vi.fn().mockResolvedValue(true)} waitForBack={waitRanOut} />,
      { b3d: { store: { recover, recoverAfterReboot } } },
    )

    await user.click(screen.getByRole('button', { name: 'recover' }))

    await waitFor(() => expect(screen.getByText('restart: not-back')).toBeInTheDocument())
    expect(recoverAfterReboot).not.toHaveBeenCalled()
  })
})

// A reactivate ends on its own success screen; the plugins it switched off are told in this report.
describe('the plugins a reactivate left off', () => {
  it('are shown in the report, with no restart to wait for', async () => {
    const { user } = setup(<RecoverOpHarness restart={stillRestarting} waitForBack={neverAnswers} />)

    await user.click(screen.getByRole('button', { name: 'reactivate left plugins off' }))

    expect(screen.getByText('rows: spoolman switched off')).toBeInTheDocument()
    expect(screen.getByText('restart: none')).toBeInTheDocument()
    expect(screen.queryByText('the printer is restarting')).not.toBeInTheDocument()
  })
})

// The app's own restart failed, so the restart window asked the user to make it instead. The check the
// recover left to the reboot runs once that restart is done, or a plugin that breaks the printer once it
// is back is neither taken off nor reported.
describe('the check left to the restart the user makes', () => {
  it('runs once they have restarted the printer, and its row takes the place of the one saying the reboot replaced the restart', async () => {
    const recover = vi.fn().mockResolvedValue({ ok: true, results: [pluginBack, rebootReplacesRestart] })
    const recoverAfterReboot = vi.fn().mockResolvedValue({ ok: false, results: [takenOffAfterTheReboot] })
    const { user } = setup(
      <RecoverOpHarness restart={vi.fn().mockResolvedValue(false)} waitForBack={answersAtOnce} />,
      { b3d: { store: { recover, recoverAfterReboot } } },
    )
    await user.click(screen.getByRole('button', { name: 'recover' }))
    await waitFor(() => expect(screen.getByText('restart: none')).toBeInTheDocument())
    expect(recoverAfterReboot).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'they restarted the printer' }))

    await waitFor(() => expect(screen.getByText('rows: camera back, spoolman taken off')).toBeInTheDocument())
    expect(recoverAfterReboot).toHaveBeenCalledTimes(1)
    expect(screen.getByText('restart: restarted')).toBeInTheDocument()
  })

  it('runs only once, however many times the printer is restarted after', async () => {
    const recover = vi.fn().mockResolvedValue({ ok: true, results: [pluginBack, rebootReplacesRestart] })
    const recoverAfterReboot = vi.fn().mockResolvedValue({ ok: true, results: [] })
    const { user } = setup(
      <RecoverOpHarness restart={vi.fn().mockResolvedValue(false)} waitForBack={answersAtOnce} />,
      { b3d: { store: { recover, recoverAfterReboot } } },
    )
    await user.click(screen.getByRole('button', { name: 'recover' }))
    await waitFor(() => expect(screen.getByText('restart: none')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'they restarted the printer' }))
    await waitFor(() => expect(screen.getByText('restart: restarted')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: 'they restarted the printer' }))
    await letPendingWorkSettle()

    expect(recoverAfterReboot).toHaveBeenCalledTimes(1)
  })

  it('is not run for a restart of another printer', async () => {
    const recover = vi.fn().mockResolvedValue({ ok: true, results: [pluginBack, rebootReplacesRestart] })
    const recoverAfterReboot = vi.fn()
    const { user } = setup(
      <RecoverOpHarness restart={vi.fn().mockResolvedValue(false)} waitForBack={answersAtOnce} />,
      { b3d: { store: { recover, recoverAfterReboot } } },
    )
    await user.click(screen.getByRole('button', { name: 'recover' }))
    await waitFor(() => expect(screen.getByText('restart: none')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'they restarted another printer' }))
    await letPendingWorkSettle()

    expect(recoverAfterReboot).not.toHaveBeenCalled()
    expect(screen.getByText('restart: none')).toBeInTheDocument()
  })

  it('is not run when the recover left nothing to the reboot', async () => {
    const recover = vi.fn().mockResolvedValue({ ok: true, results: [pluginBack] })
    const recoverAfterReboot = vi.fn()
    const { user } = setup(
      <RecoverOpHarness restart={vi.fn().mockResolvedValue(false)} waitForBack={answersAtOnce} />,
      { b3d: { store: { recover, recoverAfterReboot } } },
    )
    await user.click(screen.getByRole('button', { name: 'recover' }))
    await waitFor(() => expect(screen.getByText('restart: none')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'they restarted the printer' }))
    await letPendingWorkSettle()

    expect(recoverAfterReboot).not.toHaveBeenCalled()
  })

  it('is not run after the app made the restart itself, which already ran it', async () => {
    const recover = vi.fn().mockResolvedValue({ ok: true, results: [pluginBack, rebootReplacesRestart] })
    const recoverAfterReboot = vi.fn().mockResolvedValue({ ok: true, results: [] })
    const { user } = setup(
      <RecoverOpHarness restart={vi.fn().mockResolvedValue(true)} waitForBack={answersAtOnce} />,
      { b3d: { store: { recover, recoverAfterReboot } } },
    )
    await user.click(screen.getByRole('button', { name: 'recover' }))
    await waitFor(() => expect(screen.getByText('restart: restarted')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'they restarted the printer' }))
    await letPendingWorkSettle()

    expect(recoverAfterReboot).toHaveBeenCalledTimes(1)
  })
})

// The user may quit the app between the recover and the restart they make.
describe('the check left to the restart the user makes, across an app restart', () => {
  it('still runs when the app was restarted between the recover and their restart', async () => {
    const recover = vi.fn().mockResolvedValue({ ok: true, results: [pluginBack, rebootReplacesRestart] })
    const recoverAfterReboot = vi.fn().mockResolvedValue({ ok: false, results: [takenOffAfterTheReboot] })
    const store = { b3d: { store: { recover, recoverAfterReboot } } }
    const appBeforeItsRestart = setup(<RecoverOpHarness restart={vi.fn().mockResolvedValue(false)} waitForBack={answersAtOnce} />, store)
    await appBeforeItsRestart.user.click(screen.getByRole('button', { name: 'recover' }))
    await waitFor(() => expect(screen.getByText('restart: none')).toBeInTheDocument())
    appBeforeItsRestart.unmount()

    const { user } = setup(<RecoverOpHarness restart={vi.fn().mockResolvedValue(false)} waitForBack={answersAtOnce} />, store)
    await user.click(screen.getByRole('button', { name: 'they restarted the printer' }))

    await waitFor(() => expect(screen.getByText('rows: camera back, spoolman taken off')).toBeInTheDocument())
    expect(recoverAfterReboot).toHaveBeenCalledTimes(1)
  })
})

// Each printer keeps its own check: the user can recover a second printer before restarting the first.
describe('the check left to the restart the user makes, with more than one printer', () => {
  it('still runs after another printer was recovered meanwhile', async () => {
    const recover = vi.fn().mockResolvedValue({ ok: true, results: [pluginBack, rebootReplacesRestart] })
    const recoverAfterReboot = vi.fn().mockResolvedValue({ ok: true, results: [] })
    const { user } = setup(
      <RecoverOpHarness restart={vi.fn().mockResolvedValue(false)} waitForBack={answersAtOnce} />,
      { b3d: { store: { recover, recoverAfterReboot } } },
    )
    await user.click(screen.getByRole('button', { name: 'recover' }))
    await waitFor(() => expect(recover).toHaveBeenCalledWith('printer-1', true))
    await user.click(screen.getByRole('button', { name: 'recover another printer' }))
    await waitFor(() => expect(recover).toHaveBeenCalledWith('printer-2', true))
    await letPendingWorkSettle()

    await user.click(screen.getByRole('button', { name: 'they restarted the printer' }))
    await waitFor(() => expect(recoverAfterReboot).toHaveBeenCalledWith('printer-1'))
    await user.click(screen.getByRole('button', { name: 'they restarted another printer' }))

    await waitFor(() => expect(recoverAfterReboot).toHaveBeenCalledWith('printer-2'))
    expect(recoverAfterReboot).toHaveBeenCalledTimes(2)
  })

  it('shows the restart length of the printer the user restarted, not of the one recovered last', async () => {
    const recover = vi.fn().mockResolvedValue({ ok: true, results: [pluginBack, rebootReplacesRestart] })
    const restartLengths: Record<string, number> = { 'printer-1': 42, 'printer-2': 90 }
    const { user } = setup(
      <RecoverOpHarness restart={vi.fn().mockResolvedValue(false)} waitForBack={neverAnswers} restartSecondsOf={(printerId) => Promise.resolve(restartLengths[printerId])} />,
      { b3d: { store: { recover, recoverAfterReboot: vi.fn() } } },
    )
    await user.click(screen.getByRole('button', { name: 'recover' }))
    await waitFor(() => expect(recover).toHaveBeenCalledWith('printer-1', true))
    await user.click(screen.getByRole('button', { name: 'recover another printer' }))
    await waitFor(() => expect(recover).toHaveBeenCalledWith('printer-2', true))
    await letPendingWorkSettle()

    await user.click(screen.getByRole('button', { name: 'they restarted the printer' }))

    await waitFor(() => expect(screen.getByText('restart seconds: 42')).toBeInTheDocument())
  })
})

// Removing a printer the app's own way, beside the recovery, as the printer list sits beside it in the app.
function RemovePrinterButton() {
  const printerSync = usePrinterSync()

  return <button type="button" onClick={() => printerSync.handleRemovePrinter('printer-1')}>remove the printer</button>
}

// Nothing would ever ask for a check kept for a printer that is gone, so it would stay behind for good.
describe('the check left to the restart the user makes, when the printer is removed', () => {
  it('goes with the printer, and the check another printer was left keeps waiting for its restart', async () => {
    const recover = vi.fn().mockResolvedValue({ ok: true, results: [pluginBack, rebootReplacesRestart] })
    const recoverAfterReboot = vi.fn().mockResolvedValue({ ok: true, results: [] })
    const { user } = setup(
      <>
        <RecoverOpHarness restart={vi.fn().mockResolvedValue(false)} waitForBack={answersAtOnce} />
        <RemovePrinterButton />
      </>,
      { b3d: { store: { recover, recoverAfterReboot } } },
    )
    await user.click(screen.getByRole('button', { name: 'recover' }))
    await waitFor(() => expect(recover).toHaveBeenCalledWith('printer-1', true))
    await user.click(screen.getByRole('button', { name: 'recover another printer' }))
    await waitFor(() => expect(recover).toHaveBeenCalledWith('printer-2', true))
    await letPendingWorkSettle()
    expect(localStorage.getItem(CHECKS_LEFT_KEY)).toContain('printer-1')

    await user.click(screen.getByRole('button', { name: 'remove the printer' }))

    expect(localStorage.getItem(CHECKS_LEFT_KEY)).not.toContain('printer-1')
    await user.click(screen.getByRole('button', { name: 'they restarted the printer' }))
    await user.click(screen.getByRole('button', { name: 'they restarted another printer' }))
    await waitFor(() => expect(recoverAfterReboot).toHaveBeenCalledWith('printer-2'))
    expect(recoverAfterReboot).toHaveBeenCalledTimes(1)
  })
})

// A recover puts every plugin back, so the plugins an earlier reactivate left off are not left off any more.
describe('the reactivate report kept over a quit, when the printer is recovered', () => {
  it('is dropped, and the one kept for another printer stays', async () => {
    const recover = vi.fn().mockResolvedValue({ ok: true, results: [pluginBack] })
    keepFor(HELD_REPORTS_KEY, 'printer-1', { reapplied: reactivateLeftOff, heldAt: 1 })
    keepFor(HELD_REPORTS_KEY, 'printer-2', { reapplied: reactivateLeftOff, heldAt: 2 })
    const { user } = setup(<RecoverOpHarness restart={vi.fn().mockResolvedValue(false)} waitForBack={answersAtOnce} />, { b3d: { store: { recover } } })

    await user.click(screen.getByRole('button', { name: 'recover' }))

    await waitFor(() => expect(recover).toHaveBeenCalledWith('printer-1', true))
    expect(keptFor(HELD_REPORTS_KEY, 'printer-1')).toBeUndefined()
    expect(keptFor(HELD_REPORTS_KEY, 'printer-2')).toEqual({ reapplied: reactivateLeftOff, heldAt: 2 })
  })
})
