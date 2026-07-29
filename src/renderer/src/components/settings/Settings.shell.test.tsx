// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { setup } from '../../test/harness'
import { makeT } from '../../i18n'
import { Settings } from './index'

const en = makeT('en')

function settingsProps(onClose: ReturnType<typeof vi.fn>) {
  return {
    onClose, printers: [], onAddPrinter: vi.fn(), onRemovePrinter: vi.fn(), onUpdatePrinterIcon: vi.fn(),
    onEnrollPrinter: vi.fn(), onRepairPrinter: vi.fn(), onRecoverPrinter: vi.fn(), onReinstallPlugins: vi.fn(), onViewEnrollmentLog: vi.fn(), onUpdateDaemon: vi.fn(), onUpdateJinni: vi.fn(), onDeactivatePrinter: vi.fn(),
    onReactivatePrinter: vi.fn(), onUninstallPrinter: vi.fn(), onSetCustomSshCredentials: vi.fn(),
    theme: 'system' as const, onSetTheme: vi.fn(), density: 'comfortable' as const, onSetDensity: vi.fn(),
    storeGrouped: false, onSetStoreGrouped: vi.fn(), localePref: 'system', onSetLocale: vi.fn(),
    selectedPrinter: null, scopedPluginVars: {}, onScopedPluginVarsChange: vi.fn(),
  }
}

describe('Settings shell', () => {
  it('switches panes from the nav and closes', async () => {
    var onClose = vi.fn()
    var { user } = setup(<Settings {...settingsProps(onClose)} />, { withCatalog: true, catalog: [] })

    await user.click(screen.getByRole('button', { name: en('set.printers') }))
    expect(screen.getByText(en('printers.intro'))).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: en('btn.close') }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('filters the nav with the search box', async () => {
    var { user } = setup(<Settings {...settingsProps(vi.fn())} />, { withCatalog: true, catalog: [] })
    await user.type(screen.getByPlaceholderText(en('set.search')), 'Printers')
    expect(screen.getByRole('button', { name: en('set.printers') })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: en('set.general') })).not.toBeInTheDocument()
  })
})
