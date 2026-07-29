// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import { setup } from '../../test/harness'
import { makeT } from '../../i18n'
import { makeIndexEntry, makePrinter, makeCapabilities } from '../../test/fixtures'
import type { IndexEntry } from '../../data/types'
import { PluginStore } from '.'

const en = makeT('en')

function managedStore(
  handlers: { onInstallSelected?: ReturnType<typeof vi.fn>; onUninstallSelected?: ReturnType<typeof vi.fn>; onSaveVars?: ReturnType<typeof vi.fn> },
  catalog: IndexEntry[],
  installed: Record<string, string> = {},
) {
  return setup(
    <PluginStore printer={makePrinter({ status: 'managed' })} grouped={false} onInstallSelected={handlers.onInstallSelected ?? vi.fn()} onUninstallSelected={handlers.onUninstallSelected ?? vi.fn()} onSaveVars={handlers.onSaveVars} />,
    { withCatalog: true, catalog, b3d: { store: { capabilities: vi.fn().mockResolvedValue(makeCapabilities(installed)) } } },
  )
}

describe('PluginStore multi-select install', () => {
  it('selects an installable plugin and dispatches one batch install spec', async () => {
    const onInstallSelected = vi.fn()
    const { user } = managedStore({ onInstallSelected }, [makeIndexEntry({ name: 'demo-a', title: 'Alpha', version: '1.0.0' })])

    await user.click(await screen.findByRole('button', { name: en('store.select') }))
    await user.click(screen.getByText(en('store.select_install')))
    await user.click(screen.getByText('Alpha'))
    await user.click(screen.getByRole('button', { name: en('store.install_selected', { count: 1 }) }))

    expect(onInstallSelected).toHaveBeenCalledWith('printer-1', [expect.objectContaining({ pluginId: 'demo-a' })])
  })

  it('captures a required config value before installing', async () => {
    const onInstallSelected = vi.fn()
    const onSaveVars = vi.fn()
    const { user } = managedStore({ onInstallSelected, onSaveVars }, [
      makeIndexEntry({ name: 'spoolman', title: 'Spoolman', version: '1.0.0', config: [{ key: 'SPOOLMAN_SERVER', label: 'Server', type: 'text', required: true }] }),
    ])

    await user.click(await screen.findByRole('button', { name: en('store.select') }))
    await user.click(screen.getByText(en('store.select_install')))
    await user.click(screen.getByText('Spoolman'))
    await user.click(screen.getByRole('button', { name: en('store.install_selected', { count: 1 }) }))

    expect(onInstallSelected).not.toHaveBeenCalled()
    const modal = screen.getByText(en('batch_config.title')).closest('.batch-config-modal') as HTMLElement

    await user.type(within(modal).getByRole('textbox'), 'printer.local')
    // The capture screen carries the per-field scope control, hint-preset (this legacy wire field
    // reaches the flow stamped 'global' by entryToPlugin); flip this one to This printer.
    await user.click(within(modal).getByRole('button', { name: en('store.scope_this_printer') }))
    await user.click(within(modal).getByRole('button', { name: en('batch_config.install', { count: 1 }) }))

    expect(onInstallSelected).toHaveBeenCalledWith('printer-1', [
      expect.objectContaining({ pluginId: 'spoolman', vars: { SPOOLMAN_SERVER: 'printer.local' } }),
    ])
    // The captured values persist scope-aware: field defs ride along and the modal's explicit
    // choices reach the save, so the value lands in the scope the user picked.
    expect(onSaveVars).toHaveBeenCalledWith({
      values: { SPOOLMAN_SERVER: 'printer.local' },
      fields: [expect.objectContaining({ key: 'SPOOLMAN_SERVER', scope: 'global' })],
      scopeChoices: { SPOOLMAN_SERVER: 'printer' },
    })
  })

  it('offers no select mode for a printer that is not managed', async () => {
    setup(
      <PluginStore printer={makePrinter({ status: 'online' })} grouped={false} onInstallSelected={vi.fn()} />,
      { withCatalog: true, catalog: [makeIndexEntry({ name: 'demo-a', title: 'Alpha' })] },
    )
    await screen.findByText('Alpha')
    expect(screen.queryByRole('button', { name: en('store.select') })).not.toBeInTheDocument()
  })
})

type UserEvent = ReturnType<typeof setup>['user']

// Open the select menu, choose uninstall-select, and pick one installed card by its title.
async function pickToUninstall(user: UserEvent, cardTitle: string) {
  await user.click(await screen.findByRole('button', { name: en('store.select') }))
  await user.click(await screen.findByText(en('store.select_uninstall')))
  await user.click(screen.getByText(cardTitle))
  await user.click(screen.getByRole('button', { name: en('store.uninstall_selected', { count: 1 }) }))
}

describe('PluginStore multi-select uninstall', () => {
  it('selects an installed plugin and dispatches one batch uninstall', async () => {
    const onUninstallSelected = vi.fn()
    const { user } = managedStore(
      { onUninstallSelected },
      [makeIndexEntry({ name: 'demo-a', title: 'Alpha', version: '1.0.0' })],
      { 'demo-a': '1.0.0' },
    )

    await pickToUninstall(user, 'Alpha')

    expect(onUninstallSelected).toHaveBeenCalledWith('printer-1', ['demo-a'], false)
  })

  it('confirms a cascade when a pick still has an installed dependent, then removes with cascade', async () => {
    const onUninstallSelected = vi.fn()
    const { user } = managedStore(
      { onUninstallSelected },
      [
        makeIndexEntry({ name: 'rfid', title: 'Rfid', version: '1.0.0' }),
        makeIndexEntry({ name: 'spoolman', title: 'Spoolman', version: '1.0.0', deps: ['rfid'] }),
      ],
      { rfid: '1.0.0', spoolman: '1.0.0' },
    )

    await pickToUninstall(user, 'Rfid')

    expect(onUninstallSelected).not.toHaveBeenCalled()
    await user.click(await screen.findByRole('button', { name: en('store.uninstall_cascade.confirm') }))

    expect(onUninstallSelected).toHaveBeenCalledWith('printer-1', ['rfid'], true)
  })
})
