// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { PrinterRecord } from '../printers'
import type { MergedEntry } from '../registry/model'
import { fetchPluginConfig } from '../daemon-client/client'
import { DAEMON_QUERY_TIMEOUT_MS } from '../daemon-client/status'
import { declaredDefaults } from './declared-defaults'
import { varsToSend, type PluginVars, type PrinterVars } from './vars-to-send'

interface PluginRequest {
  pluginId: string
  vars?: PluginVars
}

async function printerVarsOf(record: PrinterRecord, pluginId: string): Promise<PrinterVars> {
  return fetchPluginConfig(record, pluginId, DAEMON_QUERY_TIMEOUT_MS).then(
    (saved) => saved ?? {},
    (): PrinterVars => 'unreadable',
  )
}

// The entry is the one whose package goes to the printer, so the defaults are that build's own. A plugin
// the catalog does not list has none to give.
export async function withPrinterVars<Request extends PluginRequest>(record: PrinterRecord, request: Request, entry: MergedEntry | undefined): Promise<Request> {
  const printerVars = await printerVarsOf(record, request.pluginId)
  const defaults = entry ? declaredDefaults(entry) : {}

  return { ...request, vars: varsToSend(request.vars, printerVars, defaults) }
}
