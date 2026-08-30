// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { screen, fireEvent, act } from '@testing-library/react'
import { setup } from '../../../test/harness'
import { makeT } from '../../../i18n'
import { makePrinter, makeIndexEntry } from '../../../test/fixtures'
import { PrinterDropdown } from '.'
import type { ConnectionReach, Printer } from '../../../data/types'

const en = makeT('en')

function renderDropdown(fns: { onSelect: ReturnType<typeof vi.fn>; onAddPrinter: ReturnType<typeof vi.fn>; onOpenSettings: ReturnType<typeof vi.fn> }) {
  var printers = [
    makePrinter({ id: 'printer-1', nick: 'Alpha', status: 'managed', endpoints: [{ label: 'Fluidd', url: 'http://10.0.0.1' }] }),
    makePrinter({ id: 'printer-2', nick: 'Beta', status: 'managed' }),
  ]

  return setup(
    <PrinterDropdown printers={printers} selectedId="printer-1" adapterIcons={{}} adapterTitles={{}} onSelect={fns.onSelect} onAddPrinter={fns.onAddPrinter} onOpenSettings={fns.onOpenSettings} onUpdateDaemon={vi.fn()} onUpdateJinni={vi.fn()} onUpdateAll={vi.fn()} adapterJinniVersions={{}} savedPluginVars={{}} installingCount={0} />,
    { withCatalog: true, catalog: [] },
  )
}

describe('PrinterDropdown', () => {
  it('selects another printer and opens printer settings from the menu', async () => {
    var fns = { onSelect: vi.fn(), onAddPrinter: vi.fn(), onOpenSettings: vi.fn() }
    var { user, container } = renderDropdown(fns)

    await user.click(container.querySelector('.printer-trigger') as HTMLElement)
    await user.click(screen.getByRole('button', { name: /Beta/ }))
    expect(fns.onSelect).toHaveBeenCalledWith('printer-2')

    await user.click(container.querySelector('.printer-trigger') as HTMLElement)
    await user.click(screen.getByRole('button', { name: 'Printer settings' }))
    expect(fns.onOpenSettings).toHaveBeenCalledOnce()
  })

  it('opens an endpoint url from the flyout', async () => {
    var fns = { onSelect: vi.fn(), onAddPrinter: vi.fn(), onOpenSettings: vi.fn() }
    var { user, container, b3d } = renderDropdown(fns)

    await user.click(container.querySelector('.printer-trigger') as HTMLElement)
    fireEvent.mouseEnter(container.querySelector('.endpoints-zone') as HTMLElement)
    await user.click(screen.getByText('Fluidd'))
    expect(b3d.openUrl).toHaveBeenCalledWith('http://10.0.0.1')
  })
})

function renderStatus(selected: Printer) {
  return setup(
    <PrinterDropdown printers={[selected]} selectedId={selected.id} adapterIcons={{}} adapterTitles={{}} onSelect={vi.fn()} onAddPrinter={vi.fn()} onOpenSettings={vi.fn()} onUpdateDaemon={vi.fn()} onUpdateJinni={vi.fn()} onUpdateAll={vi.fn()} adapterJinniVersions={{}} savedPluginVars={{}} installingCount={0} />,
    { withCatalog: true, catalog: [] },
  )
}

describe('PrinterDropdown adapter name', () => {
  function renderWithTitles(printer: Printer, adapterTitles: Record<string, string>) {
    return setup(
      <PrinterDropdown printers={[printer]} selectedId={printer.id} adapterIcons={{}} adapterTitles={adapterTitles} onSelect={vi.fn()} onAddPrinter={vi.fn()} onOpenSettings={vi.fn()} onUpdateDaemon={vi.fn()} onUpdateJinni={vi.fn()} onUpdateAll={vi.fn()} adapterJinniVersions={{}} savedPluginVars={{}} installingCount={0} />,
      { withCatalog: true, catalog: [] },
    )
  }

  it('names the adapter beside the nickname, never the stored model', () => {
    var printer = makePrinter({ nick: 'Alpha', adapter: 'snapmaker-u1', model: 'Unknown' })
    var { container } = renderWithTitles(printer, { 'snapmaker-u1': 'Snapmaker U1' })

    expect(container.querySelector('.printer-name .adapter')?.textContent).toContain('Snapmaker U1')
    expect(container.textContent).not.toContain('Unknown')
  })

  it('falls back to the adapter id when this build ships no adapter by that name', () => {
    var printer = makePrinter({ nick: 'Alpha', adapter: 'some-other-printer' })
    var { container } = renderWithTitles(printer, {})

    expect(container.querySelector('.printer-name .adapter')?.textContent).toContain('some-other-printer')
  })
})

