// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect } from 'vitest'
import { parseB3dUrl } from './url'

describe('parseB3dUrl entities', () => {
  it('parses the canonical user@githost/item publisher form', () => {
    expect(parseB3dUrl('b3d://lucio@github/webcam-builtin')).toEqual({ kind: 'entity', publisher: 'lucio@github', name: 'webcam-builtin' })
  })

  it('parses the legacy free-string publisher form still live in descriptions', () => {
    expect(parseB3dUrl('b3d://bespok3d-org/webcam-builtin')).toEqual({ kind: 'entity', publisher: 'bespok3d-org', name: 'webcam-builtin' })
  })

  it('rejects an entity with no item name', () => {
    expect(parseB3dUrl('b3d://bespok3d-org/')).toMatchObject({ kind: 'unknown' })
  })
})

describe('parseB3dUrl reserved actions', () => {
  it('parses a registry-add with its url query', () => {
    expect(parseB3dUrl('b3d://registry/add?url=https%3A%2F%2Fx.com%2Fi.json')).toEqual({ kind: 'registry-add', url: 'https://x.com/i.json' })
  })

  it('treats a registry-add with no url as unknown', () => {
    expect(parseB3dUrl('b3d://registry/add')).toMatchObject({ kind: 'unknown' })
  })

  it('parses a printer fingerprint', () => {
    expect(parseB3dUrl('b3d://printer/AB12CD')).toEqual({ kind: 'printer', fingerprint: 'AB12CD' })
  })

  it('parses an auth callback with its query params', () => {
    expect(parseB3dUrl('b3d://auth/callback?code=xyz&state=abc')).toEqual({ kind: 'auth-callback', params: { code: 'xyz', state: 'abc' } })
  })

  it('does not let a reserved host hijack a real publisher that carries userinfo', () => {
    expect(parseB3dUrl('b3d://me@auth/some-plugin')).toEqual({ kind: 'entity', publisher: 'me@auth', name: 'some-plugin' })
  })
})

describe('parseB3dUrl rejects non-b3d input', () => {
  it('returns unknown for another scheme', () => {
    expect(parseB3dUrl('https://example.com/x')).toMatchObject({ kind: 'unknown' })
  })

  it('returns unknown for unparseable input', () => {
    expect(parseB3dUrl('not a url')).toMatchObject({ kind: 'unknown' })
  })
})
