// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { BrowserWindow } from 'electron'

type IpcListener = (...args: unknown[]) => unknown

const registeredHandlers = new Map<string, IpcListener>()

function fakeHandle(channel: string, listener: IpcListener): void {
  registeredHandlers.set(channel, listener)
}

const hoisted = vi.hoisted(() => ({
  managedRecord: { id: 'printer-1', ip: '192.0.2.5', daemonToken: 'T', daemonCert: 'C' },
}))
vi.mock('electron', () => ({ ipcMain: { handle: fakeHandle } }))
vi.mock('./status', () => ({ getManagedRecord: vi.fn(() => hoisted.managedRecord) }))
vi.mock('./feeds/active-watch', () => ({ watchActiveWatch: vi.fn(), unwatchActiveWatch: vi.fn() }))
vi.mock('./active-watch-client', () => ({ fetchActiveWatchSetting: vi.fn(), saveActiveWatchSetting: vi.fn() }))

import { registerActiveWatchHandlers } from './active-watch-ipc'
import { watchActiveWatch } from './feeds/active-watch'
import { saveActiveWatchSetting } from './active-watch-client'

const STUCK_EVENT = { printerId: 'printer-1', token: 'screen-stuck', remedy: 'notify' as const }

function windowThatIs(destroyed: boolean) {
  const send = vi.fn()
  const window = { isDestroyed: () => destroyed, webContents: { send } } as unknown as BrowserWindow

  return { window, send }
}

function frameSentTo(destroyed: boolean) {
  const { window, send } = windowThatIs(destroyed)
  registerActiveWatchHandlers(() => window)
  registeredHandlers.get('printers:watchActiveWatch')?.({}, 'printer-1')
  const deliver = vi.mocked(watchActiveWatch).mock.calls[0][1]
  deliver(STUCK_EVENT)

  return send
}

beforeEach(() => {
  registeredHandlers.clear()
  vi.clearAllMocks()
})

describe('the active-watch door', () => {
  it('passes each frame of the printer feed on to the window', () => {
    expect(frameSentTo(false)).toHaveBeenCalledWith('printer:activeWatch', STUCK_EVENT)
  })

  it('drops a frame once the window is closed', () => {
    expect(frameSentTo(true)).not.toHaveBeenCalled()
  })

  it('saves the setting on the managed printer it belongs to', () => {
    const setting = { enabled: true, files: ['/dev/kmsg'], remedies: {} }
    registerActiveWatchHandlers(() => windowThatIs(false).window)
    registeredHandlers.get('printers:saveActiveWatchSetting')?.({}, 'printer-1', setting)
    expect(saveActiveWatchSetting).toHaveBeenCalledWith(hoisted.managedRecord, setting)
  })
})
