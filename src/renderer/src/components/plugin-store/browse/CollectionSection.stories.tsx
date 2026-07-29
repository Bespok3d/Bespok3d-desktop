// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { CollectionSection } from './CollectionSection'
import { makeCollection, makePlugin } from '../../../test/fixtures'
import '../plugin-store.css'

export default { title: 'Store / CollectionSection' }

const MEMBERS = [
  makePlugin({ id: 'rfid-ntag', name: 'rfid-ntag', title: 'RFID Reader' }),
  makePlugin({ id: 'rfid-opentag', name: 'rfid-opentag', title: 'OpenTag' }),
  makePlugin({ id: 'spoolman', name: 'spoolman', title: 'Spoolman' }),
]

const COLLECTIONS = [
  makeCollection({
    id: 'all-the-tags', name: 'all-the-tags', title: 'All the Tags', tagline: 'Every spool, identified.',
    channel: 'experiment', members: [{ id: 'rfid-ntag' }, { id: 'rfid-opentag' }, { id: 'spoolman' }],
  }),
]

function noop() {}

export function OneCollection() {
  return (
    <div className="main">
      <CollectionSection collections={COLLECTIONS} plugins={MEMBERS} installedIds={['rfid-ntag']} onOpen={noop} />
    </div>
  )
}
