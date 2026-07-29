// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen } from '@testing-library/react'
import { setup } from '../../../../test/harness'
import { makeT } from '../../../../i18n'
import { makePrinter, makeAdapterInfo } from '../../../../test/fixtures'
import { PrintersPane } from './index'
import { PrinterActionsContext } from '../../printer-actions'
import { printerPrimaryAction } from './printer-row'

const en = makeT('en')

afterEach(() => localStorage.removeItem('b3d.confirm.deactivate'))

function handlers() {
  return {
    onAddPrinter: vi.fn(), onRemovePrinter: vi.fn(), onUpdatePrinterIcon: vi.fn(),
    onEnrollPrinter: vi.fn(), onRepairPrinter: vi.fn(), onRecoverPrinter: vi.fn(), onReinstallPlugins: vi.fn(),
    onViewEnrollmentLog: vi.fn(), onUpdateDaemon: vi.fn(), onUpdateJinni: vi.fn(),
    onDeactivatePrinter: vi.fn(), onReactivatePrinter: vi.fn(), onUninstallPrinter: vi.fn(),
    onSetCustomSshCredentials: vi.fn(),
  }
}

function renderPane(printer: ReturnType<typeof makePrinter>, fns: ReturnType<typeof handlers>) {
  return setup(
    <PrinterActionsContext.Provider value={fns}>
      <PrintersPane printers={[printer]} adapters={[makeAdapterInfo()]} />
    </PrinterActionsContext.Provider>,
  )
}

const enrolled = { enrollmentLog: { enrolledAt: '2026-01-01', adapterId: 'snapmaker-u1', steps: [] } }

function lastDeactivateButton(): HTMLElement {
  var matches = screen.getAllByRole('button', { name: en('printers.deactivate') })

  return matches[matches.length - 1]
}

function lastRemoveButton(): HTMLElement {
  var matches = screen.getAllByRole('button', { name: en('printers.remove') })

  return matches[matches.length - 1]
}

describe('PrintersPane lifecycle actions', () => {
  it('enrolls an online printer that was never enrolled', async () => {
    var fns = handlers()
    var { user } = renderPane(makePrinter({ status: 'online' }), fns)
    await user.click(screen.getByRole('button', { name: en('printers.enroll') }))
    expect(fns.onEnrollPrinter).toHaveBeenCalledWith('printer-1')
  })

  it('repairs, not re-enrolls, an already-enrolled printer whose daemon is unreachable', async () => {
    var fns = handlers()
    var { user } = renderPane(makePrinter({ status: 'online', ...enrolled }), fns)
    expect(screen.queryByRole('button', { name: en('printers.enroll') })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: en('printers.repair') }))
    expect(fns.onRepairPrinter).toHaveBeenCalledWith('printer-1')
    expect(fns.onEnrollPrinter).not.toHaveBeenCalled()
  })

  it('reactivates a deactivated printer', async () => {
    var fns = handlers()
    var { user } = renderPane(makePrinter({ status: 'deactivated' }), fns)
    await user.click(screen.getByRole('button', { name: en('printers.reactivate') }))
    expect(fns.onReactivatePrinter).toHaveBeenCalledWith('printer-1')
  })

  it('confirms before deactivating a managed printer', async () => {
    var fns = handlers()
    var { user } = renderPane(makePrinter({ status: 'managed', daemonVersion: '0.10.31-dev', ...enrolled }), fns)
    await user.click(screen.getByRole('button', { name: en('printers.deactivate') }))

    expect(await screen.findByText(en('printers.deactivate_summary'))).toBeInTheDocument()
    expect(fns.onDeactivatePrinter).not.toHaveBeenCalled()

    await user.click(lastDeactivateButton())
    expect(fns.onDeactivatePrinter).toHaveBeenCalledWith('printer-1')
  })

  it('updates the daemon from the Deploy menu and toggles the custom-SSH preference', async () => {
    var fns = handlers()
    var { user } = renderPane(makePrinter({ status: 'managed', daemonVersion: '0.10.31-dev', ...enrolled }), fns)
    await user.click(screen.getByRole('button', { name: en('printers.deploy') }))
    await user.click(screen.getByRole('button', { name: en('printers.update_daemon') }))
    expect(fns.onUpdateDaemon).toHaveBeenCalledWith('printer-1')

    await user.click(screen.getByRole('switch'))
    expect(fns.onSetCustomSshCredentials).toHaveBeenCalledWith('printer-1', true)
  })

  it('updates the device-side adapter (jinni) from the Deploy menu', async () => {
    var fns = handlers()
    var { user } = renderPane(makePrinter({ status: 'managed', daemonVersion: '0.10.31-dev', ...enrolled }), fns)
    await user.click(screen.getByRole('button', { name: en('printers.deploy') }))
    await user.click(screen.getByRole('button', { name: en('printers.update_jinni') }))
    expect(fns.onUpdateJinni).toHaveBeenCalledWith('printer-1')
  })
})

