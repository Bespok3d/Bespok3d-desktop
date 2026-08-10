// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// What a package would place on a printer, read from the archive bytes without unpacking anything.
//
// Everything a package deploys sits under one member prefix inside the `.b3`; the rest of the archive is
// the manifest, its signature and the docs, none of which reach the printer. Both the reader that
// installs a package this build ships and the check that refuses two packages writing over each other
// need that same list, so where it lives in the archive is spelled out once.
import AdmZip from 'adm-zip'

export const PAYLOAD_PREFIX = 'files/'

export function payloadMembers(archiveBytes: Buffer): readonly AdmZip.IZipEntry[] {
  return new AdmZip(archiveBytes).getEntries()
    .filter((member) => !member.isDirectory && member.entryName.startsWith(PAYLOAD_PREFIX))
}

// Paths relative to the payload root, so no caller has to spell the archive layout.
export function payloadPaths(archiveBytes: Buffer): readonly string[] {
  return payloadMembers(archiveBytes).map((member) => member.entryName.slice(PAYLOAD_PREFIX.length))
}
