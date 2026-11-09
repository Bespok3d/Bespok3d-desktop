// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { setup } from '../../test/harness'
import { useRecoverOp } from './recover-op'

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
function RecoverOpHarness({ restart, waitForBack, appRestartsItself = () => Promise.resolve(true) }: {
  restart: () => Promise<boolean>
  waitForBack: () => Promise<boolean>
  appRestartsItself?: () => Promise<boolean>
}) {
  const recoverOp = useRecoverOp(restart, refusalIsNotUnderTest, waitForBack, () => Promise.resolve(42), appRestartsItself)

  return (
    <>
      <button type="button" onClick={() => recoverOp.runRecover('printer-1')}>recover</button>
      <button type="button" onClick={() => recoverOp.showPluginsLeftOff(reactivateLeftOff)}>reactivate left plugins off</button>
      {recoverOp.recovering && <p>putting the plugins back</p>}
      {recoverOp.printerRestarting && <p>the printer is restarting</p>}
      {recoverOp.recoveryResults && <p>the recovery report</p>}
      {recoverOp.recoveryResults && <p>restart: {recoverOp.restartingAfterRecovery}</p>}
      {recoverOp.recoveryResults && <p>rows: {recoverOp.recoveryResults.results.map((row) => row.reason).join(', ')}</p>}
      {recoverOp.recoveryResults && <p>report ok: {String(recoverOp.recoveryResults.ok)}</p>}
    </>
  )
}

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
