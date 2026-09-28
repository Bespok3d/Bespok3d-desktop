// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import { setup } from '../../../test/harness'
import { makeCatalogPayload, makeIndexEntry, makeInstallLog, makePlugin, makeSource } from '../../../test/fixtures'
import { PluginPanel } from '.'

const LIVE_URL = 'github:Bespok3d/main-index/index.json'
const TIER_URL = 'github:Bespok3d/main-index/index.json?ref=dev'

function tierCatalog() {
  const live = makeIndexEntry({ name: 'demo', registry_url: LIVE_URL, trust: 'project', download_url: 'https://live.example/demo.b3' })
  const tier = makeIndexEntry({ name: 'demo', registry_url: TIER_URL, trust: 'unknown', download_url: 'https://tier.example/demo.b3' })
  const sources = [LIVE_URL, TIER_URL].map((url) => ({
    url, label: url, name: url === LIVE_URL ? 'Bespok3d Official' : 'Bespok3d Official prerelease',
    trust: 'project' as const, locked: true, enabled: true, status: 'ok' as const,
    pluginCount: 1, error: null, reason: null,
  }))

  return makeCatalogPayload([{ ...live, variants: [live, tier] }], { sources })
}

describe('tier version selection', () => {
  it('lets the user select an unsigned same-version tier and installs its own source', async () => {
    const install = vi.fn().mockResolvedValue({ installedIds: ['demo'], log: makeInstallLog('demo') })
    const { user } = setup(
      <PluginPanel plugin={makePlugin({ id: 'demo', sources: [makeSource({ registryUrl: LIVE_URL }), makeSource({ registryUrl: TIER_URL, label: 'Bespok3d Official prerelease', trust: 'unknown' })] })} installed={false} hasUpdate={false} initialTab="versions" printerId="printer-1" allInstalledIds={[]} onClose={vi.fn()} onOperationDone={vi.fn()} />,
      { withCatalog: true, b3d: { registry: { catalog: vi.fn().mockResolvedValue(tierCatalog()) }, store: { install } } },
    )
    const sourceTabs = document.querySelector('.panel-versions > .segmented') as HTMLElement
    await user.click(within(sourceTabs).getByRole('button', { name: 'Bespok3d Official prerelease' }))
    const tierChoice = within(document.querySelector('.panel-sources') as HTMLElement).getByRole('button', { name: /Bespok3d Official prerelease/ })

    expect(tierChoice).toHaveTextContent('Unsigned')
    await user.click(tierChoice)
    await user.click(screen.getByRole('button', { name: /Install/ }))

    expect(install).toHaveBeenCalledWith('printer-1', 'demo', undefined, [], TIER_URL, 'stable')
  })
})
