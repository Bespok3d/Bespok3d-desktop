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
  const { user } = setup(
    <CollectionDetailPanel
      collection={COLLECTION} plugins={CATALOG} installedIds={['rfid-ntag']} printerId="printer-1" installing={false}
      printActive={false} blockedActions={[]}
      onInstallSelected={onInstallSelected} onOpenPlugin={onOpenPlugin} onClose={vi.fn()} {...overrides}
    />,
  )

  return { user, onInstallSelected, onOpenPlugin }
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

  it('does not offer install when no managed printer is selected', () => {
    renderPanel({ printerId: undefined })
    expect(screen.getByText('Select a managed printer to install')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Install all/ })).toBeDisabled()
  })
})