describe('PrintersPane remove flow', () => {
  it('removes the printer from Bespok3d only when teardown is left off', async () => {
    var fns = handlers()
    var { user } = renderPane(makePrinter({ status: 'managed', daemonVersion: '0.10.31-dev', ...enrolled }), fns)
    await user.click(screen.getByRole('button', { name: en('printers.remove') }))

    expect(await screen.findByText(en('printers.remove_summary'))).toBeInTheDocument()
    await user.click(lastRemoveButton())
    expect(fns.onRemovePrinter).toHaveBeenCalledWith('printer-1')
    expect(fns.onUninstallPrinter).not.toHaveBeenCalled()
  })

  it('tears Bespok3d down on the printer when the opt-in toggle is on', async () => {
    var fns = handlers()
    var { user } = renderPane(makePrinter({ status: 'managed', daemonVersion: '0.10.31-dev', ...enrolled }), fns)
    await user.click(screen.getByRole('button', { name: en('printers.remove') }))
    await user.click(screen.getByRole('switch', { name: en('printers.remove_also_teardown') }))
    await user.click(lastRemoveButton())
    expect(fns.onUninstallPrinter).toHaveBeenCalledWith('printer-1')
    expect(fns.onRemovePrinter).not.toHaveBeenCalled()
  })
})

describe('PrintersPane Force menu', () => {
  it('recalls each setup flow on demand for an enrolled printer', async () => {
    var fns = handlers()
    var { user } = renderPane(makePrinter({ status: 'managed', daemonVersion: '0.10.31-dev', ...enrolled }), fns)

    await user.click(screen.getByRole('button', { name: new RegExp(en('printers.force')) }))
    await user.click(screen.getByRole('button', { name: en('printers.force_recover') }))
    expect(fns.onRecoverPrinter).toHaveBeenCalledWith('printer-1')

    await user.click(screen.getByRole('button', { name: new RegExp(en('printers.force')) }))
    await user.click(screen.getByRole('button', { name: en('printers.force_reinstall') }))
    expect(fns.onReinstallPlugins).toHaveBeenCalledWith('printer-1')
  })

  it('hides the Force menu for a printer that was never enrolled', () => {
    var fns = handlers()
    renderPane(makePrinter({ status: 'online' }), fns)
    expect(screen.queryByRole('button', { name: new RegExp(en('printers.force')) })).not.toBeInTheDocument()
  })

  it('hides the Force menu for an offline printer (its SSH flows cannot reach it)', () => {
    var fns = handlers()
    renderPane(makePrinter({ status: 'offline', ...enrolled }), fns)
    expect(screen.queryByRole('button', { name: new RegExp(en('printers.force')) })).not.toBeInTheDocument()
  })
})

describe('PrinterRow presentation', () => {
  it('offers a one-click daemon update on a managed row when the daemon lags', async () => {
    var fns = handlers()
    var { user } = renderPane(makePrinter({ status: 'managed', jinniVersion: '0.1.6', daemonUpdateAvailable: true, ...enrolled }), fns)
    await user.click(screen.getByRole('button', { name: /Update daemon to/ }))
    expect(fns.onUpdateDaemon).toHaveBeenCalledWith('printer-1')
  })

  it('offers a one-click adapter (jinni) update on a managed row when the jinni lags', async () => {
    var fns = handlers()
    var { user } = renderPane(makePrinter({ status: 'managed', jinniVersion: '0.1.5', ...enrolled }), fns)
    await user.click(screen.getByRole('button', { name: /Update adapter to 0\.1\.6/ }))
    expect(fns.onUpdateJinni).toHaveBeenCalledWith('printer-1')
  })

  it('shows no update callout when the daemon and adapter are current', () => {
    renderPane(makePrinter({ status: 'managed', jinniVersion: '0.1.6', ...enrolled }), handlers())
    expect(screen.queryByRole('button', { name: /Update daemon to|Update adapter to/ })).not.toBeInTheDocument()
  })

  it('fills a deactivated row with a prominent Deactivated banner', () => {
    renderPane(makePrinter({ status: 'deactivated', ...enrolled }), handlers())
    expect(screen.getByText(en('printers.deactivated_hint'))).toBeInTheDocument()
  })

  it('shows no Deactivated banner on a managed row', () => {
    renderPane(makePrinter({ status: 'managed', ...enrolled }), handlers())
    expect(screen.queryByText(en('printers.deactivated_hint'))).not.toBeInTheDocument()
  })

  it('marks the enroll call-to-action so it draws the eye', () => {
    renderPane(makePrinter({ status: 'online' }), handlers())
    expect(screen.getByRole('button', { name: en('printers.enroll') }).className).toContain('enroll-cta')
  })
})

describe('printerPrimaryAction', () => {
  it('offers enroll only for an online printer never enrolled', () => {
    expect(printerPrimaryAction(makePrinter({ status: 'online' }))).toBe('enroll')
  })

  it('offers repair for an enrolled online printer (daemon unreachable)', () => {
    expect(printerPrimaryAction(makePrinter({ status: 'online', ...enrolled }))).toBe('repair')
  })

  it('manages a managed printer and reactivates a deactivated one', () => {
    expect(printerPrimaryAction(makePrinter({ status: 'managed' }))).toBe('manage')
    expect(printerPrimaryAction(makePrinter({ status: 'deactivated' }))).toBe('reactivate')
  })

  it('offers nothing while checking or fully offline', () => {
    expect(printerPrimaryAction(makePrinter({ status: 'checking', ...enrolled }))).toBe('none')
    expect(printerPrimaryAction(makePrinter({ status: 'offline', ...enrolled }))).toBe('none')
  })
})
