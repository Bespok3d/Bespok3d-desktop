// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { setup } from '../../test/harness'
import { makeT } from '../../i18n'
import { OtaRecoveryResultsModal } from './ResultsModal'

const en = makeT('en')
const unreadable = { plugin: 'rfid-ntag', problem: 'manifest-unreadable', detail: 'manifest.json: Expecting value: line 1 column 1' }

function results() {
  return {
    ok: false,
    results: [
      { pluginId: 'spoolman', ok: true, skipped: false, reason: '', log: [] },
      { pluginId: 'fluidd', ok: false, skipped: false, reason: 'failed to symlink config', log: [] },
      { pluginId: 'rfid-ntag', ok: false, skipped: true, reason: '', log: [] },
    ],
  }
}

describe('OtaRecoveryResultsModal', () => {
  it('lists every plugin result and the failure reason, and closes', async () => {
    var onClose = vi.fn()
    var { user } = setup(<OtaRecoveryResultsModal results={results()} onOpenPlugin={vi.fn()} onClose={onClose} />)

    expect(screen.getByText(en('recovery_results.title_errors'))).toBeInTheDocument()
    expect(screen.getByText('spoolman')).toBeInTheDocument()
    expect(screen.getByText('fluidd')).toBeInTheDocument()
    expect(screen.getByText('rfid-ntag')).toBeInTheDocument()
    expect(screen.getByText('failed to symlink config')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: en('btn.close') }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('uses the update-variant copy when updating', () => {
    setup(<OtaRecoveryResultsModal results={results()} onOpenPlugin={vi.fn()} onClose={vi.fn()} variant="update" />)
    expect(screen.getByText(en('update_results.title_errors'))).toBeInTheDocument()
  })

  it('uses the install-variant copy when batch-installing', () => {
    setup(<OtaRecoveryResultsModal results={results()} onOpenPlugin={vi.fn()} onClose={vi.fn()} variant="install" />)
    expect(screen.getByText(en('install_results.title_errors'))).toBeInTheDocument()
  })

  // Group 5: a plugin that broke against new firmware is peeled off by the safety net. The modal must
  // surface that it was auto-deactivated (the brief) with the attributing log signal one click away.
  it('highlights an auto-deactivated plugin and reveals the attribution detail on demand', async () => {
    var autoDeactivatedResults = {
      ok: false,
      results: [
        { pluginId: 'spoolman', ok: true, skipped: false, reason: '', log: [] },
        { pluginId: 'klipper-motion', ok: false, skipped: false, reason: 'Disabled klipper-motion to keep the printer working', log: [], autoDeactivated: 'klipper-motion', fixDetail: 'klipper failed to import resonance_tester from klipper-motion' },
      ],
    }
    var { user, container } = setup(<OtaRecoveryResultsModal results={autoDeactivatedResults} onOpenPlugin={vi.fn()} onClose={vi.fn()} />)

    expect(screen.getByText('spoolman')).toBeInTheDocument()
    expect(screen.getByText('Disabled klipper-motion to keep the printer working')).toBeInTheDocument()
    expect(screen.queryByText(/failed to import resonance_tester/)).not.toBeInTheDocument()

    await user.click(container.querySelector('.explainer-toggle') as HTMLElement)
    expect(screen.getByText('klipper failed to import resonance_tester from klipper-motion')).toBeInTheDocument()
  })

  // ADR-0037: the jinni emits a machine diagnosis TOKEN, the client owns the English. The modal must
  // localize a device-infrastructure token, never render the raw token to the user.
  it('localizes a device-diagnosis token instead of showing the raw token', () => {
    var brokerResults = {
      ok: false,
      results: [{ pluginId: '(services)', ok: false, skipped: false, reason: 'broker-down', log: [] }],
    }
    setup(<OtaRecoveryResultsModal results={brokerResults} onOpenPlugin={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByText(en('diagnosis.broker_down'))).toBeInTheDocument()
    expect(screen.queryByText('broker-down')).not.toBeInTheDocument()
  })

  // A plugin whose files another installed plugin edits comes back running, and the printer keeps no
  // packaged copy to put back. The report says so and offers the plugin's own page, where the user
  // reinstalls it; it must never read as a failure and never deactivate anything.
  it('offers to reinstall a plugin whose files were changed on the printer', async () => {
    var changedResults = {
      ok: true,
      results: [
        { pluginId: 'spoolman', ok: true, skipped: false, reason: '', log: [] },
        { pluginId: 'fluidd', ok: true, skipped: false, reason: '', log: [], changedFiles: ['files/fluidd/index.html'] },
      ],
    }
    var onOpenPlugin = vi.fn()
    var onClose = vi.fn()
    var { user } = setup(<OtaRecoveryResultsModal results={changedResults} onOpenPlugin={onOpenPlugin} onClose={onClose} />)

    expect(screen.getByText(en('recovery_results.files_changed', { plugin: 'fluidd' }))).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: en('btn.reinstall') }))
    expect(onOpenPlugin).toHaveBeenCalledWith('fluidd')
    expect(onClose).toHaveBeenCalledOnce()
  })
})

