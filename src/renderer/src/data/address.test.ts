// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { cleanServiceAddress, configAddressError, serviceAddress, serviceAddressError } from './address'
import { withExplicitScope } from './plugin-config'
import type { PluginConfigField } from './types'

describe('serviceAddress', () => {
  it('reads the host and port out of a pasted browser link', () => {
    expect(serviceAddress('http://192.168.1.50:8000/spoolman/')).toEqual({ host: '192.168.1.50', port: 8000 })
  })

  it('keeps 443 for an https link that never wrote its port', () => {
    expect(serviceAddress('https://spoolman.example')).toEqual({ host: 'spoolman.example', port: 443 })
  })

  it('reads a bare host as the plain web port', () => {
    expect(serviceAddress('spoolman.example')).toEqual({ host: 'spoolman.example', port: 80 })
  })

  it('reads a bracketed IPv6 address with a port', () => {
    expect(serviceAddress('[fd00::1]:7912')).toEqual({ host: '[fd00::1]', port: 7912 })
  })

  it('reports nothing for a value that is not an address at all', () => {
    expect(serviceAddress('not an address')).toBeNull()
  })
})

describe('cleanServiceAddress', () => {
  it('turns what people actually paste into what the plugin asks for', () => {
    expect(cleanServiceAddress('  http://192.168.1.50:8000/spoolman/  ')).toBe('192.168.1.50:8000')
  })

  it('drops the plain web port because a bare host already means it', () => {
    expect(cleanServiceAddress('http://spoolman.example/')).toBe('spoolman.example')
  })

  it('keeps a value it cannot read, so typing is never thrown away', () => {
    expect(cleanServiceAddress('  not an address  ')).toBe('not an address')
  })
})

describe('serviceAddressError', () => {
  it('says nothing about an empty field, which the required flag owns', () => {
    expect(serviceAddressError('   ')).toBeNull()
  })

  it('names an unusable address', () => {
    expect(serviceAddressError('not an address')).toBe('store.address_unusable')
  })
})

describe('configAddressError', () => {
  const fields: PluginConfigField[] = [
    { key: 'SPOOLMAN_SERVER', label: 'Server', type: 'address', scope: 'global' },
    { key: 'NOTE', label: 'Note', type: 'text', scope: 'global' },
  ]

  it('finds the unusable address in a filled-in form', () => {
    expect(configAddressError(fields, { SPOOLMAN_SERVER: 'not an address', NOTE: 'also not' }))
      .toBe('store.address_unusable')
  })

  it('passes a form whose address is usable', () => {
    expect(configAddressError(fields, { SPOOLMAN_SERVER: '192.168.1.50:8000' })).toBeNull()
  })
})

describe('withExplicitScope', () => {
  it('marks a server field as an address, since published manifests only ever say text', () => {
    const field = withExplicitScope({ key: 'SPOOLMAN_SERVER', label: 'Server', type: 'text' })

    expect(field.type).toBe('address')
  })

  it('leaves a whole-URL field alone, because cleaning an Apprise URL would break it', () => {
    const field = withExplicitScope({ key: 'APPRISE_URL', label: 'Apprise URL', type: 'text' })

    expect(field.type).toBe('text')
  })
})
