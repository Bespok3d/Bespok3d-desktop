// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { existsSync } from 'fs'
import { join } from 'path'

// A developer can point the app at local working copies of the daemon, adapters, and the built
// plugin catalog instead of the packaged bundle or a remote source, so the inner loop stays fully
// offline. B3D_DEV_SOURCES is the workspace root; the layout mirrors the published repos:
//   <root>/dist/plugins/index.json   the locally built catalog
//   <root>/daemon                    the daemon source tree
//   <root>/adapters/<id>/jinni       an adapter's jinni
// A path absent under the root falls through to normal resolution, so a partial workspace (only
// some repos checked out) still works, and an unset variable changes nothing.

export function devSourcesRoot(): string | undefined {
  const root = process.env.B3D_DEV_SOURCES

  return root && root.length > 0 ? root : undefined
}

export function devSourcePath(relativePath: string): string | undefined {
  const root = devSourcesRoot()
  if (!root) return undefined
  const candidate = join(root, relativePath)

  return existsSync(candidate) ? candidate : undefined
}
