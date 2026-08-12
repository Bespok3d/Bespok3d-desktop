// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { installB3d } from '../../test/b3d-mock'
import { makePrinter, makeAdapterInfo } from '../../test/fixtures'
import { restartAfterReapply } from './restart-after-reapply'

describe('the printer is restarted once its plugins are back on it', () => {
  it('restarts it on the login the adapter ships, without asking the user for anything', async () => {
    const reboot = vi.fn().mockResolvedValue(undefined)
    const adapterGet = vi.fn().mockResolvedValue(makeAdapterInfo({ defaults: { sshUser: 'root', sshPort: 22, sshPasswordHint: 'the-printer-password', runtimeUser: 'lava' } }))
    installB3d({ printers: { reboot, adapterGet } })
    const markExpectedRestart = vi.fn()
    const askForTheirLogin = vi.fn()

    const restarting = await restartAfterReapply(makePrinter(), markExpectedRestart, askForTheirLogin)

    expect(reboot).toHaveBeenCalledWith('printer-1', '10.0.0.1', 'root', 'the-printer-password', 22)
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
