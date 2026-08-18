// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { makePrinter } from '../../test/fixtures'
import { failureIssueTitle, buildFailureIssueBody, reportOpFailure } from './failure-report'

afterEach(() => { vi.unstubAllGlobals() })

const WRITE_LAYER_REFUSAL = "This printer's write layer was reset. Run full recovery to rebuild it."

describe('reporting an operation that failed', () => {
  it('names the operation and the step that refused in the title', () => {
    expect(failureIssueTitle('repair', { stepLabel: 'Checking the write layer', reason: WRITE_LAYER_REFUSAL }))
      .toBe('repair failed: Checking the write layer')
  })

  it('says so in the title when the operation never got as far as a step', () => {
    expect(failureIssueTitle('repair', { reason: 'no route to host' })).toBe('repair failed')
  })

  // Everything a maintainer would otherwise have to ask for, so the reporter only presses Submit.
  it('carries the step, its own reason and both sides versions', () => {
    const body = buildFailureIssueBody(makePrinter({ daemonVersion: '0.12.23', firmwareVersion: '1.6.0.1' }), 'repair', {
      stepLabel: 'Checking the write layer', reason: WRITE_LAYER_REFUSAL,
    })

    expect(body).toContain('Checking the write layer')
    expect(body).toContain(WRITE_LAYER_REFUSAL)
    expect(body).toContain('0.12.23')
    expect(body).toContain('1.6.0.1')
  })

  it('says no reason was reported rather than leaving the block empty', () => {
    expect(buildFailureIssueBody(makePrinter(), 'recovery', { reason: '   ' })).toContain('(no reason reported)')
  })

  it('opens a prefilled issue on the app repository', () => {
    const openUrl = vi.fn()
    vi.stubGlobal('b3d', { openUrl })
    reportOpFailure(makePrinter(), 'repair', { stepLabel: 'Checking the write layer', reason: WRITE_LAYER_REFUSAL })
    const url = openUrl.mock.calls[0][0] as string

    expect(url).toContain('https://github.com/Bespok3d/Bespok3d-desktop/issues/new?')
    expect(decodeURIComponent(url)).toContain('repair failed: Checking the write layer')
  })
})
