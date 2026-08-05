// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect } from 'vitest'
import { postOpReboot } from './usePostOpReboot'
import type { EnrollMode } from './index'

describe('which ops reboot the printer when they finish', () => {
  it('holds the screen on the reboot for stopping and restarting the plugins', () => {
    expect(postOpReboot('deactivate', false)).toBe('wait-for-the-printer')
    expect(postOpReboot('reactivate', false)).toBe('wait-for-the-printer')
  })

  it('reboots behind the success screen after bespok3d is removed', () => {
    expect(postOpReboot('uninstall', false)).toBe('reboot-behind-the-success-screen')
  })

  it('never touches a printer that is printing', () => {
    const ops: EnrollMode[] = ['deactivate', 'reactivate', 'uninstall']
    ops.forEach((mode) => expect(postOpReboot(mode, true)).toBe('no-reboot'))
  })

  it('leaves the printer alone after an op that changes nothing it is running', () => {
    const ops: EnrollMode[] = ['enroll', 'repair', 'recovery', 'update-daemon', 'update-jinni', 'reboot', 'history']
    ops.forEach((mode) => expect(postOpReboot(mode, false)).toBe('no-reboot'))
  })
})
