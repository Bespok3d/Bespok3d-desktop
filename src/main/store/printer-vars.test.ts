// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect, vi } from 'vitest'

vi.mock('../daemon-client/client', () => ({ fetchPluginConfig: vi.fn() }))
vi.mock('../daemon-client/status', () => ({ DAEMON_QUERY_TIMEOUT_MS: 8000 }))

import { varsWithPrinterFallback } from './printer-vars'

describe('varsWithPrinterFallback', () => {
  it('keeps the app value for a key both hold', () => {
    expect(varsWithPrinterFallback({ PORT: '8080' }, { PORT: '7125' })).toEqual({ PORT: '8080' })
  })

  it('takes a key only the printer holds', () => {
    expect(varsWithPrinterFallback({ PORT: '8080' }, { SPOOLMAN_SERVER: 'http://spoolman.example' })).toEqual({ PORT: '8080', SPOOLMAN_SERVER: 'http://spoolman.example' })
  })

  it('keeps the app values when the printer holds none', () => {
    expect(varsWithPrinterFallback({ PORT: '8080' }, null)).toEqual({ PORT: '8080' })
  })

  it('takes the printer values when the app holds none', () => {
    expect(varsWithPrinterFallback(undefined, { PORT: '7125' })).toEqual({ PORT: '7125' })
  })
})
