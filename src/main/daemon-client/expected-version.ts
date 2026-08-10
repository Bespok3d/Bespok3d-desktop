// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// The electron-aware half of the expected-daemon-version read: it knows where this build keeps the
// catalogue it ships, which needs electron and so cannot sit beside the pure read in version.ts.
import { bundledRegistryDir } from '../registry/bundled-dir'
import { daemonVersionInRegistry } from './version'

export function expectedDaemonVersion(): string {
  return daemonVersionInRegistry(bundledRegistryDir())
}
