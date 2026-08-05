// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { setup } from '../test/harness'
import { makeT } from '../i18n'
import { makePrinter } from '../test/fixtures'
import { PrinterBanners } from './printer-banners'

const en = makeT('en')

interface BannerHandlers {
  onRepair: ReturnType<typeof vi.fn>
  onRecover: ReturnType<typeof vi.fn>
  onReactivate: ReturnType<typeof vi.fn>
  onRecoverDrift: ReturnType<typeof vi.fn>
  onUpdateJinni: ReturnType<typeof vi.fn>
  onReboot: ReturnType<typeof vi.fn>
}

function makeHandlers(): BannerHandlers {
  return { onRepair: vi.fn(), onRecover: vi.fn(), onReactivate: vi.fn(), onRecoverDrift: vi.fn(), onUpdateJinni: vi.fn(), onReboot: vi.fn() }
}

function renderBanners(printer: ReturnType<typeof makePrinter> | null, handlers: BannerHandlers, bundledJinniVersion?: string) {
  return setup(<PrinterBanners selectedPrinter={printer} bundledJinniVersion={bundledJinniVersion} {...handlers} />)
}

const enrolled = { enrollmentLog: { enrolledAt: '2026-01-01', adapterId: 'snapmaker-u1', steps: [] } }

describe('PrinterBanners render + action wiring', () => {
  it('shows the repair banner for an enrolled, SSH-reachable printer and repairs on click', async () => {
    var handlers = makeHandlers()
    var printer = makePrinter({ status: 'online', connection: { reach: 'recoverable', sshOpen: true }, ...enrolled })
    var { user } = renderBanners(printer, handlers)
    await user.click(screen.getByRole('button', { name: en('banner.repair_action') }))
    expect(handlers.onRepair).toHaveBeenCalledWith('printer-1')
  })

  it('shows the recover banner (not repair) once the probe finds the write layer reset, and recovers on click', async () => {
    var handlers = makeHandlers()
    var printer = makePrinter({ status: 'online', connection: { reach: 'recoverable', sshOpen: true }, writeLayerIntact: false, ...enrolled })
    var { user } = renderBanners(printer, handlers)
    expect(screen.queryByRole('button', { name: en('banner.repair_action') })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: en('banner.recover_action') }))
    expect(handlers.onRecover).toHaveBeenCalledWith('printer-1')
    expect(handlers.onRepair).not.toHaveBeenCalled()
  })

  it('shows an informational enable-root banner (no action) when alive but SSH is off', () => {
    var printer = makePrinter({ status: 'online', connection: { reach: 'alive-no-ssh', sshOpen: false }, ...enrolled })
    var { container } = renderBanners(printer, makeHandlers())
    expect(screen.getByText(en('banner.root_access_body', { name: printer.nick || printer.model }))).toBeInTheDocument()
    expect(container.querySelector('button')).toBeNull()
  })

  it('shows the reactivate banner for a deactivated printer', async () => {
    var handlers = makeHandlers()
    var { user } = renderBanners(makePrinter({ status: 'deactivated' }), handlers)
    await user.click(screen.getByRole('button', { name: en('printers.reactivate') }))
    expect(handlers.onReactivate).toHaveBeenCalledWith('printer-1')
  })

  it('shows the drift banner for a managed printer with drift and recovers on click', async () => {
    var handlers = makeHandlers()
    var printer = makePrinter({ status: 'managed', daemonDrift: [{ pluginId: 'spoolman', symlinkIssueCount: 2 }] })
    var { user } = renderBanners(printer, handlers)
    await user.click(screen.getByRole('button', { name: en('banner.drift_action') }))
    expect(handlers.onRecoverDrift).toHaveBeenCalledWith('printer-1')
  })

  it('offers repair for a broken printer with no plugins left, which used to render no banner at all', async () => {
    var handlers = makeHandlers()
    var printer = makePrinter({ status: 'managed', installedIds: [], printerProblems: [{ kind: 'includes_missing', detail: 'printer.cfg', pluginId: null }] })
    var { user } = renderBanners(printer, handlers)
    await user.click(screen.getByRole('button', { name: en('banner.printer_problem_action') }))
    expect(handlers.onRecoverDrift).toHaveBeenCalledWith('printer-1')
  })

  it('shows the jinni-update banner when the deployed jinni lags the bundled one', async () => {
    var handlers = makeHandlers()
    var { user } = renderBanners(makePrinter({ status: 'managed', jinniVersion: '0.1.0' }), handlers, '0.1.1')
    await user.click(screen.getByRole('button', { name: en('banner.jinni_action') }))
    expect(handlers.onUpdateJinni).toHaveBeenCalledWith('printer-1')
  })

  it('does not show the jinni banner until the bundled version is known (derived from the adapter, not a global)', () => {
    renderBanners(makePrinter({ status: 'managed', jinniVersion: '0.1.0' }), makeHandlers())
    expect(screen.queryByRole('button', { name: en('banner.jinni_action') })).not.toBeInTheDocument()
  })

  it('does not show the jinni banner when the deployed jinni matches the bundled one', () => {
    renderBanners(makePrinter({ status: 'managed', jinniVersion: '0.1.1' }), makeHandlers(), '0.1.1')
    expect(screen.queryByRole('button', { name: en('banner.jinni_action') })).not.toBeInTheDocument()
  })

  it('does not prompt for the jinni when a daemon update is pending (it redeploys the jinni)', () => {
    var printer = makePrinter({ status: 'managed', jinniVersion: '0.1.0', daemonUpdateAvailable: true })
    renderBanners(printer, makeHandlers(), '0.1.1')
    expect(screen.queryByRole('button', { name: en('banner.jinni_action') })).not.toBeInTheDocument()
  })

  it('suppresses banners during the expected-restart window', () => {
    var printer = makePrinter({ status: 'online', connection: { reach: 'recoverable', sshOpen: true }, expectedRestartUntil: Date.now() + 100000, ...enrolled })
    var { container } = renderBanners(printer, makeHandlers())
    expect(container.querySelector('button')).toBeNull()
  })

  it('prefers drift over the jinni banner when both apply', () => {
    var printer = makePrinter({ status: 'managed', jinniVersion: '0.1.0', daemonDrift: [{ pluginId: 'spoolman', symlinkIssueCount: 1 }] })
    renderBanners(printer, makeHandlers(), '0.1.1')
    expect(screen.getByRole('button', { name: en('banner.drift_action') })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: en('banner.jinni_action') })).not.toBeInTheDocument()
  })
})

