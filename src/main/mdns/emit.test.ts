// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect, vi } from 'vitest'
import type { BrowserWindow } from 'electron'
import { emitDiscovered } from './emit'
import type { DiscoveredPrinterRecord } from './types'

const sampleRecord: DiscoveredPrinterRecord = {
  id: 'mdns-printer.local',
  host: 'printer.local',
  ip: '192.168.1.50',
  model: 'Snapmaker U1',
  vendor: 'Snapmaker',
  service: '_http._tcp',
}

function fakeWindow(destroyed: boolean): { win: BrowserWindow; send: ReturnType<typeof vi.fn> } {
  const send = vi.fn()
  const win = { isDestroyed: () => destroyed, webContents: { send } } as unknown as BrowserWindow

  return { win, send }
}

describe('emitDiscovered', () => {
  it('sends the record to a live window', () => {
    const { win, send } = fakeWindow(false)
    emitDiscovered(win, sampleRecord)
    expect(send).toHaveBeenCalledWith('mdns:found', sampleRecord)
  })

  it('drops the record when the window has been destroyed', () => {
    const { win, send } = fakeWindow(true)
    emitDiscovered(win, sampleRecord)
    expect(send).not.toHaveBeenCalled()
  })
})
