// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect } from 'vitest'
import type { AssetInfo } from '../git-host/connector'
import { checkIntervalMs, pickPlatformAsset } from './schedule'

function asset(name: string): AssetInfo {
  return { id: name, name, downloadUrl: `https://example.test/${name}`, downloadCount: 0 }
}

describe('checkIntervalMs', () => {
  it('maps daily and weekly to durations and the rest to null', () => {
    expect(checkIntervalMs('daily')).toBe(24 * 60 * 60 * 1000)
    expect(checkIntervalMs('weekly')).toBe(7 * 24 * 60 * 60 * 1000)
    expect(checkIntervalMs('launch')).toBeNull()
    expect(checkIntervalMs('manual')).toBeNull()
  })
})

describe('pickPlatformAsset', () => {
  const releaseAssets = [
    asset('Bespok3d-0.1.0-alpha.14-arm64.dmg'),
    asset('Bespok3d-0.1.0-alpha.14-x64.dmg'),
    asset('Bespok3d-Setup-0.1.0-alpha.14.exe'),
    asset('Bespok3d-0.1.0-alpha.14.AppImage'),
  ]

  it('picks the dmg matching the arch on macOS', () => {
    expect(pickPlatformAsset(releaseAssets, 'darwin', 'arm64')?.name).toBe('Bespok3d-0.1.0-alpha.14-arm64.dmg')
    expect(pickPlatformAsset(releaseAssets, 'darwin', 'x64')?.name).toBe('Bespok3d-0.1.0-alpha.14-x64.dmg')
  })

  it('picks the exe on Windows and the AppImage on Linux', () => {
    expect(pickPlatformAsset(releaseAssets, 'win32', 'x64')?.name).toBe('Bespok3d-Setup-0.1.0-alpha.14.exe')
    expect(pickPlatformAsset(releaseAssets, 'linux', 'x64')?.name).toBe('Bespok3d-0.1.0-alpha.14.AppImage')
  })

  it('falls back to the first extension match when no arch token is present', () => {
    expect(pickPlatformAsset([asset('Bespok3d.dmg')], 'darwin', 'arm64')?.name).toBe('Bespok3d.dmg')
  })

  it('returns null when no installer matches the platform', () => {
    expect(pickPlatformAsset([asset('notes.txt')], 'darwin', 'arm64')).toBeNull()
    expect(pickPlatformAsset(releaseAssets, 'freebsd', 'x64')).toBeNull()
  })
})
