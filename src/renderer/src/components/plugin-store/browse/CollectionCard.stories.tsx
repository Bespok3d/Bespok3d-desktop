// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { CollectionCard } from './CollectionCard'
import { makeCollection, makePlugin } from '../../../test/fixtures'
import '../plugin-store.css'

export default { title: 'Store / CollectionCard' }

const MEMBERS = [
  makePlugin({ id: 'rfid-ntag', name: 'rfid-ntag', title: 'RFID Reader' }),
  makePlugin({ id: 'rfid-opentag', name: 'rfid-opentag', title: 'OpenTag' }),
  makePlugin({ id: 'spoolman', name: 'spoolman', title: 'Spoolman' }),
]

const COLLECTION = makeCollection({
  id: 'all-the-tags', name: 'all-the-tags', title: 'All the Tags', tagline: 'Every spool, identified.',
  channel: 'experiment', members: [{ id: 'rfid-ntag' }, { id: 'rfid-opentag' }, { id: 'spoolman' }],
})

function noop() {}

// The 2x span only reads against the grid, so the stories render the card inside a real .plugin-grid.
function Shelf({ installedIds }: { installedIds: string[] }) {
  return (
    <div className="plugin-grid">
      <CollectionCard collection={COLLECTION} plugins={MEMBERS} collections={[]} installedIds={installedIds} onOpen={noop} />
    </div>
  )
}

export function NoneInstalled() {
  return <Shelf installedIds={[]} />
}

export function SomeInstalled() {
  return <Shelf installedIds={['rfid-ntag']} />
}

export function AllInstalled() {
  return <Shelf installedIds={['rfid-ntag', 'rfid-opentag', 'spoolman']} />
}

// The collection's own id still installed as a plugin: the update pill marks the pending migration.
export function PluginBecameCollection() {
  return <Shelf installedIds={['all-the-tags', 'rfid-ntag', 'rfid-opentag', 'spoolman']} />
}
