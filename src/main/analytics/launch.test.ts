// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// The launch event is the one number this whole feature exists to produce, and it is sent from the
// app's own start-up, which no unit test can drive: importing the main entry point boots Electron.
// So this reads the entry point as text, the way plugin-invariants.test.ts already does for the
// invariants it cannot execute. It proves the wiring is present and in the right order, and it fails
// the day someone moves the call out of start-up or drops it.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const mainEntry = readFileSync(join(__dirname, '../index.ts'), 'utf-8')

describe('the launch event', () => {
  it('is sent from the app start, so one run counts exactly once', () => {
    expect(mainEntry).toContain("reportEvent('app_launched', {})")
  })

  it('is sent after reporting has been started, or it would be dropped by its own gate', () => {
    expect(mainEntry.indexOf('startAnalytics({')).toBeLessThan(mainEntry.indexOf("reportEvent('app_launched'"))
  })

  it('sits inside the single-instance guard, so a second launch of a running app counts nothing', () => {
    const readyBlock = mainEntry.slice(mainEntry.indexOf('app.whenReady()'))

    expect(readyBlock.indexOf('if (!gotSingleInstanceLock) return')).toBeLessThan(readyBlock.indexOf("reportEvent('app_launched'"))
  })
})

describe('a break in the main process', () => {
  it('is watched for, not handled, so a run that used to end still ends', () => {
    expect(mainEntry).toContain("process.on('uncaughtExceptionMonitor', reportCrashToUsage)")
    expect(mainEntry).not.toContain("process.on('uncaughtException'")
  })

  it('is watched by one listener, so a broken promise is not counted twice', () => {
    expect(mainEntry).not.toContain("process.on('unhandledRejection'")
  })

  it('is being watched for before any window exists, so nothing can break unheard', () => {
    expect(mainEntry.indexOf('uncaughtExceptionMonitor')).toBeLessThan(mainEntry.indexOf('createWindow(createSplash'))
  })
})
