// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useState, type ReactNode } from 'react'
import { PluginCard } from './PluginCard'
import { makePlugin, makeSource } from '../../../test/fixtures'
import '../plugin-store.css'

export default { title: 'Store / Browse / PluginCard' }

function noop() {}

function Grid({ children }: { children: ReactNode }) {
  return <div className="store-grid" style={{ maxWidth: 320 }}>{children}</div>
}

export function NotInstalled() {
  return (
    <Grid>
      <PluginCard
        plugin={makePlugin({ tagline: 'Track the active spool by RFID or manual pick' })}
        installed={false} hasUpdate={false} displayVersion="1.2.0" displayChannel="stable"
        layout="grid" showCategory onOpen={noop}
      />
    </Grid>
  )
}

export function Installed() {
  return (
    <Grid>
      <PluginCard
        plugin={makePlugin()} installed hasUpdate={false} displayVersion="1.2.0" displayChannel="stable"
        installedChannel="stable" layout="grid" onOpen={noop}
      />
    </Grid>
  )
}

export function UpdateAvailable() {
  return (
    <Grid>
      <PluginCard
        plugin={makePlugin()} installed hasUpdate displayVersion="1.3.0" displayChannel="stable"
        installedChannel="stable" layout="grid" onOpen={noop}
      />
    </Grid>
  )
}

export function Deactivated() {
  return (
    <Grid>
      <PluginCard
        plugin={makePlugin()} installed deactivated hasUpdate={false} displayVersion="1.2.0" displayChannel="stable"
        installedChannel="stable" layout="grid" onOpen={noop}
      />
    </Grid>
  )
}

export function ExperimentChannelNotInstalled() {
  return (
    <Grid>
      <PluginCard
        plugin={makePlugin()} installed={false} hasUpdate={false} displayVersion="2.0.0-exp.1" displayChannel="experiment"
        layout="grid" onOpen={noop}
      />
    </Grid>
  )
}

export function MultiSourceWithDeps() {
  return (
    <Grid>
      <PluginCard
        plugin={makePlugin({ deps: ['rfid-ntag'], sources: [makeSource(), makeSource({ label: 'Sideloaded local files', local: true, trust: 'any' })] })}
        installed={false} hasUpdate={false} displayVersion="1.2.0" displayChannel="stable"
        layout="grid" onOpen={noop}
      />
    </Grid>
  )
}

export function ListLayout() {
  return (
    <div style={{ maxWidth: 640 }}>
      <PluginCard
        plugin={makePlugin()} installed={false} hasUpdate={false} displayVersion="1.2.0" displayChannel="stable"
        layout="list" showCategory onOpen={noop}
      />
    </div>
  )
}

// Batch-select mode: an installable card toggles on click; an already-installed card (not selectable)
// goes visually inert instead of reacting.
function SelectModeCard({ pluginId, selectable }: { pluginId: string; selectable: boolean }) {
  const [selected, setSelected] = useState(false)

  return (
    <PluginCard
      plugin={makePlugin({ id: pluginId })} installed={!selectable} hasUpdate={false} displayVersion="1.2.0" displayChannel="stable"
      layout="grid" onOpen={noop} selecting selectable={selectable} selected={selected} onToggleSelect={() => setSelected((prev) => !prev)}
    />
  )
}

export function SelectingMode() {
  return (
    <div style={{ display: 'flex', gap: 16, maxWidth: 700 }}>
      <SelectModeCard pluginId="pickable" selectable />
      <SelectModeCard pluginId="already-installed" selectable={false} />
    </div>
  )
}