describe('PrinterDropdown adapter icon', () => {
  function renderWithIcons(printer: Printer, adapterIcons: Record<string, string>) {
    return setup(
      <PrinterDropdown printers={[printer]} selectedId={printer.id} adapterIcons={adapterIcons} adapterTitles={{}} onSelect={vi.fn()} onAddPrinter={vi.fn()} onOpenSettings={vi.fn()} onUpdateDaemon={vi.fn()} onUpdateJinni={vi.fn()} onUpdateAll={vi.fn()} adapterJinniVersions={{}} savedPluginVars={{}} installingCount={0} />,
      { withCatalog: true, catalog: [] },
    )
  }

  it('shows the adapter-declared icon as the printer avatar when the user set none', () => {
    const printer = makePrinter({ id: 'printer-1', adapter: 'snapmaker-u1', status: 'managed' })
    const { container } = renderWithIcons(printer, { 'snapmaker-u1': 'data:image/svg+xml,<svg/>' })
    const img = container.querySelector('.printer-avatar-img') as HTMLImageElement
    expect(img).toBeTruthy()
    expect(img.getAttribute('src')).toBe('data:image/svg+xml,<svg/>')
  })

  it("the user's own picture wins over the adapter icon", () => {
    const printer = makePrinter({ id: 'printer-1', adapter: 'snapmaker-u1', status: 'managed', iconImage: 'data:image/png;base64,AAAA' })
    const { container } = renderWithIcons(printer, { 'snapmaker-u1': 'data:image/svg+xml,<svg/>' })
    const img = container.querySelector('.printer-avatar-img') as HTMLImageElement
    expect(img.getAttribute('src')).toBe('data:image/png;base64,AAAA')
  })

  it('falls back to the generic glyph when no adapter icon and no picture', () => {
    const printer = makePrinter({ id: 'printer-1', adapter: 'snapmaker-u1', status: 'managed' })
    const { container } = renderWithIcons(printer, {})
    expect(container.querySelector('.printer-avatar-img')).toBeNull()
    expect(container.querySelector('.printer-avatar svg')).toBeTruthy()
  })
})

function statePrinter(status: Printer['status'], reach?: ConnectionReach): Printer {
  const connection = reach ? { reach, sshOpen: reach === 'managed' || reach === 'recoverable' } : undefined

  return makePrinter({ id: 'printer-1', nick: 'Alpha', status, connection })
}

describe('PrinterDropdown status dot (group 1: every connection condition)', () => {
  it.each([
    ['managed daemon', statePrinter('managed', 'managed'), '', 'status.dot.managed'],
    ['daemon down, SSH open (recoverable)', statePrinter('online', 'recoverable'), 'online', 'status.reach.recoverable'],
    ['alive but root access off', statePrinter('online', 'alive-no-ssh'), 'online', 'status.reach.alive-no-ssh'],
    ['online with offline reach falls back to bare status', statePrinter('online', 'offline'), 'online', 'status.dot.online'],
    ['offline', statePrinter('offline', 'offline'), 'offline', 'status.dot.offline'],
    ['checking', statePrinter('checking'), 'checking', 'status.dot.checking'],
    ['deactivated', statePrinter('deactivated'), 'offline', 'status.dot.deactivated'],
  ] as Array<[string, Printer, string, string]>)('renders the %s dot + reason', (_label, printer, dotClass, reasonKey) => {
    var { container } = renderStatus(printer)
    var dot = container.querySelector('.status-dot') as HTMLElement
    if (dotClass) expect(dot.className).toContain(dotClass)
    expect(dot.getAttribute('title')).toBe(en(reasonKey))
  })
})

interface UpdateFns {
  onUpdateDaemon: ReturnType<typeof vi.fn>
  onUpdateJinni: ReturnType<typeof vi.fn>
}

function renderRow(printer: Printer, adapterJinniVersions: Record<string, string>, fns: UpdateFns) {
  return setup(
    <PrinterDropdown printers={[printer]} selectedId={printer.id} adapterIcons={{}} adapterTitles={{}} adapterJinniVersions={adapterJinniVersions} savedPluginVars={{}} onSelect={vi.fn()} onAddPrinter={vi.fn()} onOpenSettings={vi.fn()} onUpdateDaemon={fns.onUpdateDaemon} onUpdateJinni={fns.onUpdateJinni} onUpdateAll={vi.fn()} installingCount={0} />,
    { withCatalog: true, catalog: [] },
  )
}

function openRow(printer: Printer, adapterJinniVersions: Record<string, string> = {}, fns: UpdateFns = { onUpdateDaemon: vi.fn(), onUpdateJinni: vi.fn() }) {
  var rendered = renderRow(printer, adapterJinniVersions, fns)

  return { ...rendered, fns, open: () => rendered.user.click(rendered.container.querySelector('.printer-trigger') as HTMLElement) }
}

