// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Printer } from '../types'
import type { SshCredentials } from '../../../../main/adapter-loader'

// How the app logs in to a printer over SSH. The app never stores a login the user gave, so a printer
// with its own login waits on the user every time. Every other printer uses the factory login its
// adapter ships, and without that adapter the app has no login to use at all.
export type PrinterLogin =
  | { source: 'their-own' }
  | { source: 'adapter-missing' }
  | { source: 'factory'; credentials: SshCredentials }

export function usesTheirOwnLogin(printer: Printer): boolean {
  return Boolean(printer.customSshCredentials)
}

export function loginFor(printer: Printer, adapter: AdapterInfo | null): PrinterLogin {
  if (usesTheirOwnLogin(printer)) return { source: 'their-own' }
  if (!adapter) return { source: 'adapter-missing' }
  const { sshUser, sshPasswordHint, sshPort } = adapter.defaults

  return { source: 'factory', credentials: { user: sshUser, password: sshPasswordHint, port: sshPort } }
}

// The adapter is read only when its login is the one to use.
export async function readPrinterLogin(printer: Printer): Promise<PrinterLogin> {
  if (usesTheirOwnLogin(printer)) return { source: 'their-own' }

  return loginFor(printer, await window.b3d.printers.adapterGet(printer.adapter))
}
