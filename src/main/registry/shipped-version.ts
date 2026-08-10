// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// Which version of a package this build actually ships, read from the catalogue it packs. Any version
// the app names to a user (the daemon it expects, the jinni it would install) has to come from here:
// a number taken from a sibling checkout instead names software this build does not carry. Kept free
// of any electron import so the preload script, the e2e specs and the main process read it alike.
import { readFileSync } from 'fs'
import { join } from 'path'

interface CatalogueEntry {
  name: string
  version: string
}

export function shippedPackageVersion(registryDir: string, packageName: string): string | null {
  const catalogue = JSON.parse(readFileSync(join(registryDir, 'index.json'), 'utf8')) as { plugins?: CatalogueEntry[] }
  const shipped = (catalogue.plugins ?? []).find((candidate) => candidate.name === packageName)

  return shipped ? shipped.version : null
}
