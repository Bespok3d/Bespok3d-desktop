// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// Which printers have the active watch. A daemon whose version is not known yet is neither: the feed
// waits for the version, and the setting asks the printer, which answers nothing when it is too old.
import { isDaemonVersionAtLeast } from '@bespok3d/contract'

export const ACTIVE_WATCH_MIN_DAEMON = '0.15.0'

export function daemonHasActiveWatch(daemonVersion?: string): boolean {
  return daemonVersion !== undefined && isDaemonVersionAtLeast(daemonVersion, ACTIVE_WATCH_MIN_DAEMON)
}

export function daemonTooOldForActiveWatch(daemonVersion?: string): boolean {
  return daemonVersion !== undefined && !isDaemonVersionAtLeast(daemonVersion, ACTIVE_WATCH_MIN_DAEMON)
}

// Tokens this app build knows how to word. A newer daemon may report a token this build predates, and
// a raw machine token never reaches the user.
export const KNOWN_REBOOT_TOKENS: string[] = ['screen-stuck']
