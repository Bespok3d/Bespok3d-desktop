// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// Which jinni version this build would actually put on a printer, read from the catalogue the build
// packs instead of from the adapter's own declaration. In a working copy that declaration comes from
// a sibling checkout's version.json, so it can name a jinni the build does not carry, and an update
// banner baselined on it offers bytes that are not there. A build that ships no jinni package for an
// adapter has no baseline at all, and says so, rather than naming a version it cannot install.
import { bundledRegistryDir } from '../registry/bundled-dir'
import { shippedPackageVersion } from '../registry/shipped-version'
import { installableVersion } from '../registry/offered-versions'

export interface JinniPackaging {
  jinniPackage: string
}

// The jinni the app would install: the published one when the lists offer a jinni newer than the
// build ships, so a daemon release that needs a newer jinni can land without an app release behind
// it, and the copy this build carries whenever the lists are behind it or have never been read.
export function offeredJinniVersion(adapter: JinniPackaging): string | undefined {
  const shipped = shippedJinniVersion(adapter)

  return shipped ? installableVersion(adapter.jinniPackage, shipped) : undefined
}

function shippedJinniVersion(adapter: JinniPackaging): string | undefined {
  try {
    return shippedPackageVersion(bundledRegistryDir(), adapter.jinniPackage) ?? undefined
  } catch (unreadableCatalogue) {
    console.warn(`[compat] no shipped jinni version for ${adapter.jinniPackage}: ${String(unreadableCatalogue)}`)

    return undefined
  }
}
