// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { setup } from '../../test/harness'
import { makeT } from '../../i18n'
import { BatchOpModal, useBatchOps } from './index'

const en = makeT('en')

// What the renderer actually receives when the printer refuses the call: the daemon's sentence with
// Electron's IPC plumbing wrapped around it.
const PRINTING_REFUSAL = "Error invoking remote method 'store:update-batch': Error: The printer is busy: this would restart klipper, interrupting the print. Try again when it is idle."

// A mismatched daemon and driver: every operation ends in the same refusal, whatever it was asked to do.
const MISMATCH_REFUSAL = "Error invoking remote method 'store:update-batch': Error: ProtocolError: AttributeError: 'SnapmakerU1Jinni' object has no attribute 'service_control'"

function ignoreRepair() {}

// The update-all button and its modal, wired exactly as the app wires them, so the test exercises the
// path from a rejected batch call to what the user is left looking at.
function UpdateAllHarness({ onRepairPrinter = ignoreRepair }: { onRepairPrinter?: (printerId: string) => void }) {
  const batchOps = useBatchOps([], () => {}, (startInstall) => startInstall())

  return (
    <>
      <button type="button" onClick={() => batchOps.runUpdateAll('printer-1', [{ pluginId: 'spoolman' }])}>run</button>
      <BatchOpModal
        variant="update"
        busy={batchOps.updatingAll}
        result={batchOps.updateAllResult}
        progress={batchOps.batchProgress}
        failure={batchOps.batchFailure}
        onRepairPrinter={onRepairPrinter}
        onClose={() => batchOps.setUpdateAllResult(null)}
        onDismissFailure={batchOps.dismissBatchFailure}
      />
    </>
  )
}

describe('a batch the printer refused', () => {
  it('tells the user why instead of closing on nothing', async () => {
    const updateBatch = vi.fn().mockRejectedValue(new Error(PRINTING_REFUSAL))
    const { user } = setup(<UpdateAllHarness />, { b3d: { store: { updateBatch } } })

    await user.click(screen.getByRole('button', { name: 'run' }))

    await waitFor(() => expect(screen.getByText(en('update_failed.title'))).toBeInTheDocument())
    expect(screen.getByText('The printer is busy: this would restart klipper, interrupting the print. Try again when it is idle.')).toBeInTheDocument()
    expect(screen.queryByText(en('updating_all.title'))).not.toBeInTheDocument()
  })

  it('closes when the user has read it', async () => {
    const updateBatch = vi.fn().mockRejectedValue(new Error(PRINTING_REFUSAL))
    const { user } = setup(<UpdateAllHarness />, { b3d: { store: { updateBatch } } })

    await user.click(screen.getByRole('button', { name: 'run' }))
    await waitFor(() => expect(screen.getByText(en('update_failed.title'))).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: en('btn.close') }))
    expect(screen.queryByText(en('update_failed.title'))).not.toBeInTheDocument()
  })

  it('shows the refusal on the operation that was refused and no other', async () => {
    const updateBatch = vi.fn().mockRejectedValue(new Error(PRINTING_REFUSAL))
    const { user } = setup(
      <>
        <UpdateAllHarness />
        <BatchOpModal variant="install" busy={false} result={null} failure={null} onRepairPrinter={ignoreRepair} onClose={() => {}} onDismissFailure={() => {}} />
      </>,
      { b3d: { store: { updateBatch } } },
    )

    await user.click(screen.getByRole('button', { name: 'run' }))

    await waitFor(() => expect(screen.getByText(en('update_failed.title'))).toBeInTheDocument())
    expect(screen.queryByText(en('install_failed.title'))).not.toBeInTheDocument()
  })
})

describe('a batch refused by a mismatched daemon and driver', () => {
  it('offers to repair the printer, and says why that puts it right', async () => {
    const updateBatch = vi.fn().mockRejectedValue(new Error(MISMATCH_REFUSAL))
    const onRepairPrinter = vi.fn()
    const { user } = setup(<UpdateAllHarness onRepairPrinter={onRepairPrinter} />, { b3d: { store: { updateBatch } } })

    await user.click(screen.getByRole('button', { name: 'run' }))
    await waitFor(() => expect(screen.getByText(en('update_failed.title'))).toBeInTheDocument())
    expect(screen.getByText(en('batch_failed.mismatch_advice'))).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: en('batch_failed.repair') }))
    expect(onRepairPrinter).toHaveBeenCalledWith('printer-1')
  })

  it('never offers it for a refusal the printer meant, where repairing would change nothing', async () => {
    const updateBatch = vi.fn().mockRejectedValue(new Error(PRINTING_REFUSAL))
    const { user } = setup(<UpdateAllHarness />, { b3d: { store: { updateBatch } } })

    await user.click(screen.getByRole('button', { name: 'run' }))
    await waitFor(() => expect(screen.getByText(en('update_failed.title'))).toBeInTheDocument())

    expect(screen.queryByRole('button', { name: en('batch_failed.repair') })).not.toBeInTheDocument()
  })
})
