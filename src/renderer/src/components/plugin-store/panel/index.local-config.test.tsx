// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom
// A version held on this machine declares its settings in its own manifest. Running an experimental
// build is pointless if the form still offers the settings the published list decided, so what is
// asserted here is that the Settings tab shows the picked version's own fields.
import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { setup } from '../../../test/harness'
import { makeT } from '../../../i18n'
import { makePlugin, makeSource, makeIndexEntry } from '../../../test/fixtures'
import { PluginPanel } from '.'

const en = makeT('en')

const PUBLISHED_FIELD = { key: 'PORT', label: 'Web port', type: 'number' as const, scope: 'printer' as const }
const EXPERIMENTAL_FIELD = { key: 'EXPOSURE', label: 'Camera exposure', type: 'text' as const, scope: 'printer' as const }

function panelOfferingTheLocalBuild() {
  const plugin = makePlugin({
    id: 'demo',
    config: [PUBLISHED_FIELD],
    sources: [makeSource({ registryUrl: '/Users/dev/Bespok3d/dist/plugins/index.json', label: 'On this machine', version: '1.2.0-dev', local: true, config: [PUBLISHED_FIELD, EXPERIMENTAL_FIELD] })],
  })

  return setup(
    <PluginPanel plugin={plugin} installed={false} hasUpdate={false} printerId="printer-1" initialTab="config"
      onClose={vi.fn()} onOperationDone={vi.fn()} />,
    { withCatalog: true, catalog: [makeIndexEntry({ name: 'demo' })] },
  )
}

describe('the settings a version held on this machine carries', () => {
  it('offers the field only that version declares, so an experimental build can be driven', () => {
    panelOfferingTheLocalBuild()

    expect(screen.getByText(EXPERIMENTAL_FIELD.label)).toBeInTheDocument()
  })

  it('still offers the fields the published entry declared', () => {
    panelOfferingTheLocalBuild()

    expect(screen.getByText(PUBLISHED_FIELD.label)).toBeInTheDocument()
  })

  it('keeps the published fields for a version that comes from a list', () => {
    const plugin = makePlugin({
      id: 'demo',
      config: [PUBLISHED_FIELD],
      sources: [makeSource({ registryUrl: 'github:Bespok3d/main-index/index.json', label: 'Bespok3d Official', version: '1.1.0', config: [EXPERIMENTAL_FIELD] })],
    })
    setup(
      <PluginPanel plugin={plugin} installed={false} hasUpdate={false} printerId="printer-1" initialTab="config"
        onClose={vi.fn()} onOperationDone={vi.fn()} />,
      { withCatalog: true, catalog: [makeIndexEntry({ name: 'demo' })] },
    )

    expect(screen.queryByText(EXPERIMENTAL_FIELD.label)).not.toBeInTheDocument()
    expect(screen.getByText(en('store.tab_config'))).toBeInTheDocument()
  })
})
