// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { screen, act, waitFor, within } from '@testing-library/react'
import { setup } from '../../../test/harness'
import { makeT } from '../../../i18n'
import { makePlugin, makeIndexEntry, makeInstallLog } from '../../../test/fixtures'
import { PluginPanel } from '.'

const en = makeT('en')
const OFFICIAL_URL = 'github:Bespok3d/main-index/index.json'

interface Deferred<Value> {
  promise: Promise<Value>
  resolve: (value: Value) => void
}

function deferred<Value>(): Deferred<Value> {
  var resolveFn!: (value: Value) => void
  var promise = new Promise<Value>(function capture(res) { resolveFn = res })

  return { promise, resolve: resolveFn }
}

function targetWithDep() {
  return makePlugin({ id: 'demo', name: 'demo', deps: ['rfid-ntag'], description: 'A demo plugin' })
}

describe('PluginPanel install wiring', () => {
  it('installs with the resolved missing deps, streams progress, and reports completion', async () => {
    var pending = deferred<{ installedIds: string[]; log: InstallLog }>()
    var install = vi.fn(() => pending.promise)
    var onOperationDone = vi.fn()
    var { user, emit, b3d } = setup(
      <PluginPanel
        plugin={targetWithDep()}
        installed={false}
        hasUpdate={false}
        printerId="printer-1"
        allInstalledIds={[]}
        onClose={vi.fn()}
        onOperationDone={onOperationDone}
      />,
      { withCatalog: true, catalog: [makeIndexEntry({ name: 'demo', deps: ['rfid-ntag'] })], b3d: { store: { install } } },
    )

    await screen.findByText(en('store.deps_autoinstall', { deps: 'rfid-ntag' }))
    await user.click(screen.getByRole('button', { name: en('btn.install') }))

    expect(install).toHaveBeenCalledWith('printer-1', 'demo', undefined, ['rfid-ntag'], OFFICIAL_URL, 'stable')
    expect(b3d.store.onPluginProgress).toHaveBeenCalled()

    act(() => emit.pluginProgress({ printerId: 'printer-1', pluginId: 'demo', message: 'Deploying files' }))
    // The live phase shows in the auto-opened run modal (and mirrored in the inline working strip).
    expect(screen.getAllByText('Deploying files').length).toBeGreaterThan(0)

    pending.resolve({ installedIds: ['rfid-ntag', 'demo'], log: makeInstallLog('demo') })
    await waitFor(() => expect(onOperationDone).toHaveBeenCalledWith(['rfid-ntag', 'demo'], 'demo', 'install', expect.anything()))
  })

  it('auto-opens a run modal that stays open until dismissed, then shows the result', async () => {
    var pending = deferred<{ installedIds: string[]; log: InstallLog }>()
    var install = vi.fn(() => pending.promise)
    var { user, emit } = setup(
      <PluginPanel
        plugin={makePlugin({ id: 'demo' })}
        installed={false} hasUpdate={false} printerId="printer-1" allInstalledIds={[]}
        onClose={vi.fn()} onOperationDone={vi.fn()}
      />,
      { withCatalog: true, catalog: [makeIndexEntry({ name: 'demo' })], b3d: { store: { install } } },
    )

    await user.click(screen.getByRole('button', { name: en('btn.install') }))
    // The modal is open while installing (no click needed) and shows the live trail.
    expect(screen.getByText(en('install.live.title'))).toBeInTheDocument()
    act(() => emit.pluginProgress({ printerId: 'printer-1', pluginId: 'demo', message: 'Symlinks' }))
    expect(screen.getAllByText('Symlinks').length).toBeGreaterThan(0)

    // On completion it stays open, swapping to the result with a dismiss action.
    pending.resolve({ installedIds: ['demo'], log: makeInstallLog('demo') })
    const dismiss = await screen.findByRole('button', { name: en('install.run.dismiss') })
    expect(screen.getByText(en('install.run.done'))).toBeInTheDocument()

    await user.click(dismiss)
    expect(screen.queryByText(en('install.run.done'))).not.toBeInTheDocument()
  })

  it('disables Install until a printer is selected', () => {
    setup(
      <PluginPanel plugin={makePlugin()} installed={false} hasUpdate={false} allInstalledIds={[]} onClose={vi.fn()} />,
      { withCatalog: true, catalog: [makeIndexEntry()] },
    )
    expect(screen.getByRole('button', { name: en('btn.install') })).toBeDisabled()
  })

  it('surfaces an install failure in a 3-tier modal: plain headline, raw error behind a detail toggle, report + retry', async () => {
    var install = vi.fn().mockRejectedValue(new Error('klipper_requirements.txt is present but nothing was baked'))
    var { user } = setup(
      <PluginPanel plugin={makePlugin()} installed={false} hasUpdate={false} printerId="printer-1" allInstalledIds={[]} onClose={vi.fn()} onOperationDone={vi.fn()} />,
      { withCatalog: true, catalog: [makeIndexEntry()], b3d: { store: { install } } },
    )
    await user.click(screen.getByRole('button', { name: en('btn.install') }))

    // Plain headline shown; the raw daemon string is NOT the primary, unexplained surface.
    expect(await screen.findByText(/Could not install/)).toBeInTheDocument()
    expect(screen.queryByText(/nothing was baked/)).not.toBeInTheDocument()

    // Raw error is reachable behind the Technical-details expander.
    await user.click(screen.getByRole('button', { name: en('report.show_tech') }))
    expect(screen.getByText(/nothing was baked/)).toBeInTheDocument()

    // Report a problem (the plugin has a github source) + retry are offered.
    expect(screen.getByRole('button', { name: en('install_error.report') })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: en('btn.retry') })).toBeInTheDocument()
  })
})

describe('PluginPanel run modal dismissal', () => {
  it('the X closes the run modal during install and a later progress event does not reopen it', async () => {
    var pending = deferred<{ installedIds: string[]; log: InstallLog }>()
    var install = vi.fn(() => pending.promise)
    var { user, emit } = setup(
      <PluginPanel
        plugin={makePlugin({ id: 'demo' })}
        installed={false} hasUpdate={false} printerId="printer-1" allInstalledIds={[]}
        onClose={vi.fn()} onOperationDone={vi.fn()}
      />,
      { withCatalog: true, catalog: [makeIndexEntry({ name: 'demo' })], b3d: { store: { install } } },
    )

    await user.click(screen.getByRole('button', { name: en('btn.install') }))
    expect(screen.getByText(en('install.live.title'))).toBeInTheDocument()

    const modal = document.querySelector('.modal.install-log') as HTMLElement
    await user.click(within(modal).getByRole('button', { name: en('install.log.close') }))
    expect(screen.queryByText(en('install.live.title'))).not.toBeInTheDocument()

    act(() => emit.pluginProgress({ printerId: 'printer-1', pluginId: 'demo', message: 'Symlinks' }))
    expect(screen.queryByText(en('install.live.title'))).not.toBeInTheDocument()
  })
})