// R-TORN-2: alongside the batch it ran, the printer reports any plugin whose own manifest it could not
// read. The report names that plugin and what the printer could not make sense of. A printer that
// reports nothing shows nothing: that is the ordinary answer, not something to render as a fault.
describe('OtaRecoveryResultsModal, plugins the printer could not read', () => {
  // A batch that ends badly used to end HERE: a failed row, the printer's reason, and a Close button.
  // The plugin's own page is where installing it resolves what it is missing, so a plugin that did not
  // go through has to be one click from it.
  it('offers a way out of a plugin that did not go through, on its own page', async () => {
    var onOpenPlugin = vi.fn()
    var onClose = vi.fn()
    var { user } = setup(<OtaRecoveryResultsModal results={results()} onOpenPlugin={onOpenPlugin} onClose={onClose} variant="update" />)

    await user.click(screen.getByRole('button', { name: en('btn.fix') }))
    expect(onOpenPlugin).toHaveBeenCalledWith('fluidd')
    expect(onClose).toHaveBeenCalledOnce()
  })

  // The dead end the user actually hit: the printer left a plugin out because a plugin it needs was not
  // there, said so, and the report offered only Close. Its own page is where that missing plugin is
  // fetched, so a left-out plugin the printer gave a reason for is one click from putting it right.
  it('offers a way out of a plugin the printer left out because something it needs is missing', async () => {
    var leftOut = {
      ok: false,
      results: [{ pluginId: 'rfid-ntag', ok: false, skipped: true, reason: 'Requires a plugin that provides: u1-base-print-task-config', log: [] }],
    }
    var onOpenPlugin = vi.fn()
    var { user } = setup(<OtaRecoveryResultsModal results={leftOut} onOpenPlugin={onOpenPlugin} onClose={vi.fn()} variant="update" />)

    await user.click(screen.getByRole('button', { name: en('btn.fix') }))
    expect(onOpenPlugin).toHaveBeenCalledWith('rfid-ntag')
  })

  it('offers nothing of the kind for a plugin the printer walked past on purpose', () => {
    var skippedOnly = { ok: true, results: [{ pluginId: 'rfid-ntag', ok: false, skipped: true, reason: '', log: [] }] }
    setup(<OtaRecoveryResultsModal results={skippedOnly} onOpenPlugin={vi.fn()} onClose={vi.fn()} variant="update" />)

    expect(screen.queryByRole('button', { name: en('btn.fix') })).not.toBeInTheDocument()
  })

  // The rows say what happened in the app's own words; what whoever reads the issue needs is the
  // printer's, for every plugin at once, and a screenshot of this modal loses it.
  it('hands the user the whole outcome to paste into a report', async () => {
    var { user } = setup(<OtaRecoveryResultsModal results={results()} onOpenPlugin={vi.fn()} onClose={vi.fn()} variant="update" />)

    await user.click(screen.getByRole('button', { name: en('install_error.copy') }))
    const report = await navigator.clipboard.readText()
    expect(report).toContain('fluidd: failed')
    expect(report).toContain('failed to symlink config')
    expect(report).toContain('spoolman: ok')
  })

  it('does not offer a report for a batch that went through', () => {
    var allInstalled = { ok: true, results: [{ pluginId: 'spoolman', ok: true, skipped: false, reason: '', log: [] }] }
    setup(<OtaRecoveryResultsModal results={allInstalled} onOpenPlugin={vi.fn()} onClose={vi.fn()} variant="update" />)

    expect(screen.queryByRole('button', { name: en('install_error.copy') })).not.toBeInTheDocument()
  })

  it('names the plugin the printer could not read and what it could not make sense of', async () => {
    var warned = { ...results(), manifestWarnings: [unreadable] }
    var { user, container } = setup(<OtaRecoveryResultsModal results={warned} onOpenPlugin={vi.fn()} onClose={vi.fn()} />)

    expect(screen.getByText(en('batch_results.unreadable_plugin', { plugin: 'rfid-ntag' }))).toBeInTheDocument()

    await user.click(container.querySelector('.explainer-toggle') as HTMLElement)
    expect(screen.getByText(new RegExp(en('diagnosis.manifest_unreadable')))).toBeInTheDocument()
    expect(screen.getByText(/Expecting value: line 1 column 1/)).toBeInTheDocument()
    expect(screen.queryByText(/manifest-unreadable/)).not.toBeInTheDocument()
  })

  it('shows nothing of the kind when the printer reported no such plugin', () => {
    var { container } = setup(<OtaRecoveryResultsModal results={results()} onOpenPlugin={vi.fn()} onClose={vi.fn()} />)

    expect(screen.queryByText(en('batch_results.unreadable_plugin', { plugin: 'rfid-ntag' }))).not.toBeInTheDocument()
    expect(container.querySelectorAll('.recovery-row')).toHaveLength(results().results.length)
  })
})

