// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// Which jinni version this build would actually put on a printer, read from the catalogue the build
// packs instead of from the adapter's own declaration. In a working copy that declaration comes from
// a sibling checkout's version.json, so it can name a jinni the build does not carry, and an update
// banner baselined on it offers bytes that are not there. A build that ships no jinni package for an
// adapter has no baseline at all, and says so, rather than naming a version it cannot install.
import { bundledRegistryDir } from '../registry/bundled-dir'
import { shippedPackageVersion } from '../registry/shipped-version'

export interface JinniPackaging {
  jinniPackage: string
}

export function shippedJinniVersion(adapter: JinniPackaging): string | undefined {
  try {
    return shippedPackageVersion(bundledRegistryDir(), adapter.jinniPackage) ?? undefined
  } catch (unreadableCatalogue) {
    console.warn(`[compat] no shipped jinni version for ${adapter.jinniPackage}: ${String(unreadableCatalogue)}`)

    return undefined
  }
}