describe('PrinterDropdown row (redesigned layout)', () => {
  it('shows the daemon and jinni versions on their own line', async () => {
    var row = openRow(makePrinter({ daemonVersion: '0.12.10-dev', jinniVersion: '0.1.6' }))
    await row.open()
    expect(screen.getByText(en('printers.daemon_version', { version: '0.12.10-dev' }))).toBeInTheDocument()
    expect(screen.getByText(en('printers.jinni_version', { version: '0.1.6' }))).toBeInTheDocument()
  })

  it('hides the extra-interfaces line for a printer on a single network', async () => {
    var row = openRow(makePrinter({ networkInterfaces: [{ ip: '10.0.0.1' }] }))
    await row.open()
    expect(row.container.querySelector('.printer-ifaces')).toBeNull()
  })

  it('lists only the non-primary interfaces (never repeating the primary ip), each labelled', async () => {
    var row = openRow(makePrinter({ ip: '192.0.2.108', networkInterfaces: [{ label: 'Wi-Fi', ip: '192.0.2.108' }, { label: 'Ethernet', ip: '10.0.0.5' }] }))
    await row.open()
    expect(row.container.querySelector('.printer-ifaces')).not.toBeNull()
    expect(screen.getByText('Ethernet 10.0.0.5')).toBeInTheDocument()
    expect(screen.queryByText('Wi-Fi 192.0.2.108')).not.toBeInTheDocument()
  })

  it('prompts a daemon update (current jinni) and runs it on click', async () => {
    var row = openRow(makePrinter({ daemonUpdateAvailable: true, jinniVersion: '0.1.6' }), { 'snapmaker-u1': '0.1.6' })
    await row.open()
    await row.user.click(screen.getByText(en('printers.update_daemon_to', { version: window.b3d.daemonExpectedVersion })))
    expect(row.fns.onUpdateDaemon).toHaveBeenCalledWith('printer-1')
    expect(row.fns.onUpdateJinni).not.toHaveBeenCalled()
  })

  it('prompts a jinni update only when the daemon is current, and runs it on click', async () => {
    var row = openRow(makePrinter({ jinniVersion: '0.1.5' }), { 'snapmaker-u1': '0.1.6' })
    await row.open()
    await row.user.click(screen.getByText(en('printers.update_jinni_to', { version: '0.1.6' })))
    expect(row.fns.onUpdateJinni).toHaveBeenCalledWith('printer-1')
    expect(row.fns.onUpdateDaemon).not.toHaveBeenCalled()
  })

  it('offers one combined callout when both lag, and updates both via the daemon update', async () => {
    var row = openRow(makePrinter({ daemonUpdateAvailable: true, jinniVersion: '0.1.5' }), { 'snapmaker-u1': '0.1.6' })
    await row.open()
    await row.user.click(screen.getByText(en('printers.update_both')))
    expect(row.fns.onUpdateDaemon).toHaveBeenCalledWith('printer-1')
    expect(row.fns.onUpdateJinni).not.toHaveBeenCalled()
  })

  it('never shows an update callout for an offline printer (cannot update)', async () => {
    var row = openRow(makePrinter({ status: 'offline', daemonUpdateAvailable: true, jinniVersion: '0.1.5' }), { 'snapmaker-u1': '0.1.6' })
    await row.open()
    expect(row.container.querySelector('.printer-update-callout')).toBeNull()
  })
})

describe('PrinterDropdown footer (update all plugins)', () => {
  it('updates every updatable plugin for the selected printer in one go', async () => {
    var onUpdateAll = vi.fn()
    var printer = makePrinter({ status: 'managed', installedIds: ['demo'], installedVersions: { demo: '1.0.0' } })
    var { user, container } = setup(
      <PrinterDropdown printers={[printer]} selectedId={printer.id} adapterIcons={{}} adapterTitles={{}} adapterJinniVersions={{}} savedPluginVars={{}} onSelect={vi.fn()} onAddPrinter={vi.fn()} onOpenSettings={vi.fn()} onUpdateDaemon={vi.fn()} onUpdateJinni={vi.fn()} onUpdateAll={onUpdateAll} installingCount={0} />,
      { withCatalog: true, catalog: [makeIndexEntry({ name: 'demo', version: '2.0.0' })] },
    )
    await user.click(container.querySelector('.printer-trigger') as HTMLElement)
    await user.click(screen.getByRole('button', { name: en('printers.update_all', { count: 1 }) }))
    expect(onUpdateAll).toHaveBeenCalledWith('printer-1', { updates: [expect.objectContaining({ pluginId: 'demo' })], migrations: [] })
  })
})

