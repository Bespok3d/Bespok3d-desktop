// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { setup } from '../../../test/harness'
import { makeT } from '../../../i18n'
import { makePlugin, makeInstallLog } from '../../../test/fixtures'
import { PluginPanel } from '.'

const en = makeT('en')

function renderPanel(installLog = makeInstallLog('demo')) {
  const plugin = makePlugin({ id: 'demo' })

  return setup(
    <PluginPanel
      plugin={plugin}
      installed
      hasUpdate={false}
      printerId="printer-1"
      installedVersion="1.0.0"
      allInstalledIds={[plugin.id]}
      history={[{ pluginId: 'demo', action: 'install', timestamp: 1, log: installLog }]}
      onClose={vi.fn()}
      onOperationDone={vi.fn()}
    />,
    { withCatalog: true, catalog: [] },
  )
}

describe('PluginPanel install log tab', () => {
  it('shows the Install log tab for an installed plugin with a recorded install log', () => {
    renderPanel()
    expect(screen.getByRole('button', { name: en('store.tab_log') })).toBeInTheDocument()
  })

  it('renders the install-log caption when the tab is opened', async () => {
    const { user } = renderPanel()
    await user.click(screen.getByRole('button', { name: en('store.tab_log') }))
    expect(screen.getByText(en('install.log.tab_caption', { name: 'Demo Plugin' }))).toBeInTheDocument()
  })

  it('shows the Install log tab from the persisted record log with no in-memory history (survives restart)', () => {
    const plugin = makePlugin({ id: 'demo' })
    setup(
      <PluginPanel
        plugin={plugin}
        installed
        hasUpdate={false}
        printerId="printer-1"
        installedVersion="1.0.0"
        allInstalledIds={[plugin.id]}
        installedLog={makeInstallLog('demo')}
        onClose={vi.fn()}
        onOperationDone={vi.fn()}
      />,
      { withCatalog: true, catalog: [] },
    )
    expect(screen.getByRole('button', { name: en('store.tab_log') })).toBeInTheDocument()
    // The persisted log feeds only the Log tab; it must NOT resurface the one-off overview
    // "View report" strip on every visit to an installed plugin.
    expect(screen.queryByText(en('install.zone.done', { steps: 0 }))).not.toBeInTheDocument()
  })
})
