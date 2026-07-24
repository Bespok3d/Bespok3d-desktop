import { request as httpsRequest, Agent } from 'https'
import type { IncomingMessage } from 'http'
import type { PrinterRecord } from '../printers'
import { streamUpload } from './upload'

export type UploadProgressFn = (sentBytes: number, totalBytes: number) => void

// Finds the address a printer answers on right now (its recorded IP plus fresh discovery sightings),
// persisting any change. Injected by the main process at startup (setAddressResolver) so this transport
// stays decoupled from the printers/electron modules; defaults to a no-op so tests and any caller that
// never wired it simply keep the old single-address behavior.
export type AddressResolver = (printerId: string) => Promise<string>

const addressResolver: { resolve: AddressResolver } = { resolve: async () => '' }

export function setAddressResolver(resolver: AddressResolver): void {
  addressResolver.resolve = resolver
}

// Every daemon request is bounded so a daemon that holds the TCP port open but never answers HTTP
// (mid-restart, or wedged) can never hang the UI. Quick reads use the short default; long ops
// (install, recover, teardown, ...) pass the generous bound, which still beats an infinite hang.
export const DEFAULT_DAEMON_TIMEOUT_MS = 8000
export const LONG_OP_TIMEOUT_MS = 300000

export function makeAgent(daemonCert: string): Agent {
  // Cert is pinned by public key; skip hostname check, keep chain verification
  return new Agent({ ca: daemonCert, rejectUnauthorized: true, checkServerIdentity: () => undefined })
}

export class DaemonHttpError extends Error {
  statusCode: number
  detail: unknown
  constructor(statusCode: number, detail: unknown, message: string) {
    super(message)
    this.name = 'DaemonHttpError'
    this.statusCode = statusCode
    this.detail = detail
  }
}

function parseDaemonDetail(text: string): unknown {
  try {
    return (JSON.parse(text) as { detail?: unknown }).detail ?? text
  } catch {
    return text
  }
}

// Collect a daemon HTTP response body, reject on a >=400 (as DaemonHttpError carrying the parsed
// detail), else hand the raw text to onText. Shared by the pinned-agent doRequest and the
// unauthenticated requestAccess so both classify failures the same way.
export function collectResponse(res: IncomingMessage, onText: (text: string) => void, reject: (error: Error) => void): void {
  const chunks: Buffer[] = []
  res.on('data', (chunk: Buffer) => chunks.push(chunk))
  res.on('end', () => {
    const text = Buffer.concat(chunks).toString('utf-8')
    if (res.statusCode && res.statusCode >= 400) {
      reject(new DaemonHttpError(res.statusCode, parseDaemonDetail(text), `daemon ${res.statusCode}: ${text}`))

      return
    }
    onText(text)
  })
}

function doRequestAt(
  record: PrinterRecord,
  method: string,
  path: string,
  body?: Buffer,
  contentType?: string,
  timeoutMs: number = DEFAULT_DAEMON_TIMEOUT_MS,
  onUploadProgress?: UploadProgressFn,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const agent = makeAgent(record.daemonCert!)
    const headers: Record<string, string | number> = {
      Authorization: `Bearer ${record.daemonToken!}`,
    }
    if (body && contentType) {
      headers['Content-Type'] = contentType
      headers['Content-Length'] = body.length
    }
    const req = httpsRequest(
      { hostname: record.ip, port: 4269, path, method, agent, headers },
      (res) => collectResponse(res, resolve, reject),
    )
    req.on('error', reject)
    req.setTimeout(timeoutMs, () => req.destroy(new Error('daemon request timed out')))
    if (body && onUploadProgress) streamUpload(req, body, onUploadProgress).catch(reject)
    else { if (body) req.write(body); req.end() }
  })
}

// A DaemonHttpError means the daemon answered (a 4xx/5xx); anything else is a transport failure: the
// daemon could not be reached at this address. A flip-flopping DHCP lease is exactly that, so it is the
// signal to look for the printer at a new address and retry, rather than to give up.
function isUnreachable(error: unknown): boolean {
  return !(error instanceof DaemonHttpError)
}

// Every daemon call goes through here, so this is where the app tolerates a printer that moved. On a
// transport failure (refused / timed out / host down, the DHCP-flap symptom) it resolves the address
// the printer answers on right now (probing its recorded IP plus every fresh discovery sighting),
// persists it, and retries there once. A basic user never has to know the IP changed: the op just
// works. A real HTTP error is passed straight through; a retry is skipped when no better address exists.
export async function doRequest(
  record: PrinterRecord,
  method: string,
  path: string,
  body?: Buffer,
  contentType?: string,
  timeoutMs: number = DEFAULT_DAEMON_TIMEOUT_MS,
  onUploadProgress?: UploadProgressFn,
): Promise<string> {
  try {
    return await doRequestAt(record, method, path, body, contentType, timeoutMs, onUploadProgress)
  } catch (error) {
    if (!isUnreachable(error)) throw error
    const liveIp = await addressResolver.resolve(record.id)
    if (!liveIp || liveIp === record.ip) throw error

    return doRequestAt({ ...record, ip: liveIp }, method, path, body, contentType, timeoutMs, onUploadProgress)
  }
}
