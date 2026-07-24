// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import { setup } from '../../../test/harness'
import { makeIndexEntry } from '../../../test/fixtures'
import { ScopedPluginDefaultsPane } from './ScopedPluginDefaultsPane'
import type { ScopedPluginVars } from '../../../data/plugin-vars'

const PRINTER_UUID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const LOCAL_KEY = `local:${PRINTER_UUID}`
const WORKSHOP_PRINTER = { id: 'printer-1', nick: 'Workshop U1', printerUuid: PRINTER_UUID, installedVersions: { spoolman: '9.9.9' } }
const OFFICE_UUID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
const OFFICE_PRINTER = { id: 'printer-2', nick: 'Office U1', printerUuid: OFFICE_UUID, installedVersions: { spoolman: '9.9.9' } }

type PaneProps = Parameters<typeof ScopedPluginDefaultsPane>[0]
type PrinterFixture = PaneProps['printers'][number]

// Spoolman carries one shared and one printer-hinted field so the view division has both kinds;
// Fluidd's port is shared until a printer takes its own value.
function defaultsCatalog() {
  return [
    makeIndexEntry({
      name: 'spoolman', title: 'Spoolman',
      config: [
        { key: 'SPOOLMAN_SERVER', label: 'Server URL', type: 'text', userEditable: true, placeholder: 'http://host:7912' },
        { key: 'SPOOLMAN_LOCATION', label: 'Location', type: 'text', userEditable: true, scope: 'printer', placeholder: 'Shelf or bin' },
      ],
    }),
    makeIndexEntry({
      name: 'fluidd', title: 'Fluidd',
      config: [{ key: 'FLUIDD_PORT', label: 'Web UI port', type: 'http-port', userEditable: true }],
    }),
  ]
}

function setupPane(scopedVars: ScopedPluginVars, paneProps: Partial<Omit<PaneProps, 'scopedVars' | 'onScopedVarsChange'>> = {}) {
  var onScopedVarsChange = vi.fn()
  var rendered = setup(
    <ScopedPluginDefaultsPane
      printers={[WORKSHOP_PRINTER, OFFICE_PRINTER]}
      selectedPrinter={WORKSHOP_PRINTER}
      scopedVars={scopedVars}
      onScopedVarsChange={onScopedVarsChange}
      {...paneProps}
    />,
    { withCatalog: true, catalog: defaultsCatalog() },
  )

  return { onScopedVarsChange, ...rendered }
}

// The group-head view switch and the per-row scope switches share the "All printers" label, so
// view flips are addressed through the head explicitly.
function viewSwitchButton(container: HTMLElement, label: string) {
  return within(container.querySelector('.set-group-head') as HTMLElement).getByRole('button', { name: label })
}

