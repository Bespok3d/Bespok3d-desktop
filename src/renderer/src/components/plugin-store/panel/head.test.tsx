// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { waitFor } from '@testing-library/react'
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

// The point of the whole feature, seen from the page: a publisher releases and the store says so,
// with no list republished anywhere. The listed version is what shows until the repo answers, so an
// unreachable repo and a repo with nothing newer both leave the page exactly as the list left it.
function renderBrowsedPanel(freshestVersion: string | null) {
  return setup(
    <PluginPanel
      plugin={makePlugin({ id: 'fluidd', title: 'Fluidd', version: '0.1.4', swVersion: '1.37.2' })}
      installed={false} hasUpdate={false} printerId="printer-1"
      allInstalledIds={[]} onClose={vi.fn()} onOperationDone={vi.fn()}
    />,
    {
      withCatalog: true,
      catalog: [makeIndexEntry({ name: 'fluidd', version: '0.1.4' })],
      b3d: { registry: { freshestVersion: () => Promise.resolve(freshestVersion) } },
    },
  )
}

describe('PanelHead version line while browsing a plugin whose repo has released since its list', () => {
  it('shows the version the repo released, not the one the list carries', async () => {
    renderBrowsedPanel('0.2.0')

    await waitFor(() => expect(headSubText()).toContain('v0.2.0'))
    expect(headSubText()).not.toContain('v0.1.4')
  })

  it('drops the packaged upstream version, which describes the listed build and not the newer one', async () => {
    renderBrowsedPanel('0.2.0')

    await waitFor(() => expect(headSubText()).toContain('v0.2.0'))
    expect(headSubText()).not.toContain('1.37.2')
  })

  it('keeps the listed version when the repo has nothing newer or cannot be asked', async () => {
    renderBrowsedPanel(null)

    await waitFor(() => expect(headSubText()).toContain('v1.37.2'))
    expect(headSubText()).toContain('(plugin v0.1.4)')
  })
})
