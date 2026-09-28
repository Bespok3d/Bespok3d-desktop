// SPDX-FileCopyrightText: Copyright (C) 2026 Luciano Colosio
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { APP_CHANNEL, APP_CHANNELS, officialIndexUrl, releaseRepository } from './channel'

const MAIN_PROCESS_SOURCE = readFileSync(join(__dirname, 'index.ts'), 'utf8')

describe('the baked channel table', () => {
  it('keeps app identity and scheme separate while both branches publish the same index file', () => {
    expect(APP_CHANNELS.map(channel => channel.appId)).toEqual([
      'io.bespok3d.app', 'io.bespok3d.app.staging', 'io.bespok3d.app.dev',
    ])
    expect(APP_CHANNELS.map(channel => channel.scheme)).toEqual(['b3d', 'b3d-staging', 'b3d-dev'])
    expect(APP_CHANNELS.map(channel => channel.indexAssets)).toEqual([
      ['index.json'], ['index.json'], ['index.json'],
    ])
    expect(APP_CHANNELS.map(channel => channel.indexBranches)).toEqual([
      ['main'], ['main', 'dev'], ['main', 'dev'],
    ])
  })

  it('selects Staging identity and keeps the current app on the Live index', () => {
    expect(APP_CHANNEL.appName).toBe('Bespok3d')
    expect(APP_CHANNELS[1].productName).toBe('Bespok3d Staging')
    expect(APP_CHANNELS[1].updateChannel).toBe('bespok3d-staging')
    expect(officialIndexUrl(APP_CHANNELS[0])).toBe('github:Bespok3d/main-index/index.json')
    expect(officialIndexUrl(APP_CHANNELS[1])).toBe('github:Bespok3d/main-index/index.json')
    expect(officialIndexUrl(APP_CHANNELS[2])).toBe('github:Bespok3d/main-index/index.json')
  })

  it('routes published app releases through each channel host', () => {
    expect(releaseRepository(APP_CHANNELS[0])).toEqual({ owner: 'Bespok3d', repo: 'Bespok3d-desktop' })
    expect(releaseRepository(APP_CHANNELS[1])).toEqual({ owner: 'Bespok3d', repo: 'Bespok3d-desktop' })
    expect(releaseRepository(APP_CHANNELS[2])).toBeNull()
  })

  it('sets the channel app name before Electron takes the single-instance lock', () => {
    expect(MAIN_PROCESS_SOURCE.indexOf('app.setName(APP_NAME)')).toBeLessThan(
      MAIN_PROCESS_SOURCE.indexOf('app.requestSingleInstanceLock()'),
    )
  })
})
