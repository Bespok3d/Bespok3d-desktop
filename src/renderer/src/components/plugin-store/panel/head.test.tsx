// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { setup } from '../../../test/harness'
import { makePlugin, makeIndexEntry } from '../../../test/fixtures'
import { PluginPanel } from '.'

function renderWrapperPanel(installedVersion: string) {
  return setup(
    <PluginPanel
      plugin={makePlugin({ id: 'fluidd', title: 'Fluidd', version: '0.1.4', swVersion: '1.37.2' })}
      installed hasUpdate={false} printerId="printer-1" installedVersion={installedVersion}
      allInstalledIds={['fluidd']} onClose={vi.fn()} onOperationDone={vi.fn()}
    />,
    { withCatalog: true, catalog: [makeIndexEntry({ name: 'fluidd', version: '0.1.4' })] },
  )
}

function headSubText() {
  return document.querySelector('.panel-head .sub')?.textContent ?? ''
}

describe('PanelHead version line for a plugin that wraps an upstream project', () => {
  it('leads with the packaged upstream version when the installed build matches the catalog entry', () => {
    renderWrapperPanel('0.1.4')
    const sub = headSubText()
    expect(sub).toContain('v1.37.2')
    expect(sub).toContain('(plugin v0.1.4)')
  })

  it('shows the plain plugin version for a drifted install the catalog no longer describes', () => {
    renderWrapperPanel('0.1.3')
    const sub = headSubText()
    expect(sub).toContain('v0.1.3')
    expect(sub).not.toContain('1.37.2')
  })
})
