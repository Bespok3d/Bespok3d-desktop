// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect } from 'vitest'
import { DaemonHttpError } from './transport'
import { daemonGuardMessage } from './guard'
import { MALFORMED_PACKAGE_PREFIX } from '../store/malformed-package'

describe('daemonGuardMessage', () => {
  it('reads a required-service 409 into a line naming the missing service', () => {
    const error = new DaemonHttpError(409, { error: 'requirement', plugin_id: 'zerotier', missing: ['tun'] }, 'daemon 409')

    expect(daemonGuardMessage(error)).toBe('Requires a plugin that provides: tun')
  })

  it('joins several missing services', () => {
    const error = new DaemonHttpError(409, { error: 'requirement', missing: ['tun', 'spoolman'] }, 'daemon 409')

    expect(daemonGuardMessage(error)).toBe('Requires a plugin that provides: tun, spoolman')
  })

  it('still maps a conflict 409 unchanged', () => {
    const error = new DaemonHttpError(409, { error: 'conflict', conflicts: ['force-bed-mesh'] }, 'daemon 409')

    expect(daemonGuardMessage(error)).toBe('Conflicts with installed plugin(s): force-bed-mesh')
  })

  it('encodes an integrity 409 as a malformed-package message carrying the reason token and offending paths', () => {
    const offending = 'files/site-packages/foo/__pycache__/bar.cpython-311.pyc'
    const error = new DaemonHttpError(409, { error: 'integrity', plugin_id: 'moonraker-notify', reason: 'undeclared_member', paths: [offending] }, 'daemon 409')
    const message = daemonGuardMessage(error)

    expect(message).toContain(MALFORMED_PACKAGE_PREFIX)
    expect(message).toContain('undeclared_member')
    expect(message).toContain(offending)
  })

  // The daemon relays which half is behind as a token and never as prose, so the sentence the user
  // reads has to be built here or he is shown a raw JSON body for a printer he can actually fix.
  it('names the half to update when the printer\'s two halves do not fit together', () => {
    const error = new DaemonHttpError(409, { error: 'incompatible_pair', side: 'jinni', required: '0.1.7', running: '0.1.5' }, 'daemon 409')
    const message = daemonGuardMessage(error)

    expect(message).toContain('adapter (jinni)')
    expect(message).toContain('0.1.5')
    expect(message).toContain('0.1.7')
    expect(message).toContain('Nothing was installed')
  })

  it('names a side it has never heard of rather than showing a blank instruction', () => {
    const error = new DaemonHttpError(409, { error: 'incompatible_pair', side: 'toolhead-firmware', required: '2.0', running: '1.0' }, 'daemon 409')

    expect(daemonGuardMessage(error)).toContain('toolhead-firmware')
  })

  it('returns null for a non-daemon error so it propagates', () => {
    expect(daemonGuardMessage(new Error('socket hang up'))).toBeNull()
  })
})
