// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { installB3d } from '../../test/b3d-mock'
import { makePrinter, makeAdapterInfo } from '../../test/fixtures'
import { appRestartsItself, restartAfterReapply, restartSecondsOf } from './restart-after-reapply'

describe('the printer is restarted once its plugins are back on it', () => {
  it('restarts it on the login the adapter ships, without asking the user for anything', async () => {
    const reboot = vi.fn().mockResolvedValue(undefined)
    const adapterGet = vi.fn().mockResolvedValue(makeAdapterInfo({ defaults: { sshUser: 'root', sshPort: 22, sshPasswordHint: 'the-printer-password', runtimeUser: 'lava' } }))
    installB3d({ printers: { reboot, adapterGet } })
    const markExpectedRestart = vi.fn()
    const askForTheirLogin = vi.fn()

    const restarting = await restartAfterReapply(makePrinter(), markExpectedRestart, askForTheirLogin)

    expect(reboot).toHaveBeenCalledWith('printer-1', '192.0.2.1', 'root', 'the-printer-password', 22)
    expect(askForTheirLogin).not.toHaveBeenCalled()
    expect(restarting).toBe(true)
  })

  it('tells the app to expect it off the network, so it is not shown as offline while it comes back', async () => {
    installB3d({})
    const markExpectedRestart = vi.fn()

    await restartAfterReapply(makePrinter(), markExpectedRestart, vi.fn())

    expect(markExpectedRestart).toHaveBeenCalledWith('printer-1')
  })

})

describe('a printer the app cannot restart on its own', () => {
  it('asks a printer with the user own login for it, instead of failing to log in unattended', async () => {
    const reboot = vi.fn().mockResolvedValue(undefined)
    installB3d({ printers: { reboot } })
    const askForTheirLogin = vi.fn()

    const restarting = await restartAfterReapply(makePrinter({ customSshCredentials: true }), vi.fn(), askForTheirLogin)

    expect(askForTheirLogin).toHaveBeenCalledWith('printer-1')
    expect(reboot).not.toHaveBeenCalled()
    expect(restarting).toBe(false)
  })

  it('asks for the login when the adapter is gone, rather than restarting on a guessed one', async () => {
    const reboot = vi.fn().mockResolvedValue(undefined)
    const adapterGet = vi.fn().mockResolvedValue(null)
    installB3d({ printers: { reboot, adapterGet } })
    const askForTheirLogin = vi.fn()

    const restarting = await restartAfterReapply(makePrinter(), vi.fn(), askForTheirLogin)

    expect(askForTheirLogin).toHaveBeenCalledWith('printer-1')
    expect(reboot).not.toHaveBeenCalled()
    expect(restarting).toBe(false)
  })

  it('hands a printer that refused the restart to the window that asks for its login, and says so', async () => {
    const reboot = vi.fn().mockRejectedValue(new Error('ssh: connection refused'))
    installB3d({ printers: { reboot } })
    const askForTheirLogin = vi.fn()
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const restarting = await restartAfterReapply(makePrinter(), vi.fn(), askForTheirLogin)

    expect(askForTheirLogin).toHaveBeenCalledWith('printer-1')
    expect(restarting).toBe(false)
  })
})

// Bespok3d-desktop#30: the printer is told a reboot follows only when the app will really do it.
describe('whether the app will restart the printer itself', () => {
  it('says yes for a printer on the login its adapter ships', async () => {
    installB3d({ printers: { adapterGet: vi.fn().mockResolvedValue(makeAdapterInfo()) } })

    expect(await appRestartsItself(makePrinter())).toBe(true)
  })

  it('says no for a printer on the user own login, since the restart waits on them', async () => {
    const adapterGet = vi.fn().mockResolvedValue(makeAdapterInfo())
    installB3d({ printers: { adapterGet } })

    expect(await appRestartsItself(makePrinter({ customSshCredentials: true }))).toBe(false)
    expect(adapterGet).not.toHaveBeenCalled()
  })

  it('says no when the adapter is gone', async () => {
    installB3d({ printers: { adapterGet: vi.fn().mockResolvedValue(null) } })

    expect(await appRestartsItself(makePrinter())).toBe(false)
  })

  it('says no when the adapter cannot be read, so the printer keeps its services restart', async () => {
    installB3d({ printers: { adapterGet: vi.fn().mockRejectedValue(new Error('no adapter on disk')) } })
    vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(await appRestartsItself(makePrinter())).toBe(false)
  })
})

describe('how long the restart is said to take', () => {
  it('takes the length from the printer own adapter, so the bar counts that printer restart', async () => {
    const adapterGet = vi.fn().mockResolvedValue(makeAdapterInfo({ restartSeconds: 42 }))
    installB3d({ printers: { adapterGet } })

    expect(await restartSecondsOf(makePrinter())).toBe(42)
  })

  it('says there is no length when the adapter is gone, rather than handing the bar a made up one', async () => {
    installB3d({ printers: { adapterGet: vi.fn().mockResolvedValue(null) } })

    expect(await restartSecondsOf(makePrinter())).toBeNull()
  })

  it('says there is no length when the adapter cannot be read at all', async () => {
    installB3d({ printers: { adapterGet: vi.fn().mockRejectedValue(new Error('no adapter on disk')) } })
    vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(await restartSecondsOf(makePrinter())).toBeNull()
  })
})