// A printer that only lost its setup gets just that put right, with no plugin put back. The report
// must say so, never that every plugin was re-applied, and must not offer a plugin page for the setup.
describe('OtaRecoveryResultsModal on the printer setup row', () => {
  function setupRepair(ok: boolean) {
    return { ok, results: [{ pluginId: '(printer setup)', ok, skipped: false, reason: ok ? '' : 'selfcheck still reports a problem after the repair', log: [] }] }
  }

  it('says the printer setup was put right, not that the plugins were re-applied', () => {
    setup(<OtaRecoveryResultsModal results={setupRepair(true)} onOpenPlugin={vi.fn()} onClose={vi.fn()} restarting="restarted" />)

    expect(screen.getByText(en('recovery_results.setup_summary_ok'))).toBeInTheDocument()
    expect(screen.getByText(en('recovery_results.setup_restarting'))).toBeInTheDocument()
    expect(screen.getByText(en('recovery_results.setup_row'))).toBeInTheDocument()
    expect(screen.queryByText(en('recovery_results.summary_ok'))).not.toBeInTheDocument()
    expect(screen.queryByText('(printer setup)')).not.toBeInTheDocument()
  })

  it('a setup that could not be put right says so and offers no plugin page', () => {
    setup(<OtaRecoveryResultsModal results={setupRepair(false)} onOpenPlugin={vi.fn()} onClose={vi.fn()} />)

    expect(screen.getByText(en('recovery_results.setup_summary_errors'))).toBeInTheDocument()
    expect(screen.queryByText(en('recovery_results.summary_errors'))).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: en('btn.fix') })).not.toBeInTheDocument()
  })

  // Beside plugin rows, only the plugin that failed gets a way out; the setup row shows its cross alone.
  it('a setup that could not be put right beside plugins shows no internal reason and offers no plugin page for it', () => {
    var setupFailed = setupRepair(false).results[0]
    var pluginFailed = { pluginId: 'fluidd', ok: false, skipped: false, reason: 'failed to symlink config', log: [] }
    setup(<OtaRecoveryResultsModal results={{ ok: false, results: [setupFailed, pluginFailed] }} onOpenPlugin={vi.fn()} onClose={vi.fn()} />)

    expect(screen.getByText(en('recovery_results.setup_row'))).toBeInTheDocument()
    expect(screen.queryByText(setupFailed.reason)).not.toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: en('btn.fix') })).toHaveLength(1)
  })

  it('a setup that could not be put right gets a restart note that does not say it was', () => {
    setup(<OtaRecoveryResultsModal results={setupRepair(false)} onOpenPlugin={vi.fn()} onClose={vi.fn()} restarting="restarted" />)

    const restartNote = screen.getByText(en('recovery_results.setup_restarting'))
    expect(restartNote.textContent).not.toMatch(/put right/)
    expect(screen.queryByText(en('recovery_results.restarting'))).not.toBeInTheDocument()
  })
})

