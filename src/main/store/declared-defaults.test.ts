// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect } from 'vitest'
import type { MergedEntry } from '../registry/model'
import { declaredDefaults } from './declared-defaults'

function entryWith(declared: Partial<MergedEntry>): MergedEntry {
  return { name: 'camera-hw-accel', version: '0.1.0', trust: 'project', signer: null, registry_url: '/registry/index.json', ...declared } as MergedEntry
}

describe('declaredDefaults', () => {
  it('writes a toggle default as the text the daemon writes', () => {
    const entry = entryWith({ config: [{ key: 'CAMERA_FREEZE_RECOVERY', type: 'toggle', default: true }] } as Partial<MergedEntry>)

    expect(declaredDefaults(entry)).toEqual({ CAMERA_FREEZE_RECOVERY: 'true' })
  })

  it('leaves out a required setting, whose default is only a placeholder', () => {
    const entry = entryWith({
      config: [{ key: 'SPOOLMAN_SERVER', type: 'text', default: 'http://spoolman.example' }],
      requires: { variables: [{ name: 'SPOOLMAN_SERVER', required: true }] },
    } as Partial<MergedEntry>)

    expect(declaredDefaults(entry)).toEqual({})
  })

  it('keeps the camera toggle default as the manifest writes it', () => {
    const entry = entryWith({ config: [{ key: 'CAMERA_FREEZE_RECOVERY', type: 'toggle', onValue: '1', offValue: '0', default: '1' }] } as Partial<MergedEntry>)

    expect(declaredDefaults(entry)).toEqual({ CAMERA_FREEZE_RECOVERY: '1' })
  })

  it('counts any truthy required flag as required, the way the daemon does', () => {
    const entry = entryWith({
      config: [{ key: 'MQTT_TOPIC', type: 'text', default: 'your-topic' }],
      requires: { variables: [{ name: 'MQTT_TOPIC', required: 1 }] },
    } as Partial<MergedEntry>)

    expect(declaredDefaults(entry)).toEqual({})
  })

  it('lets a declared variable default win over the config field default', () => {
    const entry = entryWith({
      config: [{ key: 'PORT', type: 'text', default: '7125' }],
      requires: { variables: [{ name: 'PORT', default: 8080 }] },
    } as Partial<MergedEntry>)

    expect(declaredDefaults(entry)).toEqual({ PORT: '8080' })
  })

  it('skips a field without a default and a config that is not a list', () => {
    expect(declaredDefaults(entryWith({ config: [{ key: 'PORT', type: 'text' }] } as Partial<MergedEntry>))).toEqual({})
    expect(declaredDefaults(entryWith({ config: 'broken' } as unknown as Partial<MergedEntry>))).toEqual({})
  })
})
