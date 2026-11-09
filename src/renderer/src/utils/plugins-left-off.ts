// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { PluginRecoveryResult } from '@bespok3d/contract'
import type { BatchResult } from '../../../main/daemon-client/batch-result'

// The printer's safety net reports the plugins it switched off on its own services row, which is ok
// once the printer works again, so a row being ok does not mean nothing was switched off.
function leftAPluginOff(row: PluginRecoveryResult): boolean {
  return !row.ok || Boolean(row.autoDeactivated)
}

// The printer calls putting the plugins back fine with some of them not back: one left out because a
// plugin it needs did not come back, one its safety net switched off, or one walked past because the
// printer could not read its manifest.
export function somePluginNotPutBack(reapplied: BatchResult): boolean {
  return !reapplied.ok || reapplied.results.some(leftAPluginOff) || Boolean(reapplied.manifestWarnings?.length)
}
