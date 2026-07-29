// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { CollectionDetailPanel } from './CollectionDetailPanel'
import { makeCollection, makePlugin } from '../../../test/fixtures'
import '../plugin-store.css'

export default { title: 'Store / CollectionDetailPanel' }

const MEMBERS = [
  makePlugin({ id: 'rfid-ntag', name: 'rfid-ntag', title: 'RFID Reader', tagline: 'NTAG/OpenSpool reader + hub' }),
  makePlugin({ id: 'rfid-opentag', name: 'rfid-opentag', title: 'OpenTag', tagline: 'OpenTag3D NDEF decoder' }),
  makePlugin({ id: 'spoolman', name: 'spoolman', title: 'Spoolman', tagline: 'Track the active spool' }),
]

const COLLECTION = makeCollection({
  id: 'all-the-tags', name: 'all-the-tags', title: 'All the Tags',
  tagline: 'Every spool, identified.',
  description: 'Installs the whole RFID tag-reading stack: the reader, every decoder, and Spoolman tracking.',
  channel: 'experiment', members: [{ id: 'rfid-ntag' }, { id: 'rfid-opentag' }, { id: 'spoolman' }],
})

function noop() {}

function Panel({ installedIds, printerId, printActive = false }: { installedIds: string[]; printerId?: string; printActive?: boolean }) {
  return (
    <CollectionDetailPanel
      collection={COLLECTION} plugins={MEMBERS} installedIds={installedIds} printerId={printerId} installing={false}
      printActive={printActive} blockedActions={printActive ? ['install'] : []}
      onInstallSelected={noop} onOpenPlugin={noop} onClose={noop}
    />
  )
}

export function NoneInstalled() {
  return <Panel installedIds={[]} printerId="printer-1" />
}

export function SomeInstalled() {
  return <Panel installedIds={['rfid-ntag']} printerId="printer-1" />
}

export function AllInstalled() {
  return <Panel installedIds={['rfid-ntag', 'rfid-opentag', 'spoolman']} printerId="printer-1" />
}

export function NoPrinter() {
  return <Panel installedIds={['rfid-ntag']} />
}

export function PrintRunning() {
  return <Panel installedIds={['rfid-ntag']} printerId="printer-1" printActive />
}
