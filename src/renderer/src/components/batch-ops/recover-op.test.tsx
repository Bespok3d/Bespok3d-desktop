// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { setup } from '../../test/harness'
import { useRecoverOp } from './recover-op'

// A printer that never answers again: the report must stay behind it rather than appear anyway.
function neverAnswers() {
  return new Promise<void>(() => {})
}

function answersAtOnce() {
  return Promise.resolve()
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

// The recovery, its restart and its wait, wired the way the app wires them, so what the test reads is
// what the user would be looking at.
function RecoverOpHarness({ restart, waitForBack }: { restart: () => Promise<boolean>; waitForBack: () => Promise<void> }) {
  const recoverOp = useRecoverOp(restart, refusalIsNotUnderTest, waitForBack, () => Promise.resolve(42))

  return (
    <>
      <button type="button" onClick={() => recoverOp.runRecover('printer-1')}>recover</button>
      {recoverOp.recovering && <p>putting the plugins back</p>}
      {recoverOp.printerRestarting && <p>the printer is restarting</p>}
      {recoverOp.recoveryResults && <p>the recovery report</p>}
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
})