describe('PrinterBanners reboot banner', () => {
  it('shows the reboot banner for a managed printer the daemon says needs a power cycle, and reboots on click', async () => {
    var handlers = makeHandlers()
    var printer = makePrinter({ status: 'managed', rebootRequired: ['some-future-token'] })
    var { user } = renderBanners(printer, handlers)
    await user.click(screen.getByRole('button', { name: en('banner.reboot_action') }))
    expect(handlers.onReboot).toHaveBeenCalledWith('printer-1')
  })

  it('says nothing when the printer only reports its screen having gone to sleep', () => {
    var printer = makePrinter({ status: 'managed', rebootRequired: ['display-pipe-wedged'] })
    renderBanners(printer, makeHandlers())
    expect(screen.queryByRole('button', { name: en('banner.reboot_action') })).not.toBeInTheDocument()
  })

  it('falls back to the unknown reason for a token this build does not recognize, never rendering the raw token', () => {
    var printer = makePrinter({ status: 'managed', rebootRequired: ['some-future-token'] })
    renderBanners(printer, makeHandlers())
    expect(screen.getByText(en('banner.reboot_reason.unknown'), { exact: false })).toBeInTheDocument()
    expect(screen.queryByText(/some-future-token/)).not.toBeInTheDocument()
  })

  it('prefers reboot over the drift banner when both apply', () => {
    var printer = makePrinter({ status: 'managed', rebootRequired: ['some-future-token'], daemonDrift: [{ pluginId: 'spoolman', symlinkIssueCount: 1 }] })
    renderBanners(printer, makeHandlers())
    expect(screen.getByRole('button', { name: en('banner.reboot_action') })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: en('banner.drift_action') })).not.toBeInTheDocument()
  })
})
