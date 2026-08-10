// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// Where this build keeps its offline copy of the catalogue and the `.b3` files it ships with. Both the
// store (which browses it as a source) and enrollment (which installs the daemon out of it, with no
// network at all) resolve the directory here, so the two can never look in different places.
// `app.isPackaged` is read inside the function on purpose. @electron-toolkit/utils reads it the
// moment it is imported, so anything that so much as imports this file crashes outside a running
// Electron app, which put the directory out of reach of the plain-node processes (unit tests, the
// e2e specs) that legitimately need to know where the packages live.
import { app } from 'electron'
import { join } from 'path'

import { devSourcePath } from './dev-sources'

export function bundledRegistryDir(): string {
  const devOverride = devSourcePath('dist/plugins')
  if (devOverride) return devOverride

  return app.isPackaged ? join(process.resourcesPath, 'plugins') : join(__dirname, '../../dist/plugins')
}
