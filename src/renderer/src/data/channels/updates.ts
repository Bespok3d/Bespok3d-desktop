// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Plugin, Printer, ReleaseChannel } from '../types'
import { isNewerVersion } from '../../utils/version'
import { availableVersion, ALLOW_ALL_CHANNELS } from './index'
import type { CeilingResolver } from './index'

function hasNewerVersion(plugins: Plugin[], id: string, installed: string, ceilingFor: CeilingResolver, disabledChannels: ReleaseChannel[]): boolean {
  if (!installed) return false
  const entry = plugins.find((plugin) => plugin.id === id)

  return !!entry && isNewerVersion(availableVersion(entry, ceilingFor(id), disabledChannels), installed)
}

// How many installed plugins have a newer build available on the channel the user is on. The ceiling
// defaults to allow-all (the absolute-newest variant) for callers that do not thread the real ceiling.
export function pluginUpdateCount(printer: Printer, plugins: Plugin[], ceilingFor: CeilingResolver = ALLOW_ALL_CHANNELS, disabledChannels: ReleaseChannel[] = []): number {
  const versions = printer.installedVersions
  if (!versions) return 0

  return Object.entries(versions).filter(([id, installed]) => hasNewerVersion(plugins, id, installed, ceilingFor, disabledChannels)).length
}
