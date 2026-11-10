// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { installB3d } from '../../test/b3d-mock'
import { makeAdapterInfo, makePrinter } from '../../test/fixtures'
import { loginFor, readPrinterLogin } from './login'

var factoryAdapter = makeAdapterInfo({ defaults: { sshUser: 'root', sshPort: 2222, sshPasswordHint: 'factory-secret', runtimeUser: 'lava' } })

describe('the login the app uses for a printer', () => {
  it('is the factory login of its adapter', () => {
    expect(loginFor(makePrinter(), factoryAdapter)).toEqual({
      source: 'factory', credentials: { user: 'root', password: 'factory-secret', port: 2222 },
    })
  })

  it('is their own login, never the factory one, when the printer has one', () => {
    expect(loginFor(makePrinter({ customSshCredentials: true }), factoryAdapter)).toEqual({ source: 'their-own' })
  })

  it('is missing when the app has no adapter for the printer', () => {
    expect(loginFor(makePrinter(), null)).toEqual({ source: 'adapter-missing' })
  })

  it('reads the adapter only when its login is the one to use', async () => {
    var { b3d } = installB3d({ printers: { adapterGet: vi.fn().mockResolvedValue(factoryAdapter) } })

    expect(await readPrinterLogin(makePrinter({ customSshCredentials: true }))).toEqual({ source: 'their-own' })
    expect(b3d.printers.adapterGet).not.toHaveBeenCalled()
    expect(await readPrinterLogin(makePrinter({ adapter: 'snapmaker-u1' }))).toMatchObject({ source: 'factory' })
    expect(b3d.printers.adapterGet).toHaveBeenCalledWith('snapmaker-u1')
  })
})
