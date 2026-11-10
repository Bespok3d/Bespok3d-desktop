// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { existsSync, readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { describe, it, expect } from 'vitest'
import { PRINTER_SETUP_ROW, isSetupRepairOnly } from './setup-repair'

const DAEMON_SETUP_REPAIR = fileURLToPath(new URL('../../../../../../daemon/core/packages/setup_repair.py', import.meta.url))

function resultRow(pluginId: string) {
  return { pluginId, ok: true, skipped: false, reason: '', log: [] }
}

describe('the printer setup row', () => {
  it.skipIf(!existsSync(DAEMON_SETUP_REPAIR))('is the exact id the daemon reports the setup repair under', () => {
    expect(readFileSync(DAEMON_SETUP_REPAIR, 'utf-8')).toContain(`PRINTER_SETUP_ID = "${PRINTER_SETUP_ROW}"`)
  })

  it('marks a result that holds the setup row and nothing else', () => {
    expect(isSetupRepairOnly([resultRow(PRINTER_SETUP_ROW)])).toBe(true)
    expect(isSetupRepairOnly([resultRow(PRINTER_SETUP_ROW), resultRow('spoolman')])).toBe(false)
    expect(isSetupRepairOnly([])).toBe(false)
  })
})
