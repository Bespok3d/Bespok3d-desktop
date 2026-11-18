// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// A fault the watch reported goes on the printer's reboot list once, and leaves it when the printer
// restarts itself to clear it. The next health check replaces the whole list with what the printer
// reports, so a cleared fault leaves the banner on its own.
import type { Printer } from '../types'
import { changeById } from '../printers/list'

function withToken(printer: Printer, token: string): Printer {
  const rebootRequired = printer.rebootRequired ?? []
  if (rebootRequired.includes(token)) return printer

  return { ...printer, rebootRequired: [...rebootRequired, token] }
}

export function withRebootToken(printerId: string, token: string): (prev: Printer[]) => Printer[] {
  return changeById(printerId, (printer) => withToken(printer, token))
}

function withoutToken(printer: Printer, token: string): Printer {
  if (!printer.rebootRequired?.includes(token)) return printer

  return { ...printer, rebootRequired: printer.rebootRequired.filter((listed) => listed !== token) }
}

export function withoutRebootToken(printerId: string, token: string): (prev: Printer[]) => Printer[] {
  return changeById(printerId, (printer) => withoutToken(printer, token))
}
