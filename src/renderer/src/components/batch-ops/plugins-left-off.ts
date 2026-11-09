// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { PluginRecoveryResult } from '@bespok3d/contract'

// The printer's safety net reports the plugins it switched off on its own services row, which is ok
// once the printer works again, so a row being ok does not mean nothing was switched off.
export function leftAPluginOff(row: PluginRecoveryResult): boolean {
  return !row.ok || Boolean(row.autoDeactivated)
}
