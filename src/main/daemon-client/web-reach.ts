// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { PrinterRecord } from '../printers'
import { doRequest, DaemonHttpError } from './transport'
import { DAEMON_QUERY_TIMEOUT_MS, getManagedRecord } from './status'

// What the printer said when asked to try a web address. `asked: false` means there was no answer
// from the printer itself, so nothing is known about the address either way. Otherwise `httpCode` is
// the code the address answered the printer with, or null when nothing answered it there.
export type PrinterReach = { asked: false } | { asked: true; httpCode: number | null }

interface WebReachWire {
  http_code: number | null
}

const NOT_ASKED: PrinterReach = { asked: false }

// A reply with neither a code nor null in it is not an answer about the address, so it counts as not asked
// rather than as nothing answering.
function readHttpCode(text: string): number | null {
  const httpCode = (JSON.parse(text) as WebReachWire).http_code
  if (typeof httpCode !== 'number' && httpCode !== null) throw new Error(`printer answer without http_code: ${text}`)

  return httpCode
}

// A daemon from before the route answers 404, which is the same as not having asked at all.
export async function fetchWebReach(record: PrinterRecord, url: string, timeoutMs?: number): Promise<PrinterReach> {
  try {
    const body = Buffer.from(JSON.stringify({ url }))
    const text = await doRequest(record, 'POST', '/net/reach', body, 'application/json', timeoutMs)

    return { asked: true, httpCode: readHttpCode(text) }
  } catch (error) {
    if (error instanceof DaemonHttpError && error.statusCode === 404) return NOT_ASKED
    throw error
  }
}

// The address a plugin will use is used from the printer, so the printer is the one that tries it.
// A printer that cannot be asked (not managed, offline, refusing) is said as such in the field, a
// warning like any other answer about the address and never a block.
export async function askPrinterToReach(printerId: string, url: string): Promise<PrinterReach> {
  try {
    return await fetchWebReach(getManagedRecord(printerId), url, DAEMON_QUERY_TIMEOUT_MS)
  } catch (error) {
    console.warn(`[web-reach] could not ask printer ${printerId} to try an address:`, error)

    return NOT_ASKED
  }
}
