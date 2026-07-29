// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect } from 'vitest'
import { parseEntityRef, isB3dUrl } from './b3d-ref'

describe('parseEntityRef', () => {
  it('parses publisher and name', () => {
    expect(parseEntityRef('b3d://bespok3d/octoeverywhere')).toEqual({
      publisher: 'bespok3d',
      name: 'octoeverywhere',
      tab: undefined,
    })
  })

  it('parses a user@githost publisher', () => {
    const ref = parseEntityRef('b3d://alice@github/my-plugin')
    expect(ref?.publisher).toBe('alice@github')
    expect(ref?.name).toBe('my-plugin')
  })

  it('captures a tab from the url fragment', () => {
    expect(parseEntityRef('b3d://bespok3d/octoeverywhere#captured')).toEqual({
      publisher: 'bespok3d',
      name: 'octoeverywhere',
      tab: 'captured',
    })
  })

  it('rejects the reserved action hosts and malformed refs', () => {
    expect(parseEntityRef('b3d://registry/add')).toBeNull()
    expect(parseEntityRef('b3d://printer/abc')).toBeNull()
    expect(parseEntityRef('b3d://bespok3d')).toBeNull()
    expect(parseEntityRef('https://example.com')).toBeNull()
  })

  it('isB3dUrl only matches the b3d scheme', () => {
    expect(isB3dUrl('b3d://x/y')).toBe(true)
    expect(isB3dUrl('https://x')).toBe(false)
  })
})
