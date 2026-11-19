// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// One sideloaded (drag-dropped) package after ingest. `metadataComplete` is false when catalog fields
// (title/description/tagline/category/channel) are missing, so the UI can hint without rejecting it.
export interface LocalPackageInfo {
  id: string
  version: string
  title: string
  metadataComplete: boolean
}

export interface AddLocalResult {
  added: LocalPackageInfo[]
  errors: { file: string; message: string }[]
}
