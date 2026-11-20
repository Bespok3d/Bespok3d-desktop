// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { setup } from '../../../test/harness'
import { makeCatalogPayload, makeIndexEntry, makeInstallLog, makePlugin, makePrinter, makeSource } from '../../../test/fixtures'
import type { ChannelPrefs } from '../../common/hooks/useChannelPrefs'
import { StoreDetailPanel } from './StoreDetailPanel'
import type { TabRequest } from './StoreDetailPanel'

const LIVE_URL = 'github:Bespok3d/main-index/index.json'
const PRERELEASE_URL = 'github:Bespok3d/main-index/index.json?ref=dev'

const channelPrefs: ChannelPrefs = { primary: 'stable', disabledChannels: [], prefs: {}, ceilingFor: () => 'experiment', setPref: vi.fn() }

const plugin = makePlugin({ id: 'demo', sources: [
  makeSource({ registryUrl: LIVE_URL, version: '1.0.0' }),
  makeSource({ registryUrl: PRERELEASE_URL, label: 'Bespok3d Official prerelease', version: '1.1.0-pre', channel: 'testing' }),
] })

function twoListCatalog() {
  const live = makeIndexEntry({ name: 'demo', registry_url: LIVE_URL, download_url: 'https://live.example/demo.b3' })
  const prerelease = makeIndexEntry({ name: 'demo', registry_url: PRERELEASE_URL, download_url: 'https://prerelease.example/demo.b3' })

  return makeCatalogPayload([{ ...live, variants: [live, prerelease] }])
}

function renderInstalledFromLive(tabRequest: TabRequest | null = null) {
  const install = vi.fn().mockResolvedValue({ installedIds: ['demo'], log: makeInstallLog('demo') })
  const harness = setup(
    <StoreDetailPanel
      plugin={plugin} printer={makePrinter({ installedSources: { demo: LIVE_URL } })}
      view={{ installedIds: ['demo'], installedVersions: { demo: '1.0.0' }, deactivatedIds: [] }}
      channelPrefs={channelPrefs} printActive={false} blockedActions={[]}
      onOperationDone={vi.fn()} catalogPlugins={[plugin]} tabRequest={tabRequest} onSelectPlugin={vi.fn()} onTabRequest={vi.fn()}
    />,
    { withCatalog: true, b3d: { registry: { catalog: vi.fn().mockResolvedValue(twoListCatalog()) }, store: { install } } },
  )

  return { ...harness, install }
}

describe('opening a plugin with an update from another list', () => {
  it('installs the offered build, not the installed one again, when opened without a notice', async () => {
    const { user, install } = renderInstalledFromLive()
    const installButton = screen.getByRole('button', { name: /Update|Switch version/ })
    await user.click(installButton)

    expect(document.querySelector('.panel-sources .source-row.selected')).toHaveTextContent('Bespok3d Official prerelease')
    await user.click(installButton)

    expect(install).toHaveBeenCalledWith('printer-1', 'demo', undefined, [], PRERELEASE_URL, 'testing')
  })

  it('opens on the offered build when the notice named a variant the plugin no longer offers', () => {
    renderInstalledFromLive({ id: 'demo', tab: 'versions', variantKey: `${PRERELEASE_URL}::experiment`, nonce: 1 })

    expect(document.querySelector('.panel-sources .source-row.selected')).toHaveTextContent('Bespok3d Official prerelease')
  })
})
