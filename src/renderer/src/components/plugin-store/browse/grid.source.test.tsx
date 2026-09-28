// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import { setup } from '../../../test/harness'
import { makePlugin, makeSource } from '../../../test/fixtures'
import { StoreMain, type StoreCardContext } from './grid'

const LIVE_URL = 'github:Bespok3d/main-index/index.json'
const PRERELEASE_URL = 'github:Bespok3d/main-index/index.json?ref=dev'
const live = makeSource({ registryUrl: LIVE_URL, label: 'Bespok3d Official', version: '1.0.0' })
const prerelease = makeSource({ registryUrl: PRERELEASE_URL, label: 'Bespok3d Official prerelease', version: '1.1.0-pre' })

function showCard(contextOverrides: Partial<StoreCardContext> = {}, sources = [live, prerelease]) {
  const plugin = makePlugin({ sources })
  const context: StoreCardContext = {
    installedIds: [], installedVersions: {}, installedSources: {}, installedChannels: {}, deactivatedIds: [],
    ceilingFor: () => 'stable', disabledChannels: [], ...contextOverrides,
  }

  setup(<StoreMain showFlat flatPlugins={[plugin]} displayPlugins={[plugin]} orphans={[]}
    matchOpts={{ query: '', channels: [], categories: [], trusts: [], statuses: [], printerOnly: false, installedIds: [], installedVersions: {} }}
    ctx={context} layout="grid" sortKey="name" sortDir="asc" showCategory={false} onOpen={() => {}} />)
}

describe('source of the version displayed on a browsing card', () => {
  it('names prerelease even when it is the only source', () => {
    showCard({}, [prerelease])
    expect(screen.getByText('From Bespok3d Official prerelease')).toHaveClass('multi-source')
  })

  it('names the winning source, not every alternative or the running app channel', () => {
    showCard()
    expect(screen.getByText('From Bespok3d Official prerelease')).toHaveClass('multi-source')
    expect(screen.queryByText('From Bespok3d Official')).toBeNull()
    expect(screen.getByText('2 sources')).toBeInTheDocument()
  })

  it('keeps an installed copy on its recorded Live source when a prerelease exists', () => {
    showCard({ installedIds: ['demo'], installedVersions: { demo: '0.9.0' }, installedSources: { demo: LIVE_URL } })
    expect(screen.getByText('Installed from Bespok3d Official')).toHaveClass('multi-source')
    expect(screen.queryByText('Installed from Bespok3d Official prerelease')).toBeNull()
  })

  it('shows the displayed source\'s trust when the merged catalog winner has different trust', () => {
    const communityPrerelease = makeSource({ ...prerelease, trust: 'community' })
    showCard({}, [live, communityPrerelease])

    expect(screen.getByText('From Bespok3d Official prerelease')).toBeInTheDocument()
    expect(screen.getByTitle('community')).toBeInTheDocument()
    expect(screen.queryByTitle('project')).toBeNull()
  })

  it('does not assign a different listed source to an older install whose source disappeared', () => {
    showCard({ installedIds: ['demo'], installedVersions: { demo: '0.9.0' }, installedSources: { demo: 'github:old/catalog/index.json' } })
    expect(screen.queryByText(/Installed from/)).toBeNull()
    expect(screen.queryByText('Installed from Bespok3d Official prerelease')).toBeNull()
  })

  it('never displays a registry address when the catalog has no configured name', () => {
    const registryUrl = 'github:example-publisher/plugin-repo/index.json'
    showCard({}, [makeSource({ registryUrl, label: '' })])

    expect(screen.queryByText(/From /)).toBeNull()
    expect(screen.queryByText(registryUrl)).toBeNull()
  })
})
