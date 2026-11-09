// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { PluginRecoveryResult } from '@bespok3d/contract'

// The row a repair of the printer's own setup reports under. It is not a plugin, so the app gives it
// a name and offers no plugin page for it. The daemon reports this exact id (PRINTER_SETUP_ID in
// core/packages/setup_repair.py), and setup-repair.test.ts fails when the two drift apart.
export const PRINTER_SETUP_ROW = '(printer setup)'

// A recovery that only put the printer's setup right and put no plugin back.
export function isSetupRepairOnly(results: readonly PluginRecoveryResult[]): boolean {
  return results.length > 0 && results.every((pluginResult) => pluginResult.pluginId === PRINTER_SETUP_ROW)
}
