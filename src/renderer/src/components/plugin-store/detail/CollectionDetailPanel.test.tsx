// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import { setup } from '../../../test/harness'
import { makeCollection, makePlugin } from '../../../test/fixtures'
import { CollectionDetailPanel } from './CollectionDetailPanel'

const READER = makePlugin({ id: 'rfid-ntag', name: 'rfid-ntag', title: 'RFID Reader' })
const DECODER = makePlugin({ id: 'rfid-opentag', name: 'rfid-opentag', title: 'OpenTag Decoder' })
const TRACKER = makePlugin({ id: 'spoolman', name: 'spoolman', title: 'Spoolman' })
const CATALOG = [READER, DECODER, TRACKER]

const COLLECTION = makeCollection({
  id: 'all-the-tags', name: 'all-the-tags', title: 'All the Tags', tagline: 'Every spool, identified.', channel: 'experiment',
  members: [{ id: 'rfid-ntag' }, { id: 'rfid-opentag' }, { id: 'spoolman' }],
})

function renderPanel(overrides: Partial<Parameters<typeof CollectionDetailPanel>[0]> = {}) {
  const onInstallSelected = vi.fn()
  const onOpenPlugin = vi.fn()
  function panelWith(props: Partial<Parameters<typeof CollectionDetailPanel>[0]>) {
    return (
      <CollectionDetailPanel
        collection={COLLECTION} plugins={CATALOG} collections={[]} installedIds={['rfid-ntag']} printerId="printer-1" installing={false}
        printActive={false} blockedActions={[]}
        onInstallSelected={onInstallSelected} onOpenPlugin={onOpenPlugin} onClose={vi.fn()} {...props}
      />
    )
  }
  const { user, rerender } = setup(panelWith(overrides))
  function rerenderPanel(next: Partial<Parameters<typeof CollectionDetailPanel>[0]>) {
    rerender(panelWith(next))
  }

  return { user, onInstallSelected, onOpenPlugin, rerenderPanel }
}

describe('CollectionDetailPanel', () => {
  it('marks the installed members and counts the rest for install-all', () => {
    renderPanel()
    const installedRow = screen.getByText('RFID Reader').closest('.collection-member') as HTMLElement
    expect(within(installedRow).getByText('Installed')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Install all \(2\)/ })).toBeInTheDocument()
  })

  it('install-all batches ONLY the not-yet-installed members', async () => {
    const { user, onInstallSelected } = renderPanel()
    await user.click(screen.getByRole('button', { name: /Install all \(2\)/ }))
    expect(onInstallSelected).toHaveBeenCalledTimes(1)
    const [printerId, specs] = onInstallSelected.mock.calls[0]
    expect(printerId).toBe('printer-1')
    expect(specs.map((spec: { pluginId: string }) => spec.pluginId)).toEqual(['rfid-opentag', 'spoolman'])
  })

  it('links every member so the user can view its details before installing', () => {
    renderPanel()
    expect(screen.getAllByTitle("View this plugin's details")).toHaveLength(3)
  })

  it('opening a member row hands the plugin back to the store', async () => {
    const { user, onOpenPlugin } = renderPanel()
    await user.click(screen.getByText('OpenTag Decoder'))
    expect(onOpenPlugin).toHaveBeenCalledWith(DECODER)
  })

  it('shows the all-installed state with no install button', () => {
    renderPanel({ installedIds: ['rfid-ntag', 'rfid-opentag', 'spoolman'] })
    expect(screen.getByText('All members are installed')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Install all/ })).toBeNull()
  })

  it('captures a config-needing member before installing instead of installing immediately', async () => {
    const keyed = makePlugin({ id: 'rfid-bambu', name: 'rfid-bambu', title: 'Bambu Decoder', config: [{ key: 'BAMBU_KEY', label: 'Master key', type: 'text', scope: 'global', required: true }] })
    const { user, onInstallSelected } = renderPanel({
      plugins: [...CATALOG, keyed],
      collection: makeCollection({ ...COLLECTION, members: [{ id: 'rfid-ntag' }, { id: 'rfid-bambu' }] }),
      installedIds: ['rfid-ntag'],
    })
    await user.click(screen.getByRole('button', { name: /Install all \(1\)/ }))
    expect(screen.getByText('Configure plugins')).toBeInTheDocument()
    expect(onInstallSelected).not.toHaveBeenCalled()
  })

  it('confirming the capture persists the values under the scopes flipped in the modal', async () => {
    const keyed = makePlugin({ id: 'rfid-bambu', name: 'rfid-bambu', title: 'Bambu Decoder', config: [{ key: 'BAMBU_KEY', label: 'Master key', type: 'text', scope: 'global', required: true }] })
    const onSaveVars = vi.fn()
    const { user } = renderPanel({
      plugins: [...CATALOG, keyed],
      collection: makeCollection({ ...COLLECTION, members: [{ id: 'rfid-ntag' }, { id: 'rfid-bambu' }] }),
      installedIds: ['rfid-ntag'],
      onSaveVars,
    })
    await user.click(screen.getByRole('button', { name: /Install all \(1\)/ }))
    const modal = screen.getByText('Configure plugins').closest('.batch-config-modal') as HTMLElement

    await user.type(within(modal).getByRole('textbox'), 'ffff-0000')
    await user.click(within(modal).getByRole('button', { name: 'This printer' }))
    await user.click(within(modal).getByRole('button', { name: 'Install 1' }))

    expect(onSaveVars).toHaveBeenCalledWith({
      values: { BAMBU_KEY: 'ffff-0000' },
      fields: [expect.objectContaining({ key: 'BAMBU_KEY' })],
      scopeChoices: { BAMBU_KEY: 'printer' },
    })
  })

})

