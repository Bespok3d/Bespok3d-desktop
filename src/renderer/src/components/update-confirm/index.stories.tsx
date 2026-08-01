// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { UpdateConfirmDialog } from './index'
import { installedFromRecords } from '../../data/channels/updates'
import type { Plugin, PluginSource } from '../../data/types'

export default { title: 'Store / Update confirm' }

const LOCAL_BUNDLE = 'local:dev-bundle'
const PUBLISHED_LIST = 'https://lists.example/index.json'

function source(registryUrl: string, label: string, version: string): PluginSource {
  return { registryUrl, label, version, channel: 'stable', trust: 'community', local: registryUrl.startsWith('local:') } as unknown as PluginSource
}

function twoSourced(id: string, name: string, localVersion: string, publishedVersion: string): Plugin {
  return {
    id, name, version: publishedVersion, deps: [],
    sources: [source(LOCAL_BUNDLE, 'Dev bundle', localVersion), source(PUBLISHED_LIST, 'Example list', publishedVersion)],
  } as unknown as Plugin
}

const PLUGINS = [twoSourced('spoolman', 'Spoolman', '1.1.0', '2.0.0'), twoSourced('cpu-temp', 'CPU temperature', '0.3.0', '0.2.0')]

// The developer's case: both plugins are running from the dev bundle, so both updates come from the
// dev bundle, and each line can be opened to send the published build instead.
export function TwoLocalBuildsBeingUpdated() {
  return (
    <UpdateConfirmDialog
      specs={[
        { pluginId: 'spoolman', sourceUrl: LOCAL_BUNDLE, channel: 'stable' },
        { pluginId: 'cpu-temp', sourceUrl: LOCAL_BUNDLE, channel: 'stable' },
      ]}
      plugins={PLUGINS}
      installed={installedFromRecords({ spoolman: '1.0.0', 'cpu-temp': '0.1.0' }, { spoolman: LOCAL_BUNDLE, 'cpu-temp': LOCAL_BUNDLE })}
      onConfirm={() => undefined}
      onCancel={() => undefined}
    />
  )
}

// The place the installed copy came from is gone from the lists, so the update comes from somewhere
// else and the line says so instead of switching quietly.
export function TheInstalledSourceIsGone() {
  return (
    <UpdateConfirmDialog
      specs={[{ pluginId: 'spoolman', sourceUrl: PUBLISHED_LIST, channel: 'stable' }]}
      plugins={PLUGINS}
      installed={installedFromRecords({ spoolman: '1.0.0' }, { spoolman: 'local:a-bundle-that-is-gone' })}
      onConfirm={() => undefined}
      onCancel={() => undefined}
    />
  )
}
