// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// How a version reads on screen. Comparing versions is not done here and never again in the app: that
// is `@bespok3d/contract`'s `version` module, the one implementation the store, the install path, the
// compatibility floors and the auto-updater all share.
import type { TFunction } from '../i18n'

export function versionLabel(t: TFunction, version: string, swVersion?: string): string {
  if (!swVersion) return `v${version}`

  return `v${swVersion} ${t('store.plugin_version_note', { version })}`
}
