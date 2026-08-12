// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Printer } from '../../data/types'

// Putting every plugin back leaves the printer running services that were restarted one after another,
// and the touchscreen is known to come back dead from that without saying so. Nothing on the printer
// reports it, so there is nothing to detect: the printer is restarted every time recovery finishes.
//
// A printer whose login is the adapter's own is restarted without asking. A printer the user gave their
// own SSH login for cannot be logged into unattended, so that one is handed to the restart window, which
// asks them for it.
//
// It answers true only when the app is restarting the printer itself, so the recovery report never
// tells the user a restart is happening when the printer is waiting on them instead. It never rejects:
// a restart the printer refused is reported by the restart window, not by the recovery report.
export function restartAfterReapply(
  printer: Printer,
  markExpectedRestart: (printerId: string) => void,
  askForTheirLogin: (printerId: string) => void,
): Promise<boolean> {
  if (printer.customSshCredentials) {
    askForTheirLogin(printer.id)

    return Promise.resolve(false)
  }

  return window.b3d.printers.adapterGet(printer.adapter)
    .then((adapter) => rebootOnAdapterDefaults(printer, adapter, markExpectedRestart, askForTheirLogin))
    .catch(restartDidNotHappen(printer.id, askForTheirLogin))
}

function restartDidNotHappen(printerId: string, askForTheirLogin: (printerId: string) => void) {
  return function handItToTheRestartWindow(error: unknown) {
    console.error('[recovery] the restart after putting the plugins back failed', error)
    askForTheirLogin(printerId)

    return false
  }
}

function rebootOnAdapterDefaults(
  printer: Printer,
  adapter: AdapterInfo | null,
  markExpectedRestart: (printerId: string) => void,
  askForTheirLogin: (printerId: string) => void,
): Promise<boolean> {
  if (!adapter) {
    askForTheirLogin(printer.id)

    return Promise.resolve(false)
  }
  const { sshUser, sshPasswordHint, sshPort } = adapter.defaults
  markExpectedRestart(printer.id)

  return window.b3d.printers.reboot(printer.id, printer.ip, sshUser, sshPasswordHint, sshPort).then(() => true)
}
