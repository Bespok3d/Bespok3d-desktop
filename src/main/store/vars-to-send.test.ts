// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect } from 'vitest'
import { varsToSend } from './vars-to-send'

describe('varsToSend', () => {
  it('keeps the app value for a key both hold', () => {
    expect(varsToSend({ PORT: '8080' }, { PORT: '7125' }, {})).toEqual({ PORT: '8080' })
  })

  it('takes a key only the printer holds', () => {
    expect(varsToSend({ PORT: '8080' }, { SPOOLMAN_SERVER: 'http://spoolman.example' }, {})).toEqual({ PORT: '8080', SPOOLMAN_SERVER: 'http://spoolman.example' })
  })

  it('takes the printer values when the app holds none', () => {
    expect(varsToSend(undefined, { PORT: '7125' }, {})).toEqual({ PORT: '7125' })
  })

  it('fills a setting nobody holds with the manifest default', () => {
    expect(varsToSend({ PORT: '8080' }, {}, { CAMERA_FREEZE_RECOVERY: 'true' })).toEqual({ PORT: '8080', CAMERA_FREEZE_RECOVERY: 'true' })
  })

  it('never lets a default replace a saved or app value', () => {
    const defaults = { PORT: '7125', CAMERA_FREEZE_RECOVERY: 'true' }

    expect(varsToSend({ PORT: '8080' }, { CAMERA_FREEZE_RECOVERY: 'false' }, defaults)).toEqual({ PORT: '8080', CAMERA_FREEZE_RECOVERY: 'false' })
  })

  it('sends no defaults to a printer that would not answer', () => {
    expect(varsToSend({ PORT: '8080' }, 'unreadable', { CAMERA_FREEZE_RECOVERY: 'true' })).toEqual({ PORT: '8080' })
  })
})
