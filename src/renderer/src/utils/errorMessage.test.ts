// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect } from 'vitest'
import { errorMessage, mainProcessMessage } from './errorMessage'

describe('errorMessage', () => {
  it('returns the message of an Error without the "Error:" prefix', () => {
    expect(errorMessage(new Error('disk full'))).toBe('disk full')
  })

  it('passes a thrown string through unchanged', () => {
    expect(errorMessage('plain failure')).toBe('plain failure')
  })

  it('coerces a non-Error, non-string value', () => {
    expect(errorMessage(404)).toBe('404')
    expect(errorMessage(null)).toBe('null')
  })

  it('reads the message of an Error subclass', () => {
    class TimeoutError extends Error {}
    expect(errorMessage(new TimeoutError('timed out'))).toBe('timed out')
  })
})

describe('mainProcessMessage', () => {
  it('drops the IPC wrapper so the user reads the sentence the main process wrote', () => {
    const thrown = new Error("Error invoking remote method 'store:update-batch': Error: The printer is busy: this would restart klipper, interrupting the print. Try again when it is idle.")

    expect(mainProcessMessage(thrown)).toBe('The printer is busy: this would restart klipper, interrupting the print. Try again when it is idle.')
  })

  it('drops the wrapper around an Error subclass name too', () => {
    expect(mainProcessMessage(new Error("Error invoking remote method 'store:recover': DaemonHttpError: daemon unreachable"))).toBe('daemon unreachable')
  })

  it('leaves a message that never crossed IPC alone', () => {
    expect(mainProcessMessage(new Error('The printer is busy: try again when it is idle.'))).toBe('The printer is busy: try again when it is idle.')
  })
})
