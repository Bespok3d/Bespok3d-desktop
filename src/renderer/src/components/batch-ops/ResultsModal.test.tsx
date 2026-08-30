// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { setup } from '../../test/harness'
import { makeT } from '../../i18n'
import { OtaRecoveryResultsModal } from './ResultsModal'

const en = makeT('en')

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
  var unreadable = { plugin: 'rfid-ntag', problem: 'manifest-unreadable', detail: 'manifest.json: Expecting value: line 1 column 1' }

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
