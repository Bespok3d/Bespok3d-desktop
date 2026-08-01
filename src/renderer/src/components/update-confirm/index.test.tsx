// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { setup } from '../../test/harness'
import { makeT } from '../../i18n'
import { UpdateConfirmDialog } from './index'
import { installedFromRecords } from '../../data/channels/updates'
import type { Plugin, PluginSource } from '../../data/types'

const en = makeT('en')
const LOCAL_BUNDLE = 'local:dev-bundle'
const PUBLISHED_LIST = 'https://lists.example/index.json'
const PUBLISHED_LABEL = 'Example list'

function source(registryUrl: string, label: string, version: string): PluginSource {
  return { registryUrl, label, version, channel: 'stable', trust: 'community', local: registryUrl.startsWith('local:') } as unknown as PluginSource
}

const SPOOLMAN = {
  id: 'spoolman', name: 'Spoolman', version: '2.0.0', deps: [],
  sources: [source(LOCAL_BUNDLE, 'Dev bundle', '1.1.0'), source(PUBLISHED_LIST, PUBLISHED_LABEL, '2.0.0')],
} as unknown as Plugin

function renderDialog(onConfirm: () => void) {
  return setup(
    <UpdateConfirmDialog
      specs={[{ pluginId: 'spoolman', sourceUrl: LOCAL_BUNDLE, channel: 'stable' }]}
      plugins={[SPOOLMAN]}
      installed={installedFromRecords({ spoolman: '1.0.0' }, { spoolman: LOCAL_BUNDLE })}
      onConfirm={onConfirm}
      onCancel={vi.fn()}
    />,
  )
}

describe('UpdateConfirmDialog', () => {
  it('reads the batch back with the version the installed source offers, not the published one', () => {
    renderDialog(vi.fn())
    expect(screen.getByText('Spoolman')).toBeInTheDocument()
    expect(screen.getByText(en('store.update_confirm.versions', { from: '1.0.0', to: '1.1.0' }))).toBeInTheDocument()
  })

  it('keeps the other versions folded away until the user opens them', async () => {
    var { user } = renderDialog(vi.fn())
    expect(screen.queryByText(PUBLISHED_LABEL)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: en('store.update_confirm.other_versions') }))
    expect(screen.getByText(PUBLISHED_LABEL)).toBeInTheDocument()
  })

  it('sends the version the user picked instead of the one that was offered', async () => {
    var onConfirm = vi.fn()
    var { user } = renderDialog(onConfirm)
    await user.click(screen.getByRole('button', { name: en('store.update_confirm.other_versions') }))
    await user.click(screen.getByText(PUBLISHED_LABEL))
    await user.click(screen.getByRole('button', { name: en('store.update_confirm.confirm') }))
    expect(onConfirm).toHaveBeenCalledWith([{ pluginId: 'spoolman', sourceUrl: PUBLISHED_LIST, channel: 'stable' }])
  })
})
