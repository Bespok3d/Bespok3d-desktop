// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// The check every install path runs before bytes reach the printer, together with the cleanup that
// belongs with a package the app will not install. It lives beside verify-package.ts rather than inside
// it because the verification is shared with the builder's cross-repo signing test, which runs outside
// Electron: pulling the download cache (and with it electron's `app`) into that module breaks it.
import type { MergedEntry, PackageTrust } from '../registry/model'
import { discardCachedArchive } from './catalog-archive'
import { verifiedPackageTrust } from './verify-package'

// A refused package's downloaded copy is thrown away, so the user's next attempt fetches the file again
// instead of being handed back the very copy that was just refused.
export function verifiedPackageTrustOrDiscard(archiveBytes: Buffer, entry: MergedEntry): Promise<PackageTrust> {
  return verifiedPackageTrust(archiveBytes, entry).catch((error) => {
    discardCachedArchive(entry)
    throw error
  })
}
