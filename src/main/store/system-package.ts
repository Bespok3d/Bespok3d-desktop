// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// The printer's own machinery as bytes: the daemon, and the adapter's jinni. Both are released as
// their own signed packages precisely so a fix reaches printers without waiting for an app release,
// and a daemon release that needs a newer jinni moves the pair, so both are opened the same way here.
//
// The published lists are read first and the copy in the build is the floor under them: a list that is
// behind this build, or a machine that has never reached a list, gets exactly the bytes it always got.
// The bytes cross the same verifier either way, and a signature that does not check out fails the op
// loudly, because putting other bytes on the printer while the app names the published version would
// be a lie the user cannot see.
import { isReleaseNewer } from '@bespok3d/contract'
import { loadCatalog } from '../registry'
import { bundledRegistryDir } from '../registry/bundled-dir'
import { shippedPackageVersion } from '../registry/shipped-version'
import { forgetOfferedSystemVersion, rememberOfferedSystemVersion } from '../registry/offered-versions'
import type { MergedEntry } from '../registry/model'
import { discardCachedArchive, resolveArchiveBytes } from './catalog-archive'
import { openBundledPackage, openVerifiedPackage } from './bundled-package'
import type { BundledPackage } from './bundled-package'

export async function openSystemPackage(packageName: string): Promise<BundledPackage> {
  const offered = await offeredEntry(packageName)
  if (!offered) return openBundledPackage(packageName)

  const publishedArchive = await downloadedArchive(offered)
  if (!publishedArchive) return openBundledPackage(packageName)

  const publishedPackage = await openVerifiedPackage(offered, publishedArchive).catch((refusal) => {
    discardCachedArchive(offered)
    throw refusal
  })
  rememberOfferedSystemVersion(offered.name, offered.version)

  return publishedPackage
}

async function offeredEntry(packageName: string): Promise<MergedEntry | undefined> {
  const shipped = shippedPackageVersion(bundledRegistryDir(), packageName)
  const catalog = await loadCatalog()
  const published = catalog.plugins.find((candidate) => candidate.name === packageName)

  return shipped && published && isReleaseNewer(shipped, published.version) ? published : undefined
}

// A printer that answers on port 22 and nothing else still enrolls: no route to the release means the
// copy this build ships, and the offer is forgotten so that every version the app names matches the
// bytes that actually landed. The next list read offers the newer one again.
async function downloadedArchive(entry: MergedEntry): Promise<Buffer | undefined> {
  try {
    return await resolveArchiveBytes(entry)
  } catch (unreachableRelease) {
    console.warn(`[store] ${entry.name} ${entry.version} could not be fetched: ${String(unreachableRelease)}`)
    forgetOfferedSystemVersion(entry.name)

    return undefined
  }
}
