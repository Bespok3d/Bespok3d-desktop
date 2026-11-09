// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { FailedLists } from './FailedLists'
import '../plugin-store.css'

export default { title: 'Store / FailedLists' }

export function WithCachedCopy() {
  return (
    <FailedLists failures={[{ url: 'github:example-org/example-list', name: 'Example List', reason: 'network', message: 'offline', lastListed: ['Camera', 'Spool Tracker', 'Remote Screen'] }]} />
  )
}

export function NeverLoaded() {
  return (
    <FailedLists failures={[{ url: 'https://lists.example/index.json', name: 'Example Mirror', reason: 'notfound', message: 'HTTP 404', lastListed: null }]} />
  )
}
