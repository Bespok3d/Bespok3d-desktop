// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { setup } from '../../test/harness'
import { makeT } from '../../i18n'
import type { UpdateAllPlan } from '../plugin-store/migrations'
import { BatchOpModal, useBatchOps } from './index'

const en = makeT('en')

const MOTION_MIGRATION = {
  migratingPluginId: 'klipper-motion',
  comingOffThePrinter: true,
  arrivingSpecs: [{ pluginId: 'u1-base-toolhead' }, { pluginId: 'u1-base-shaper-calibrate' }],
}

function ignoreRestart() {
  return Promise.resolve(false)
}

// One press of Update All, wired the way the app wires it: whatever the plan holds goes to the printer
// in one run and comes back as one report the user reads.
function UpdatePlanHarness({ plan, onOpenPlugin = () => {} }: { plan: UpdateAllPlan; onOpenPlugin?: (pluginId: string) => void }) {
  const batchOps = useBatchOps([], () => {}, (startInstall) => startInstall(), ignoreRestart)

  return (
    <>
      <button type="button" onClick={() => batchOps.runUpdateAll('printer-1', plan)}>update all</button>
      <BatchOpModal
        variant="update"
        busy={batchOps.updatingAll}
        result={batchOps.updateAllResult}
        progress={batchOps.batchProgress}
        failure={batchOps.batchFailure}
        onRepairPrinter={() => {}}
        onOpenPlugin={onOpenPlugin}
        onClose={() => batchOps.setUpdateAllResult(null)}
        onDismissFailure={batchOps.dismissBatchFailure}
      />
    </>
  )
}

describe('Update All carries the plugins that retired into a set', () => {
  it('takes the retired plugin off, puts the plugins that took over its job on, then updates the rest', async () => {
    const uninstallBatch = vi.fn().mockResolvedValue({ ok: true, results: [{ pluginId: 'klipper-motion', ok: true, skipped: false, reason: '', log: [] }] })
    const installBatch = vi.fn().mockResolvedValue({ ok: true, results: [] })
    const updateBatch = vi.fn().mockResolvedValue({ ok: true, results: [] })
    const plan = { updates: [{ pluginId: 'spoolman' }], migrations: [MOTION_MIGRATION] }
    const { user } = setup(<UpdatePlanHarness plan={plan} />, { b3d: { store: { uninstallBatch, installBatch, updateBatch } } })

    await user.click(screen.getByRole('button', { name: 'update all' }))

    expect(uninstallBatch).toHaveBeenCalledWith('printer-1', ['klipper-motion'], false)
    await waitFor(() => expect(installBatch).toHaveBeenCalledWith('printer-1', MOTION_MIGRATION.arrivingSpecs))
    await waitFor(() => expect(updateBatch).toHaveBeenCalledWith('printer-1', [{ pluginId: 'spoolman' }]))
  })

  // Putting the base-layer plugins on over files a still-installed predecessor has already patched is
  // the one way this corrupts a printer. The removal that did not hold keeps the members off, and the
  // plugins that had nothing to do with it are still updated.
  it('keeps the replacements off when the retired plugin would not come off, and still updates the rest', async () => {
    const uninstallBatch = vi.fn().mockResolvedValue({ ok: false, results: [{ pluginId: 'klipper-motion', ok: false, skipped: false, reason: 'could not revert toolhead.py', log: [] }] })
    const installBatch = vi.fn().mockResolvedValue({ ok: true, results: [] })
    const updateBatch = vi.fn().mockResolvedValue({ ok: true, results: [{ pluginId: 'spoolman', ok: true, skipped: false, reason: '', log: [] }] })
    const plan = { updates: [{ pluginId: 'spoolman' }], migrations: [MOTION_MIGRATION] }
    const { user } = setup(<UpdatePlanHarness plan={plan} />, { b3d: { store: { uninstallBatch, installBatch, updateBatch } } })

    await user.click(screen.getByRole('button', { name: 'update all' }))

    await waitFor(() => expect(updateBatch).toHaveBeenCalledWith('printer-1', [{ pluginId: 'spoolman' }]))
    expect(installBatch).not.toHaveBeenCalled()
  })

  it('leaves the user a way out of the plugin it could not replace instead of a dead end', async () => {
    const uninstallBatch = vi.fn().mockResolvedValue({ ok: false, results: [{ pluginId: 'klipper-motion', ok: false, skipped: false, reason: 'could not revert toolhead.py', log: [] }] })
    const updateBatch = vi.fn().mockResolvedValue({ ok: true, results: [] })
    const onOpenPlugin = vi.fn()
    const plan = { updates: [], migrations: [MOTION_MIGRATION] }
    const { user } = setup(<UpdatePlanHarness plan={plan} onOpenPlugin={onOpenPlugin} />, { b3d: { store: { uninstallBatch, updateBatch } } })

    await user.click(screen.getByRole('button', { name: 'update all' }))

    await user.click(await screen.findByRole('button', { name: en('btn.fix') }))
    expect(onOpenPlugin).toHaveBeenCalledWith('klipper-motion')
  })

  it('does not go near uninstall on a printer with nothing to replace', async () => {
    const uninstallBatch = vi.fn().mockResolvedValue({ ok: true, results: [] })
    const updateBatch = vi.fn().mockResolvedValue({ ok: true, results: [] })
    const plan = { updates: [{ pluginId: 'spoolman' }], migrations: [] }
    const { user } = setup(<UpdatePlanHarness plan={plan} />, { b3d: { store: { uninstallBatch, updateBatch } } })

    await user.click(screen.getByRole('button', { name: 'update all' }))

    await waitFor(() => expect(updateBatch).toHaveBeenCalledWith('printer-1', [{ pluginId: 'spoolman' }]))
    expect(uninstallBatch).not.toHaveBeenCalled()
  })
})
