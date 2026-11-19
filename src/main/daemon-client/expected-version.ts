// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// Which daemon version this app would put on a printer, and therefore which one a managed printer is
// expected to be running. The daemon ships as its own signed package so a daemon fix reaches printers
// without an app release behind it: when the published lists offer a newer one than this build
// carries, that is the version the app installs and the version it expects back.
import type { PackageBuild } from '@bespok3d/contract'
import { bundledRegistryDir } from '../registry/bundled-dir'
import { installableBuild } from '../registry/offered-versions'
import { DAEMON_PACKAGE, daemonBuildInRegistry } from './version'

export function expectedDaemonBuild(): PackageBuild {
  return installableBuild(DAEMON_PACKAGE, daemonBuildInRegistry(bundledRegistryDir()))
}

export function expectedDaemonVersion(): string {
  return expectedDaemonBuild().version
}
