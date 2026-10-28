// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { PrinterRecord } from '../printers'
import { fetchPluginConfig } from '../daemon-client/client'
import { DAEMON_QUERY_TIMEOUT_MS } from '../daemon-client/status'

type PluginVars = Record<string, string>

interface PluginRequest {
  pluginId: string
  vars?: PluginVars
}

// An app that never configured a plugin (a second computer, a cleared profile) holds none of its
// settings, and the printer refuses a required setting that arrives empty. The printer keeps the values
// it was last given, so those fill the gaps; a value this app holds is the user's latest word and wins.
export function varsWithPrinterFallback(appVars: PluginVars | undefined, printerVars: PluginVars | null): PluginVars {
  return { ...(printerVars ?? {}), ...(appVars ?? {}) }
}

// A printer that cannot answer leaves the app's own values as they were: the printer still refuses a
// missing required setting and says which, so nothing goes through on a guess.
export async function withPrinterVars<Request extends PluginRequest>(record: PrinterRecord, request: Request): Promise<Request> {
  const printerVars = await fetchPluginConfig(record, request.pluginId, DAEMON_QUERY_TIMEOUT_MS).catch(() => null)

  return { ...request, vars: varsWithPrinterFallback(request.vars, printerVars) }
}

export function requestsWithPrinterVars<Request extends PluginRequest>(record: PrinterRecord, requests: Request[]): Promise<Request[]> {
  return Promise.all(requests.map((request) => withPrinterVars(record, request)))
}
