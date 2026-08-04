// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect } from 'vitest'
import { serviceUrlError, typedScheme, withScheme } from './service-url'

describe('an address typed whole, protocol and all', () => {
  it('is usable as it stands and nothing about it is rewritten', () => {
    expect(serviceUrlError('https://spoolman.example.org/')).toBeNull()
    expect(typedScheme('https://spoolman.example.org/')).toBe('https')
  })

  it('is usable with a port and a path, which the service is entitled to want', () => {
    expect(serviceUrlError('http://192.0.2.50:8000/spoolman/')).toBeNull()
  })

  it('asks for a protocol when there is none, rather than picking one for the person', () => {
    expect(serviceUrlError('192.0.2.50:8000')).toBe('store.address_pick_scheme')
    expect(serviceUrlError('spoolman.example.org')).toBe('store.address_pick_scheme')
    expect(typedScheme('192.0.2.50:8000')).toBeNull()
  })

  it('is named unusable when it carries a protocol nothing here speaks', () => {
    expect(serviceUrlError('ftp://spoolman.example.org')).toBe('store.address_unusable')
  })

  it('is named unusable when it cannot be read as an address at all', () => {
    expect(serviceUrlError('my spoolman server')).toBe('store.address_unusable')
    expect(serviceUrlError('https://')).toBe('store.address_unusable')
  })

  it('leaves an empty field to the required flag, which is whose business that is', () => {
    expect(serviceUrlError('  ')).toBeNull()
  })
})

describe('choosing a protocol for an address', () => {
  it('puts it in front and moves nothing else', () => {
    expect(withScheme('192.0.2.50:8000', 'https')).toBe('https://192.0.2.50:8000')
    expect(withScheme('spoolman.example.org/db', 'http')).toBe('http://spoolman.example.org/db')
  })

  it('replaces the one already there rather than stacking a second', () => {
    expect(withScheme('http://spoolman.example.org', 'https')).toBe('https://spoolman.example.org')
  })
})
