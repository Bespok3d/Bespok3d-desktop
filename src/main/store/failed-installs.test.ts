// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect } from 'vitest'
import type { PluginRecoveryResult } from '@bespok3d/contract'
import type { PrinterRecord } from '../printers'
import { failedLogsAfter, refusalSentence, refusedAttempt } from './failed-installs'
import { PackageRefusedError } from './package-refused'

const ATTEMPTED_AT = 1_750_000_000_000

function printerWith(failedInstallLogs: PrinterRecord['failedInstallLogs']): PrinterRecord {
  return { id: 'printer-1', failedInstallLogs } as PrinterRecord
}

function daemonFailure(pluginId: string): PluginRecoveryResult {
  return {
    pluginId,
    ok: false,
    skipped: false,
    reason: 'the plugin service did not come up',
    log: [{ id: 'apply', label: 'Apply', ok: false, items: [{ label: 'start service', ok: false, output: 'exit 1' }] }],
  }
}

describe('refusalSentence', () => {
  it('shows a refusal without the marker the renderer uses to spot one', () => {
    expect(refusalSentence(new PackageRefusedError('the package served for "camera" contains plugin "spoolman" instead'))).toBe(
      'the package served for "camera" contains plugin "spoolman" instead',
    )
  })

  it('leaves an ordinary failure alone', () => {
    expect(refusalSentence(new Error('bundled plugin not found: ghost-plugin'))).toBe('bundled plugin not found: ghost-plugin')
  })
})

describe('what the printer keeps about a plugin that did not install', () => {
  it('keeps the phases the printer reached, so the user sees where it gave up', () => {
    const kept = failedLogsAfter(printerWith(undefined), [daemonFailure('camera')], [], ATTEMPTED_AT)
    expect(kept.camera.ok).toBe(false)
    expect(kept.camera.timestamp).toBe(ATTEMPTED_AT)
    expect(kept.camera.phases[0].items[0].label).toBe('start service')
  })

  it('keeps the reason as the whole attempt when the package never left this computer', () => {
    const refused = refusedAttempt('camera', 'the package served for "camera" contains plugin "spoolman" instead')
    const kept = failedLogsAfter(printerWith(undefined), [refused], [], ATTEMPTED_AT)
    expect(kept.camera.phases.map((phase) => phase.label)).toEqual(['Package check'])
    expect(kept.camera.phases[0].items[0].output).toMatch(/contains plugin "spoolman"/)
  })

  it('keeps an older failure for a plugin this attempt did not touch', () => {
    const before = failedLogsAfter(printerWith(undefined), [daemonFailure('camera')], [], ATTEMPTED_AT)
    const after = failedLogsAfter(printerWith(before), [refusedAttempt('spoolman', 'refused')], [], ATTEMPTED_AT + 1)
    expect(Object.keys(after).sort()).toEqual(['camera', 'spoolman'])
  })

  it('replaces the older failure of a plugin that failed again', () => {
    const before = failedLogsAfter(printerWith(undefined), [refusedAttempt('camera', 'first reason')], [], ATTEMPTED_AT)
    const after = failedLogsAfter(printerWith(before), [refusedAttempt('camera', 'second reason')], [], ATTEMPTED_AT + 1)
    expect(after.camera.phases[0].items[0].output).toBe('second reason')
  })

  it('drops the failure once that plugin is on the printer', () => {
    const before = failedLogsAfter(printerWith(undefined), [refusedAttempt('camera', 'refused')], [], ATTEMPTED_AT)
    expect(failedLogsAfter(printerWith(before), [], ['camera'], ATTEMPTED_AT + 1)).toEqual({})
  })
})
