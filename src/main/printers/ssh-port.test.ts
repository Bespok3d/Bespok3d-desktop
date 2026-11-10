// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../adapter-loader', () => ({ getAdapter: vi.fn() }))
vi.mock('./probe', () => ({ checkSshOpen: vi.fn().mockResolvedValue(false) }))
vi.mock('./store', () => ({ loadPrinters: vi.fn().mockReturnValue([]) }))

import { sshPortOf, sshLoginAnswers } from './ssh-port'
import { getAdapter } from '../adapter-loader'
import { checkSshOpen } from './probe'
import { loadPrinters } from './store'

const FACTORY_LOGIN_PRINTER = { id: 'fixture-printer', adapter: 'fixture-adapter' }
const OWN_LOGIN_PRINTER = { ...FACTORY_LOGIN_PRINTER, customSshCredentials: true }

function adapterSshPortIs(sshPort: number): void {
  vi.mocked(getAdapter).mockReturnValue({ defaults: { sshPort } } as never)
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getAdapter).mockReturnValue(undefined)
})

describe('sshPortOf', () => {
  it('uses the adapter port for a printer on its factory login', () => {
    adapterSshPortIs(2222)
    expect(sshPortOf(FACTORY_LOGIN_PRINTER)).toBe(2222)
  })

  it('uses the port saved at enrollment for a printer on the owner login, not the adapter port', () => {
    adapterSshPortIs(2222)
    expect(sshPortOf({ ...OWN_LOGIN_PRINTER, sshPort: 2200 })).toBe(2200)
  })

  it('falls back to the standard port when nothing names another', () => {
    expect(sshPortOf(FACTORY_LOGIN_PRINTER)).toBe(22)
  })
})

describe('sshLoginAnswers', () => {
  it('asks the printer on its own SSH port', async () => {
    adapterSshPortIs(2222)
    vi.mocked(loadPrinters).mockReturnValue([FACTORY_LOGIN_PRINTER as never])
    await sshLoginAnswers('fixture-printer', '192.0.2.40')
    expect(checkSshOpen).toHaveBeenCalledWith('192.0.2.40', 2222)
  })

  it('lets an owner login with no saved port through, since the login form tests that port itself', async () => {
    vi.mocked(loadPrinters).mockReturnValue([OWN_LOGIN_PRINTER as never])
    expect(await sshLoginAnswers('fixture-printer', '192.0.2.40')).toBe(true)
    expect(checkSshOpen).not.toHaveBeenCalled()
  })

  it('asks on the standard port for a printer this computer has not saved', async () => {
    await sshLoginAnswers('fixture-unknown', '192.0.2.40')
    expect(checkSshOpen).toHaveBeenCalledWith('192.0.2.40', 22)
  })
})
