// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import type { BatchResult } from '../../../../main/daemon-client/batch-result'
import { buildBatchReport } from './report-text'

describe('copied batch report', () => {
  it('includes failed steps and printer output without burying them in successful steps', () => {
    const batch: BatchResult = {
      ok: false,
      results: [
        { pluginId: 'rfid-anycubic', ok: true, skipped: false, reason: '', log: [] },
        {
          pluginId: 'rfid-creality', ok: false, skipped: false, reason: 'update phase failed',
          log: [
            { id: 'extract', label: 'Unpack', ok: true, items: [{ label: 'Extracted files', ok: true, output: '' }] },
            { id: 'patches', label: 'Patches', ok: false, items: [
              { label: 'patch rfid.py', ok: false, output: 'Hunk failed\nexpected context not found' },
              { label: 'patch reader.py', ok: true, output: 'Applied' },
            ] },
          ],
        },
      ],
    }

    const report = buildBatchReport('update', batch)

    expect(report).toContain('- rfid-anycubic: ok\n- rfid-creality: failed: update phase failed')
    expect(report).toContain('  - Patches: patch rfid.py\n    Hunk failed\n    expected context not found')
    expect(report).not.toContain('Extracted files')
    expect(report).not.toContain('patch reader.py')
  })

  it('retains the printer reason when the failed result has no phase details', () => {
    const batch: BatchResult = {
      ok: false,
      results: [{ pluginId: 'rfid-creality', ok: false, skipped: false, reason: 'package refused', log: [] }],
    }

    expect(buildBatchReport('update', batch)).toContain('- rfid-creality: failed: package refused')
  })
})
