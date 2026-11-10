// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { getAdapter } from '../adapter-loader'
import { checkSshOpen } from './probe'
import { STANDARD_SSH_PORT } from './ports'
import { loadPrinters } from './store'
import type { PrinterRecord } from './record'

type SshPortFacts = Pick<PrinterRecord, 'adapter' | 'customSshCredentials' | 'sshPort'>

// A printer on the factory login answers on its adapter's port. A printer with its own login answers on
// the port its owner typed, known here once an enrollment has used it. Before that it is not known, and
// the standard port is the likeliest one.
export function sshPortOf(record: SshPortFacts): number {
  if (record.customSshCredentials) return record.sshPort ?? STANDARD_SSH_PORT

  return getAdapter(record.adapter)?.defaults.sshPort ?? STANDARD_SSH_PORT
}

function sshPortIsUnknown(record: SshPortFacts): boolean {
  return Boolean(record.customSshCredentials) && record.sshPort === undefined
}

// Whether the printer's SSH login can be reached, checked before an SSH job opens. When the port is not
// known yet the check passes: the owner names the port in the login form that comes next, and that
// form's own login says so when the port refuses.
export function sshLoginAnswers(printerId: string, ip: string): Promise<boolean> {
  const record = loadPrinters().find((saved) => saved.id === printerId)
  if (record && sshPortIsUnknown(record)) return Promise.resolve(true)

  return checkSshOpen(ip, record ? sshPortOf(record) : STANDARD_SSH_PORT)
}
