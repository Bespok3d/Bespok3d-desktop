// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('https', () => ({
  Agent: class { constructor(_opts: unknown) { void _opts } },
  request: vi.fn(),
}))

import { request as httpsRequest } from 'https'
import { requestAccess } from './access-client'

const PRINTER_CERT = '-----BEGIN CERTIFICATE-----\nbm90LWEtcmVhbC1jZXJ0\n-----END CERTIFICATE-----\n'

// Whatever is listening at that address, answering with a 200 and these bytes.
function addressAnswers(body: string): void {
  vi.mocked(httpsRequest).mockImplementation((_options: unknown, onResponse?: unknown) => {
    const responseHandlers: Record<string, (chunk?: unknown) => void> = {}
    const requestHandlers: Record<string, (arg?: unknown) => void> = {}

    return {
      on: (event: string, cb: (arg?: unknown) => void) => { requestHandlers[event] = cb },
      setTimeout: () => {},
      write: () => {},
      end: () => {
        const res = { statusCode: 200, on: (event: string, cb: (chunk?: unknown) => void) => { responseHandlers[event] = cb } }
        ;(onResponse as (response: unknown) => void)(res)
        queueMicrotask(() => { responseHandlers.data?.(Buffer.from(body)); responseHandlers.end?.() })
      },
      destroy: (failure: Error) => requestHandlers.error?.(failure),
    } as never
  })
}

function askToPair(): Promise<{ ok: boolean; cert: string }> {
  return requestAccess({ ip: '192.0.2.109', label: 'a laptop', identity: 'client-identity', token: 'a-token', publicKey: 'a-public-key' })
}

// Pairing is the one call this app makes before it has anything to identify the printer by, so the
// certificate check is off and anything answering on that address gets to reply: a home router login
// page, a captive portal, a machine that is not a printer at all. Every answer below was accepted.
describe('asking an address to pair with this computer', () => {
  beforeEach(() => { vi.mocked(httpsRequest).mockReset() })

  it('pairs when the printer takes the request and identifies itself', async () => {
    addressAnswers(JSON.stringify({ ok: true, cert: PRINTER_CERT }))

    await expect(askToPair()).resolves.toEqual({ ok: true, cert: PRINTER_CERT })
  })

  // This one used to leave the pairing screen spinning for ever with nothing said: reading the answer
  // threw where nothing was listening for a throw, so the call never came back either way.
  it('refuses an address that answers with something that is not a Bespok3d printer', async () => {
    addressAnswers('<html><body>Sign in to continue</body></html>')

    await expect(askToPair()).rejects.toThrow(/other than a Bespok3d printer/)
  })

  it('refuses an answer that is not even a set of fields', async () => {
    addressAnswers('"ok"')

    await expect(askToPair()).rejects.toThrow(/other than a Bespok3d printer/)
  })

  // Nothing was recorded on the printer, so nobody will ever be asked to approve this computer: it
  // was pinned anyway and the printer sat there looking paired with a request that did not exist.
  it('refuses an answer that does not say the request was taken', async () => {
    addressAnswers(JSON.stringify({ ok: false, cert: PRINTER_CERT }))

    await expect(askToPair()).rejects.toThrow(/nothing for you to approve/)
  })

  // The printer's own daemon sends this when its certificate file is missing. Pinning it made every
  // later call check the printer against the public certificate authorities, which its own
  // certificate can never satisfy, so the printer read as paired and was unreachable from then on.
  it('refuses a printer that sent no certificate to identify itself with', async () => {
    addressAnswers(JSON.stringify({ ok: true, cert: '' }))

    await expect(askToPair()).rejects.toThrow(/no certificate/)
  })

  it('refuses a certificate that is not one', async () => {
    addressAnswers(JSON.stringify({ ok: true, cert: 'trust me' }))

    await expect(askToPair()).rejects.toThrow(/no certificate/)
  })
})
