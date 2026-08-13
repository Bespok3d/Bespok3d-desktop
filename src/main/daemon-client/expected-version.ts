// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// Which daemon version this app would put on a printer, and therefore which one a managed printer is
// expected to be running. The daemon ships as its own signed package so a daemon fix reaches printers
// without an app release behind it: when the published lists offer a newer one than this build
// carries, that is the version the app installs and the version it expects back.
import { bundledRegistryDir } from '../registry/bundled-dir'
import { installableVersion } from '../registry/offered-versions'
import { DAEMON_PACKAGE, daemonVersionInRegistry } from './version'

export function expectedDaemonVersion(): string {
  return installableVersion(DAEMON_PACKAGE, daemonVersionInRegistry(bundledRegistryDir()))
}