// A collection install is an automation of installing its members one at a time, so every check that
// gates a single install gates the batch too, and a member the panel would refuse says so on its row.
describe('CollectionDetailPanel install gate', () => {
  it('refuses install-all while a print is running', async () => {
    const { user, onInstallSelected } = renderPanel({ printActive: true, blockedActions: ['install'] })
    expect(screen.getAllByText('Locked while a print is running.')).toHaveLength(3)
    await user.click(screen.getByRole('button', { name: /Install all/ }))
    expect(onInstallSelected).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: /Install all/ })).toBeDisabled()
  })

  it('leaves a member that conflicts with an installed plugin out of the batch', async () => {
    const rival = makePlugin({ id: 'rfid-rival', name: 'rfid-rival', title: 'Rival Reader', conflicts: ['rfid-ntag'] })
    const { user, onInstallSelected } = renderPanel({
      plugins: [...CATALOG, rival],
      collection: makeCollection({ ...COLLECTION, members: [{ id: 'rfid-ntag' }, { id: 'rfid-opentag' }, { id: 'rfid-rival' }] }),
    })
    await user.click(screen.getByRole('button', { name: /Install all \(1\)/ }))
    const [, specs] = onInstallSelected.mock.calls[0]
    expect(specs.map((spec: { pluginId: string }) => spec.pluginId)).toEqual(['rfid-opentag'])
  })

  // A collection names only plugins that exist. A member that has been depublished since is shown as
  // unavailable and skipped; the rest of the collection still installs.
  it('installs the remaining members when one has been depublished', async () => {
    const { user, onInstallSelected } = renderPanel({
      collection: makeCollection({ ...COLLECTION, members: [{ id: 'rfid-ntag' }, { id: 'rfid-opentag' }, { id: 'gone-from-the-index' }] }),
    })
    expect(screen.getByText('gone-from-the-index')).toBeInTheDocument()
    expect(screen.getByText('Not on your sources')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Install all \(1\)/ }))
    const [, specs] = onInstallSelected.mock.calls[0]
    expect(specs.map((spec: { pluginId: string }) => spec.pluginId)).toEqual(['rfid-opentag'])
  })

  it('does not ask for the config of a member the gate leaves out', async () => {
    const keyedRival = makePlugin({
      id: 'rfid-rival', name: 'rfid-rival', title: 'Rival Reader', conflicts: ['rfid-ntag'],
      config: [{ key: 'RIVAL_KEY', label: 'Master key', type: 'text', scope: 'global', required: true }],
    })
    const { user, onInstallSelected } = renderPanel({
      plugins: [...CATALOG, keyedRival],
      collection: makeCollection({ ...COLLECTION, members: [{ id: 'rfid-ntag' }, { id: 'rfid-opentag' }, { id: 'rfid-rival' }] }),
    })
    await user.click(screen.getByRole('button', { name: /Install all \(1\)/ }))

    expect(screen.queryByText('Configure plugins')).toBeNull()
    const [, specs] = onInstallSelected.mock.calls[0]
    expect(specs.map((spec: { pluginId: string }) => spec.pluginId)).toEqual(['rfid-opentag'])
  })

  // The member's own card greys it out when this printer's daemon is older than the plugin declares.
  // The collection has to reach the same answer, or "Install all" sends a member the printer refuses
  // on arrival and the user meets a failed install instead of a member he could see was not for him.
  it('leaves out a member this printer runs too old a daemon for', async () => {
    const needsNewDaemon = makePlugin({ id: 'rfid-opentag', name: 'rfid-opentag', title: 'OpenTag Decoder', minDaemonVersion: '0.11.0' })
    const { user, onInstallSelected } = renderPanel({ plugins: [READER, needsNewDaemon, TRACKER], daemonVersion: '0.10.31' })

    expect(screen.getByText('Needs daemon v0.11.0; this printer runs v0.10.31.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Install all \(1\)/ }))
    const [, specs] = onInstallSelected.mock.calls[0]
    expect(specs.map((spec: { pluginId: string }) => spec.pluginId)).toEqual(['spoolman'])
  })

  it('does not offer install when no managed printer is selected', () => {
    renderPanel({ printerId: undefined })
    expect(screen.getByText('Select a managed printer to install')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Install all/ })).toBeDisabled()
  })
})