function walkedPast() {
  return { ok: true, results: [{ pluginId: 'spoolman', ok: true, skipped: false, reason: '', log: [] }], manifestWarnings: [unreadable] }
}

// The printer calls a recovery fine with a plugin switched off on the way, so the header cannot just
// repeat the printer's word for it.
describe('OtaRecoveryResultsModal on a plugin switched off during a recovery the printer calls fine', () => {
  it('does not say every plugin went back when the safety net switched one off', () => {
    var switchedOffBySafetyNet = { pluginId: '(services)', ok: true, skipped: false, reason: 'Auto-recovered: deactivated spoolman to keep the printer working', log: [], autoDeactivated: 'spoolman' }
    setup(<OtaRecoveryResultsModal results={{ ok: true, results: [switchedOffBySafetyNet] }} onOpenPlugin={vi.fn()} onClose={vi.fn()} />)

    expect(screen.getByText(en('recovery_results.title_errors'))).toBeInTheDocument()
    expect(screen.getByText(en('recovery_results.summary_errors'))).toBeInTheDocument()
    expect(screen.queryByText(en('recovery_results.summary_ok'))).not.toBeInTheDocument()
  })

  it('does not say every plugin went back when one was left off because a plugin it needs did not come back', () => {
    var leftOffForItsDependency = { pluginId: 'spoolman-rfid', ok: false, skipped: true, reason: 'dependency not satisfied: spoolman', log: [] }
    setup(<OtaRecoveryResultsModal results={{ ok: true, results: [leftOffForItsDependency] }} onOpenPlugin={vi.fn()} onClose={vi.fn()} />)

    expect(screen.getByText(en('recovery_results.title_errors'))).toBeInTheDocument()
    expect(screen.queryByText(en('recovery_results.summary_ok'))).not.toBeInTheDocument()
  })

  it('does not say every plugin went back when the printer walked past one it could not read', () => {
    setup(<OtaRecoveryResultsModal results={walkedPast()} onOpenPlugin={vi.fn()} onClose={vi.fn()} />)

    expect(screen.getByText(en('recovery_results.title_errors'))).toBeInTheDocument()
    expect(screen.getByText(en('recovery_results.summary_errors'))).toBeInTheDocument()
    expect(screen.queryByText(en('recovery_results.summary_ok'))).not.toBeInTheDocument()
  })

  it('hands over a report that does not call that recovery ok either', async () => {
    var { user } = setup(<OtaRecoveryResultsModal results={walkedPast()} onOpenPlugin={vi.fn()} onClose={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: en('install_error.copy') }))
    const report = await navigator.clipboard.readText()
    expect(report).toContain('- outcome: finished with errors')
    expect(report).toContain('- rfid-ntag: unreadable')
  })

  it('leaves an uninstall that passed over a plugin already gone reading as done', () => {
    var alreadyGone = { pluginId: 'spoolman', ok: true, skipped: true, reason: 'not installed', log: [] }
    setup(<OtaRecoveryResultsModal results={{ ok: true, results: [alreadyGone] }} onOpenPlugin={vi.fn()} onClose={vi.fn()} variant="uninstall" />)

    expect(screen.getByText(en('uninstall_results.title_ok'))).toBeInTheDocument()
  })
})

// The same printer walk past an unreadable plugin happens on an install or an update, which the printer
// also calls fine.
describe('OtaRecoveryResultsModal on a batch the printer calls fine with a plugin it could not read', () => {
  it('does not say the update went through', () => {
    setup(<OtaRecoveryResultsModal results={walkedPast()} onOpenPlugin={vi.fn()} onClose={vi.fn()} variant="update" />)

    expect(screen.getByText(en('update_results.title_errors'))).toBeInTheDocument()
    expect(screen.queryByText(en('update_results.summary_ok'))).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: en('install_error.copy') })).toBeInTheDocument()
  })

  it('does not say the install went through', () => {
    setup(<OtaRecoveryResultsModal results={walkedPast()} onOpenPlugin={vi.fn()} onClose={vi.fn()} variant="install" />)

    expect(screen.getByText(en('install_results.title_errors'))).toBeInTheDocument()
    expect(screen.queryByText(en('install_results.title_ok'))).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: en('install_error.copy') })).toBeInTheDocument()
  })
})
