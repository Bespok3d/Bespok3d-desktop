// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect } from 'vitest'
import { isOpCompleted } from './pluginOps'

// The dropped-but-completed re-verify decision (Bug from the USB-camera-uninstall screenshot): when an
// op request drops after the daemon finished, the live installed set tells us the op actually succeeded,
// so the app must not report "your printer was not changed".
describe('isOpCompleted', () => {
  it('treats an uninstall as done when the plugin is no longer installed', () => {
    expect(isOpCompleted('uninstall', ['spoolman'], 'webcam-usb')).toBe(true)
  })

  it('treats an uninstall as NOT done while the plugin is still installed', () => {
    expect(isOpCompleted('uninstall', ['webcam-usb', 'spoolman'], 'webcam-usb')).toBe(false)
  })

  it('treats an install as done when the plugin is now installed', () => {
    expect(isOpCompleted('install', ['webcam-usb'], 'webcam-usb')).toBe(true)
  })

  it('treats an install as NOT done when the plugin is absent', () => {
    expect(isOpCompleted('install', ['spoolman'], 'webcam-usb')).toBe(false)
  })
})