// The collection's own id still installed as a plugin means this collection used to BE that plugin.
// Instead of "Install all" the panel offers one migration run: the retired plugin off the printer,
// the members on, and afterwards a plain-terms note that the features now come from the members.
describe('CollectionDetailPanel plugin-became-collection migration', () => {
  it('offers the migration and sends the retired plugin id with the missing members', async () => {
    const onMigrateSelected = vi.fn()
    const { user, onInstallSelected } = renderPanel({ installedIds: ['all-the-tags', 'rfid-ntag'], onMigrateSelected })
    expect(screen.queryByRole('button', { name: /Install all/ })).toBeNull()
    expect(screen.getByText('This was installed as a plugin. Updating it installs the plugins above and removes the old plugin.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Update to collection/ }))
    expect(onInstallSelected).not.toHaveBeenCalled()
    expect(onMigrateSelected).toHaveBeenCalledTimes(1)
    const [printerId, migration] = onMigrateSelected.mock.calls[0]
    const specs = migration.arrivingSpecs
    expect(printerId).toBe('printer-1')
    expect(migration.migratingPluginId).toBe('all-the-tags')
    expect(migration.comingOffThePrinter).toBe(true)
    expect(specs.map((spec: { pluginId: string }) => spec.pluginId)).toEqual(['rfid-opentag', 'spoolman'])
  })

  it('runs the migration as removal alone when every member is already installed', async () => {
    const onMigrateSelected = vi.fn()
    const { user } = renderPanel({ installedIds: ['all-the-tags', 'rfid-ntag', 'rfid-opentag', 'spoolman'], onMigrateSelected })
    await user.click(screen.getByRole('button', { name: /Update to collection/ }))
    expect(onMigrateSelected).toHaveBeenCalledWith('printer-1', { migratingPluginId: 'all-the-tags', comingOffThePrinter: true, arrivingSpecs: [] })
  })

  it('captures a config-needing member before the migration runs', async () => {
    const keyed = makePlugin({ id: 'rfid-bambu', name: 'rfid-bambu', title: 'Bambu Decoder', config: [{ key: 'BAMBU_KEY', label: 'Master key', type: 'text', scope: 'global', required: true }] })
    const onMigrateSelected = vi.fn()
    const { user } = renderPanel({
      plugins: [...CATALOG, keyed],
      collection: makeCollection({ ...COLLECTION, members: [{ id: 'rfid-ntag' }, { id: 'rfid-bambu' }] }),
      installedIds: ['all-the-tags', 'rfid-ntag'],
      onMigrateSelected,
    })
    await user.click(screen.getByRole('button', { name: /Update to collection/ }))
    expect(screen.getByText('Configure plugins')).toBeInTheDocument()
    expect(onMigrateSelected).not.toHaveBeenCalled()
    const modal = screen.getByText('Configure plugins').closest('.batch-config-modal') as HTMLElement
    await user.type(within(modal).getByRole('textbox'), 'ffff-0000')
    await user.click(within(modal).getByRole('button', { name: 'Install 1' }))
    const [, migration] = onMigrateSelected.mock.calls[0]
    const specs = migration.arrivingSpecs
    expect(migration.migratingPluginId).toBe('all-the-tags')
    expect(specs.map((spec: { pluginId: string }) => spec.pluginId)).toEqual(['rfid-bambu'])
  })

  // Removal-only migration has no member for the gate to block, so the print lock must catch it here.
  it('refuses the migration while a print is running', () => {
    const onMigrateSelected = vi.fn()
    renderPanel({ installedIds: ['all-the-tags', 'rfid-ntag', 'rfid-opentag', 'spoolman'], onMigrateSelected, printActive: true, blockedActions: ['install'] })
    expect(screen.getByRole('button', { name: /Update to collection/ })).toBeDisabled()
  })

  // A member the gate leaves out would strip its features from the printer along with the old plugin.
  it('refuses the migration when the gate would leave a member off the printer', () => {
    const rival = makePlugin({ id: 'rfid-rival', name: 'rfid-rival', title: 'Rival Reader', conflicts: ['rfid-ntag'] })
    const onMigrateSelected = vi.fn()
    renderPanel({
      plugins: [...CATALOG, rival],
      collection: makeCollection({ ...COLLECTION, members: [{ id: 'rfid-ntag' }, { id: 'rfid-opentag' }, { id: 'rfid-rival' }] }),
      installedIds: ['all-the-tags', 'rfid-ntag'],
      onMigrateSelected,
    })
    expect(screen.getByRole('button', { name: /Update to collection/ })).toBeDisabled()
  })

  it('keeps the plain install-all foot when no migration handler is wired', () => {
    renderPanel({ installedIds: ['all-the-tags', 'rfid-ntag'] })
    expect(screen.queryByRole('button', { name: /Update to collection/ })).toBeNull()
    expect(screen.getByRole('button', { name: /Install all \(2\)/ })).toBeInTheDocument()
  })

  it('swaps to the plain-terms explanation once the old plugin is gone', async () => {
    const onMigrateSelected = vi.fn()
    const { user, rerenderPanel } = renderPanel({ installedIds: ['all-the-tags', 'rfid-ntag', 'rfid-opentag', 'spoolman'], onMigrateSelected })
    await user.click(screen.getByRole('button', { name: /Update to collection/ }))
    rerenderPanel({ installedIds: ['rfid-ntag', 'rfid-opentag', 'spoolman'], onMigrateSelected })
    expect(screen.getByText('This is now a collection. The features it provided now come from the plugins listed above.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Update to collection/ })).toBeNull()
  })
})
