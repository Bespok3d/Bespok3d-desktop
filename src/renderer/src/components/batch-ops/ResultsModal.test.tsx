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
    var { user } = setup(<OtaRecoveryResultsModal results={results()} onClose={onClose} />)

    expect(screen.getByText(en('recovery_results.title_errors'))).toBeInTheDocument()
    expect(screen.getByText('spoolman')).toBeInTheDocument()
    expect(screen.getByText('fluidd')).toBeInTheDocument()
    expect(screen.getByText('rfid-ntag')).toBeInTheDocument()
    expect(screen.getByText('failed to symlink config')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: en('btn.close') }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('uses the update-variant copy when updating', () => {
    setup(<OtaRecoveryResultsModal results={results()} onClose={vi.fn()} variant="update" />)
    expect(screen.getByText(en('update_results.title_errors'))).toBeInTheDocument()
  })

  it('uses the install-variant copy when batch-installing', () => {
    setup(<OtaRecoveryResultsModal results={results()} onClose={vi.fn()} variant="install" />)
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
    var { user, container } = setup(<OtaRecoveryResultsModal results={autoDeactivatedResults} onClose={vi.fn()} />)

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
    setup(<OtaRecoveryResultsModal results={brokerResults} onClose={vi.fn()} />)
    expect(screen.getByText(en('diagnosis.broker_down'))).toBeInTheDocument()
    expect(screen.queryByText('broker-down')).not.toBeInTheDocument()
  })
})