// The pending-update count feeds the trigger badge AND the footer "Update all". Both must respect the
// user's channel ceiling: a newer build published only on a riskier channel than the user chose is NOT
// an available update. The default settings ceiling is `stable`, so an experiment-only 0.2.0 must not
// count against an installed 0.1.3. Regression guard: the header hook once passed no ceiling, defaulting
// to allow-all, which counted (and offered to install) the experiment build.
function renderInstalled(catalog: ReturnType<typeof makeIndexEntry>[], onUpdateAll = vi.fn()) {
  var printer = makePrinter({ status: 'managed', installedIds: ['demo'], installedVersions: { demo: '0.1.3' } })

  return setup(
    <PrinterDropdown printers={[printer]} selectedId={printer.id} adapterIcons={{}} adapterTitles={{}} adapterJinniVersions={{}} savedPluginVars={{}} onSelect={vi.fn()} onAddPrinter={vi.fn()} onOpenSettings={vi.fn()} onUpdateDaemon={vi.fn()} onUpdateJinni={vi.fn()} onUpdateAll={onUpdateAll} installingCount={0} />,
    { withCatalog: true, catalog },
  )
}

// The header says "printing…" for the selected printer so the user sees a running print BEFORE aiming
// a batch at it. It is a statement, never a lock: the menu stays fully usable and the daemon remains
// the thing that refuses the op mid-print.
function renderPrinting(catalog: ReturnType<typeof makeIndexEntry>[] = [], onUpdateAll = vi.fn()) {
  var printer = makePrinter({ id: 'printer-1', nick: 'Alpha', status: 'managed', installedIds: ['demo'], installedVersions: { demo: '1.0.0' } })

  return setup(
    <PrinterDropdown printers={[printer]} selectedId="printer-1" adapterIcons={{}} adapterTitles={{}} adapterJinniVersions={{}} savedPluginVars={{}} onSelect={vi.fn()} onAddPrinter={vi.fn()} onOpenSettings={vi.fn()} onUpdateDaemon={vi.fn()} onUpdateJinni={vi.fn()} onUpdateAll={onUpdateAll} installingCount={0} />,
    { withCatalog: true, catalog },
  )
}

function reportPrinting(emit: ReturnType<typeof renderPrinting>['emit'], blockedActions: string[]) {
  return act(async () => { emit.printState({ printerId: 'printer-1', blockedActions, at: Date.now() }) })
}

describe('PrinterDropdown printing state', () => {
  it('says the printer is printing while the feed reports blocked actions', async () => {
    var { emit } = renderPrinting()
    await reportPrinting(emit, ['plugin_install', 'plugin_uninstall'])
    expect(screen.getByText(en('header.printing'))).toBeInTheDocument()
  })

  it('says nothing while the printer is idle', async () => {
    var { emit } = renderPrinting()
    await reportPrinting(emit, [])
    expect(screen.queryByText(en('header.printing'))).not.toBeInTheDocument()
  })

  it('states the print without blocking any menu action', async () => {
    var onUpdateAll = vi.fn()
    var { emit, user, container } = renderPrinting([makeIndexEntry({ name: 'demo', version: '2.0.0' })], onUpdateAll)
    await reportPrinting(emit, ['plugin_install'])
    await user.click(container.querySelector('.printer-trigger') as HTMLElement)
    await user.click(screen.getByRole('button', { name: en('printers.update_all', { count: 1 }) }))
    expect(onUpdateAll).toHaveBeenCalledWith('printer-1', { updates: [expect.objectContaining({ pluginId: 'demo' })], migrations: [] })
  })
})

describe('PrinterDropdown update count respects the channel ceiling', () => {
  var experimentAbove = makeIndexEntry({
    name: 'demo', version: '0.1.3', channel: 'stable',
    variants: [
      makeIndexEntry({ name: 'demo', version: '0.1.3', channel: 'stable' }),
      makeIndexEntry({ name: 'demo', version: '0.2.0', channel: 'experiment', registry_url: 'github:Bespok3d/experimental-index/index.json' }),
    ],
  })

  it('does not badge or offer an update when the only newer variant is above the stable ceiling', async () => {
    var { user, container } = renderInstalled([experimentAbove])
    // Opening the menu flushes the async catalog load (the existing footer test relies on the same
    // flush to see a within-ceiling update), so an absent badge/button here is a real 0, not un-loaded.
    await user.click(container.querySelector('.printer-trigger') as HTMLElement)
    expect(container.querySelector('.update-badge.plugin')).toBeNull()
    expect(container.querySelector('.update-all')).toBeNull()
  })

  it('still badges and offers an update when the newer variant is within the ceiling', async () => {
    var { user, container } = renderInstalled([makeIndexEntry({ name: 'demo', version: '0.2.0', channel: 'stable' })])
    await user.click(container.querySelector('.printer-trigger') as HTMLElement)
    expect(container.querySelector('.update-badge.plugin')?.textContent).toContain('1')
    expect(container.querySelector('.update-all')).not.toBeNull()
  })
})
