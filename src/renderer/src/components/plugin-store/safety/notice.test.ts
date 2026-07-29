// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'

import { autoRecoveryNotice } from './notice'

function item(label: string, ok = false): InstallLogItem {
  return { label, ok, output: '' }
}

function phase(id: string, items: InstallLogItem[]): InstallLogPhase {
  return { id, label: id, ok: items.every((entry) => entry.ok), items }
}

function log(pluginId: string, phases: InstallLogPhase[]): InstallLog {
  return { pluginId, timestamp: 0, ok: phases.every((entry) => entry.ok), phases }
}

describe('autoRecoveryNotice', () => {
  it('surfaces the fact + captured log when a fixer disabled the plugin', () => {
    const recoveryItem: InstallLogItem = {
      label: 'moonraker-notify was disabled to keep the printer working',
      ok: false,
      output: 'Traceback ... ModuleNotFoundError: apprise',
    }
    const result = autoRecoveryNotice(log('moonraker-notify', [
      phase('restart', [item('restart', true)]),
      { id: 'auto-recovery', label: 'auto-recovery', ok: false, items: [recoveryItem] },
    ]))
    expect(result).toEqual({
      pluginId: 'moonraker-notify',
      detail: 'moonraker-notify was disabled to keep the printer working',
      log: 'Traceback ... ModuleNotFoundError: apprise',
    })
  })

  it('returns null when no fixer kicked in', () => {
    expect(autoRecoveryNotice(log('cpu-temp', [phase('restart', [item('restart', true)])]))).toBeNull()
  })

  it('returns null without a log', () => {
    expect(autoRecoveryNotice(undefined)).toBeNull()
  })
})
