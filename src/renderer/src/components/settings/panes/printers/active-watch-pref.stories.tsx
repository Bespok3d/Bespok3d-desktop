// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { ActiveWatchPref } from './active-watch-pref'
import { makePrinter } from '../../../../test/fixtures'

export default { title: 'Settings / Active watch' }

export function WatchingTheScreen() {
  return <ActiveWatchPref printer={makePrinter({ status: 'managed', daemonVersion: '0.15.0' })} />
}

export function DaemonTooOld() {
  return <ActiveWatchPref printer={makePrinter({ status: 'managed', daemonVersion: '0.15.9' })} />
}
