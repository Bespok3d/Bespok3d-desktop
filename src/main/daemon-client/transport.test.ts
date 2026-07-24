import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('https', () => ({
  Agent: class { constructor(_opts: unknown) { void _opts } },
  request: vi.fn(),
}))

import { request as httpsRequest } from 'https'
import { doRequest, setAddressResolver, DaemonHttpError } from './transport'
import type { PrinterRecord } from '../printers'

// A fake request that either errors (transport failure) or returns a 200 body, captured per host so we
// can assert which address each attempt hit.
function fakeRequest(outcomes: Record<string, { error?: Error; body?: string; status?: number }>): void {
  vi.mocked(httpsRequest).mockImplementation((options: unknown, onResponse?: unknown) => {
    const host = (options as { hostname: string }).hostname
    const handlers: Record<string, (arg?: unknown) => void> = {}
    function emitResponse(outcome: { error?: Error; body?: string; status?: number }): void {
      const resHandlers: Record<string, (chunk?: unknown) => void> = {}
      const res = { statusCode: outcome.status ?? 200, on: (event: string, cb: (chunk?: unknown) => void) => { resHandlers[event] = cb } }
      ;(onResponse as (response: unknown) => void)(res)
      queueMicrotask(() => { resHandlers.data?.(Buffer.from(outcome.body ?? '')); resHandlers.end?.() })
    }
    const req = {
      on: (event: string, cb: (arg?: unknown) => void) => { handlers[event] = cb },
      setTimeout: () => {},
      write: () => {},
      end: () => {
        const outcome = outcomes[host] ?? { error: new Error('refused') }
        if (outcome.error) queueMicrotask(() => handlers.error?.(outcome.error))
        else emitResponse(outcome)
      },
      destroy: (err: Error) => handlers.error?.(err),
    }

    return req as never
  })
}

const record = { id: 'p1', ip: '10.6.9.109', daemonCert: 'C', daemonToken: 'T' } as unknown as PrinterRecord

describe('doRequest re-resolves and retries a moved printer', () => {
  beforeEach(() => { vi.mocked(httpsRequest).mockReset(); setAddressResolver(async () => '') })

  it('follows the printer to its live IP and retries when the recorded IP is unreachable', async () => {
    fakeRequest({ '10.6.9.109': { error: new Error('connect ECONNREFUSED') }, '10.6.9.66': { body: 'ok' } })
    setAddressResolver(async () => '10.6.9.66')
    await expect(doRequest(record, 'GET', '/status')).resolves.toBe('ok')
  })

  it('does not retry a real HTTP error (the daemon answered)', async () => {
    fakeRequest({ '10.6.9.109': { status: 409, body: '{"detail":"blocked"}' } })
    const resolver = vi.fn(async () => '10.6.9.66')
    setAddressResolver(resolver)
    await expect(doRequest(record, 'POST', '/x')).rejects.toBeInstanceOf(DaemonHttpError)
    expect(resolver).not.toHaveBeenCalled()
  })

  it('gives up (no retry loop) when no better address is found', async () => {
    fakeRequest({ '10.6.9.109': { error: new Error('host is down') } })
    setAddressResolver(async () => '10.6.9.109') // same address: nothing better to try
    await expect(doRequest(record, 'GET', '/status')).rejects.toThrow(/host is down/)
  })
})
