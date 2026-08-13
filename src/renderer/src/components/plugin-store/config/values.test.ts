// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect } from 'vitest'
import type { PluginConfigField } from '../../../data/types'
import { configComplete, initialConfigValues, missingRequiredFields } from './values'

// A manifest is JSON and the printer reports its saved vars as JSON, so a `number` field's default
// and its reported value both arrive as a real number however the declared string type reads. These
// fixtures are parsed rather than written out so they stay as untyped as the wire is: that gap is
// the bug, and a hand-typed fixture would hide it.
const MANIFEST_FIELDS: PluginConfigField[] = JSON.parse(`[
  { "key": "listen_port", "label": "Listen port", "type": "number", "scope": "global",
    "required": true, "default": 7125 },
  { "key": "spoolman_url", "label": "Spoolman address", "type": "text", "scope": "global",
    "required": true }
]`)

const REPORTED_VARS: Record<string, string> = JSON.parse(
  '{ "listen_port": 8080, "spoolman_url": "http://spoolman.example:7912" }',
)

describe('a setting the manifest declares as a number', () => {
  it('lets the settings screen offer Install instead of throwing', () => {
    const values = initialConfigValues(MANIFEST_FIELDS, { spoolman_url: 'http://spoolman.example:7912' })

    expect(values.listen_port).toBe('7125')
    expect(configComplete(MANIFEST_FIELDS, values)).toBe(true)
    expect(missingRequiredFields(MANIFEST_FIELDS, values)).toEqual([])
  })

  it('still names a required setting that is left empty', () => {
    const values = initialConfigValues(MANIFEST_FIELDS, undefined)

    expect(configComplete(MANIFEST_FIELDS, values)).toBe(false)
    expect(missingRequiredFields(MANIFEST_FIELDS, values)).toEqual(['Spoolman address'])
  })

  it('reopens reconfigure on the number the printer reports', () => {
    const values = initialConfigValues(MANIFEST_FIELDS, REPORTED_VARS)

    expect(values.listen_port).toBe('8080')
    expect(configComplete(MANIFEST_FIELDS, values)).toBe(true)
  })
})
