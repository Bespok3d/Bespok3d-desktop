import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the node https layer (like client.test.ts) so the REAL transport classifies the response:
// fetchPluginConfig's 404-to-null contract depends on DaemonHttpError raised by collectResponse, so
// the test must exercise that path, not a re-mocked transport module.
vi.mock('https', () => ({
  Agent: class { constructor(_opts: unknown) { void _opts } },
  request: vi.fn(),
}))

import { request as httpsRequest } from 'https'
import { fetchPluginConfig } from './status-endpoints'
import type { PrinterRecord } from '../printers'

type ResponseHandler = (res: unknown) => void

// One canned HTTP exchange: the request object is inert (no timeout fired), the response delivers
// the given status and body through the same on('data')/on('end') events a real socket would.
function answerWith(statusCode: number, body: string): void {
  function fakeRequest(_opts: unknown, onResponse: ResponseHandler) {
    const handlers: Record<string, (chunk?: unknown) => void> = {}
    const res = { statusCode, on: (event: string, callback: (chunk?: unknown) => void) => { handlers[event] = callback } }
    queueMicrotask(() => {
      onResponse(res)
      handlers.data?.(Buffer.from(body))
      handlers.end?.()
    })

    return { on: () => {}, setTimeout: () => {}, write: () => {}, end: () => {} }
  }
  vi.mocked(httpsRequest).mockImplementation(fakeRequest as never)
}

const record = { id: 'p1', ip: '10.0.0.5', daemonToken: 'T', daemonCert: 'C' } as unknown as PrinterRecord

// Block body on purpose: mockReset() returns the mock, and a beforeEach that RETURNS a function
// registers it as a cleanup hook, which the runner would then call bare (a ghost zero-arg request).
beforeEach(() => { vi.mocked(httpsRequest).mockReset() })

describe('fetchPluginConfig', () => {
  it('returns the persisted vars from the plugin config route', async () => {
    answerWith(200, JSON.stringify({ vars: { SPOOLMAN_SERVER: 'http://x:8000' } }))

    expect(await fetchPluginConfig(record, 'spoolman')).toEqual({ SPOOLMAN_SERVER: 'http://x:8000' })
  })

  it('degrades a 404 to null: an unknown plugin or a pre-0.12.12 daemon both mean "no live value"', async () => {
    answerWith(404, JSON.stringify({ detail: 'spoolman' }))

    expect(await fetchPluginConfig(record, 'spoolman')).toBeNull()
  })

  it('propagates a non-404 daemon error so the caller can tell "broken" from "nothing persisted"', async () => {
    answerWith(500, 'boom')

    await expect(fetchPluginConfig(record, 'spoolman')).rejects.toThrow(/daemon 500/)
  })
})