describe('ScopedPluginDefaultsPane value editing', () => {
  it('edits the shared global slice from the All printers view', async () => {
    var { user, onScopedVarsChange } = setupPane({})
    await user.type(await screen.findByPlaceholderText('http://host:7912'), 'h')
    expect(onScopedVarsChange).toHaveBeenCalledWith({ SPOOLMAN_SERVER: { global: 'h' } })
  })

  it('switches views from the segmented control in the group head', async () => {
    var { user } = setupPane({ SPOOLMAN_LOCATION: { global: 'Shelf A' } })
    await user.click(await screen.findByRole('button', { name: 'Per printer' }))
    expect(screen.getByText('Set for this printer')).toBeInTheDocument()
  })

  it('takes an override seeded from the shared value', async () => {
    var { user, onScopedVarsChange } = setupPane({ SPOOLMAN_LOCATION: { global: 'Shelf A' } }, { initialView: 'printer' })
    await user.click(await screen.findByRole('button', { name: 'Set for this printer' }))
    expect(onScopedVarsChange).toHaveBeenCalledWith({ SPOOLMAN_LOCATION: { global: 'Shelf A', [LOCAL_KEY]: 'Shelf A' } })
  })

  it('edits an existing override in place', async () => {
    var { user, onScopedVarsChange } = setupPane(
      { SPOOLMAN_LOCATION: { global: 'Shelf A', [LOCAL_KEY]: 'Bin 7' } },
      { initialView: 'printer' },
    )
    await user.type(await screen.findByDisplayValue('Bin 7'), 'x')
    expect(onScopedVarsChange).toHaveBeenCalledWith({ SPOOLMAN_LOCATION: { global: 'Shelf A', [LOCAL_KEY]: 'Bin 7x' } })
  })

  it('clears an override back to the shared value by deleting the entry', async () => {
    var { user, onScopedVarsChange } = setupPane(
      { SPOOLMAN_LOCATION: { global: 'Shelf A', [LOCAL_KEY]: 'Bin 7' } },
      { initialView: 'printer' },
    )
    await user.click(await screen.findByRole('button', { name: 'Use shared value' }))
    expect(onScopedVarsChange).toHaveBeenCalledWith({ SPOOLMAN_LOCATION: { global: 'Shelf A' } })
  })

  it('edits the HEADER-SELECTED printer, not the first known one (one selection facility)', async () => {
    var { user, onScopedVarsChange } = setupPane(
      { SPOOLMAN_LOCATION: { global: 'Shelf A' } },
      { initialView: 'printer', selectedPrinter: OFFICE_PRINTER },
    )
    expect(await screen.findByText('Office U1')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Set for this printer' }))
    expect(onScopedVarsChange).toHaveBeenCalledWith({
      SPOOLMAN_LOCATION: { global: 'Shelf A', [`local:${OFFICE_UUID}`]: 'Shelf A' },
    })
  })

  it('follows a header selection change live', async () => {
    var scopedVars: ScopedPluginVars = { SPOOLMAN_LOCATION: { global: 'Shelf A', [LOCAL_KEY]: 'Bin 7' } }
    var { rerender } = setupPane(scopedVars, { initialView: 'printer' })
    expect(await screen.findByText(/This printer's own value\./)).toBeInTheDocument()

    rerender(
      <ScopedPluginDefaultsPane
        printers={[WORKSHOP_PRINTER, OFFICE_PRINTER]}
        selectedPrinter={OFFICE_PRINTER} scopedVars={scopedVars}
        onScopedVarsChange={vi.fn()} initialView="printer"
      />,
    )
    expect(screen.getByText('Office U1')).toBeInTheDocument()
    expect(screen.getByText(/Using the shared value\./)).toBeInTheDocument()
  })

  it('shows the empty state when no printer is selected', () => {
    setupPane({}, { initialView: 'printer', selectedPrinter: null })
    expect(screen.getByText('No printers yet. Add a printer to manage its own values.')).toBeInTheDocument()
  })
})

describe('ScopedPluginDefaultsPane view division and installed filter', () => {
  it('keeps a printer-hinted field out of the All printers view (no mixed scope)', async () => {
    var { user } = setupPane({}, { initialFilter: 'all' })
    expect(await screen.findByText('Server URL')).toBeInTheDocument()
    expect(screen.queryByText('Location')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Per printer' }))
    expect(screen.getByText('Location')).toBeInTheDocument()
    expect(screen.queryByText('Server URL')).not.toBeInTheDocument()
  })

  it("divides by the whole fleet: one printer's own value moves a shared field to Per printer for everyone", async () => {
    var { user, container } = setupPane(
      { FLUIDD_PORT: { global: '80', [`local:${OFFICE_UUID}`]: '81' } },
      { initialView: 'printer', initialFilter: 'all' },
    )
    expect(await screen.findByText('Web UI port')).toBeInTheDocument()
    await user.click(viewSwitchButton(container, 'All printers'))
    expect(screen.queryByText('Web UI port')).not.toBeInTheDocument()
  })

  it('defaults to installed-only, unioned across the fleet in the All printers view', async () => {
    var fluiddOnlyPrinter: PrinterFixture = { id: 'printer-3', nick: 'Attic U1', printerUuid: undefined, installedVersions: { fluidd: '9.9.9' } }
    setupPane({}, { printers: [WORKSHOP_PRINTER, fluiddOnlyPrinter] })
    expect(await screen.findByText('Server URL')).toBeInTheDocument()
    expect(screen.getByText('Web UI port')).toBeInTheDocument()
  })

  it('narrows the installed filter to the selected printer in the Per printer view', async () => {
    var fluiddOnlyPrinter: PrinterFixture = { id: 'printer-3', nick: 'Attic U1', printerUuid: undefined, installedVersions: { fluidd: '9.9.9' } }
    setupPane({}, { initialView: 'printer', printers: [WORKSHOP_PRINTER, fluiddOnlyPrinter], selectedPrinter: fluiddOnlyPrinter })
    expect(await screen.findByText(/No per-printer fields yet/)).toBeInTheDocument()
    expect(screen.queryByText('Location')).not.toBeInTheDocument()
  })

  it('shows the whole catalog on the All plugins position', async () => {
    var { user } = setupPane({})
    expect(await screen.findByText('Server URL')).toBeInTheDocument()
    expect(screen.queryByText('Web UI port')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'All plugins' }))
    expect(screen.getByText('Web UI port')).toBeInTheDocument()
  })

  it('tells the user when no installed plugin has editable settings', async () => {
    var barePrinter: PrinterFixture = { id: 'printer-4', nick: 'Bare U1', printerUuid: undefined }
    setupPane({}, { printers: [barePrinter], selectedPrinter: barePrinter })
    expect(await screen.findByText('No installed plugin has editable settings. Switch to All plugins to browse every default.')).toBeInTheDocument()
  })
})

describe('ScopedPluginDefaultsPane organization and search', () => {
  it('sections rows under their plugin by default and flattens on demand', async () => {
    var { user } = setupPane({}, { initialFilter: 'all' })
    expect(await screen.findByText('Spoolman')).toBeInTheDocument()
    expect(screen.getByText('Server URL')).toBeInTheDocument()
    expect(screen.queryByText('Spoolman: Server URL')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Flat list' }))
    expect(screen.getByText('Spoolman: Server URL')).toBeInTheDocument()
    expect(screen.queryByText('Spoolman')).not.toBeInTheDocument()
  })

  it('narrows rows as the search query types, over plugin title and field label', async () => {
    var { user } = setupPane({}, { initialFilter: 'all' })
    await user.type(await screen.findByPlaceholderText('Search plugin or field'), 'web ui')
    expect(screen.getByText('Web UI port')).toBeInTheDocument()
    expect(screen.queryByText('Server URL')).not.toBeInTheDocument()
  })

  it('shows an explicit empty state when the search matches nothing', async () => {
    var { user } = setupPane({}, { initialFilter: 'all' })
    await user.type(await screen.findByPlaceholderText('Search plugin or field'), 'heated chamber')
    expect(screen.getByText('No fields match your search.')).toBeInTheDocument()
  })
})

describe('ScopedPluginDefaultsPane per-variable scope switch', () => {
  it('flips a shared variable to per-printer, seeding the selected printer from the shared value', async () => {
    var { user, onScopedVarsChange } = setupPane({ SPOOLMAN_SERVER: { global: 'http://spoolman.example:7912' } })
    await user.click(await screen.findByRole('button', { name: 'This printer' }))
    expect(onScopedVarsChange).toHaveBeenCalledWith({
      SPOOLMAN_SERVER: { global: 'http://spoolman.example:7912', [LOCAL_KEY]: 'http://spoolman.example:7912' },
    })
  })

  it('disables the per-printer flip and says why when no printer is selected', async () => {
    var { onScopedVarsChange } = setupPane({}, { selectedPrinter: null, initialFilter: 'all' })
    const serverRow = (await screen.findByText('Server URL')).closest('.set-row') as HTMLElement
    expect(within(serverRow).getByRole('button', { name: 'This printer' })).toBeDisabled()
    expect(within(serverRow).getByText(/Select a printer to set a per-printer value\./)).toBeInTheDocument()
    expect(onScopedVarsChange).not.toHaveBeenCalled()
  })

  it('flips a taken variable back to shared for EVERY printer at once', async () => {
    var { user, onScopedVarsChange } = setupPane(
      { FLUIDD_PORT: { global: '80', [LOCAL_KEY]: '81', [`local:${OFFICE_UUID}`]: '82' } },
      { initialView: 'printer', initialFilter: 'all' },
    )
    const portRow = (await screen.findByText('Web UI port')).closest('.set-row') as HTMLElement
    await user.click(within(portRow).getByRole('button', { name: 'All printers' }))
    expect(onScopedVarsChange).toHaveBeenCalledWith({ FLUIDD_PORT: { global: '80' } })
  })

  it('locks a manifest-hinted field per-printer and explains the lock', async () => {
    setupPane({}, { initialView: 'printer' })
    const locationRow = (await screen.findByText('Location')).closest('.set-row') as HTMLElement
    expect(within(locationRow).getByRole('button', { name: 'All printers' })).toBeDisabled()
    expect(within(locationRow).getByText(/This plugin sets this field per printer\./)).toBeInTheDocument()
  })
})
