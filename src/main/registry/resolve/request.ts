// How this module talks HTTP: one timeout, one failure mapping, and the detached signature that rides
// beside an index at `<url>.sig`. Shared by the plain-http and GitHub transports, so a failure reads
// the same whichever one produced it and a signature is fetched the same way from either.
import { RegistryFetchError } from '../model'
import type { SourceFailureReason } from '../model'

const FETCH_TIMEOUT_MS = 8000

export function httpGet(url: string, headers: Record<string, string>): Promise<Response> {
  return fetch(url, { headers, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) }).catch(networkError)
}

function networkError(error: Error): never {
  throw new RegistryFetchError('network', error.message)
}

function httpReason(status: number): SourceFailureReason {
  if (status === 401 || status === 403) return 'auth'
  if (status === 404) return 'notfound'

  return 'network'
}

// Reached only after a transport's unconditional re-ask, so a 304 here answers a request that carried
// NO validators: there is nothing the server can be calling unchanged. There is no index to serve and
// no reason better than 'network' to file it under, so the message carries the mechanism instead - a
// generic `HTTP 304` in a log tells whoever reads it nothing about which side is broken.
export function httpFailure(status: number, transport: string): RegistryFetchError {
  if (status === 304) return new RegistryFetchError('network', `${transport} answered 304 to a request that sent no validators`)

  return new RegistryFetchError(httpReason(status), `${transport} ${status}`)
}

// A signature's absence is ordinary (most lists are unsigned) and never fails the fetch, so every
// failure path here collapses to null.
export async function fetchSignatureBeside(url: string, headers: Record<string, string> = {}): Promise<string | null> {
  const response = await fetch(`${url}.sig`, { headers, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) }).catch(() => null)
  if (!response?.ok) return null

  return response.text().catch(() => null)
}
