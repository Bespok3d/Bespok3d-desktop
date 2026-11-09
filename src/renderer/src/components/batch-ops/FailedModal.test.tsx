// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { setup } from '../../test/harness'
import { makeT } from '../../i18n'
import { BatchFailedModal } from './FailedModal'

const en = makeT('en')

describe('BatchFailedModal', () => {
  // main-index issue 13: an uninstall whose call to the printer's daemon got no answer.
  it('says the printer did not answer when the connection timed out', () => {
    var unansweredCall = 'connect ETIMEDOUT 192.168.178.192:4269'
    setup(<BatchFailedModal variant="uninstall" reason={unansweredCall} onRepairPrinter={vi.fn()} onClose={vi.fn()} />)

    expect(screen.getByText(en('failure.printer_no_answer'))).toBeInTheDocument()
    expect(screen.queryByText(en('batch_failed.technical_reason'))).toBeNull()
    expect(screen.getByText(en('report.show_tech'))).toBeInTheDocument()
  })

  it('keeps the raw words of a known failure one click away', async () => {
    var unfinishedLogin = 'Timed out while waiting for handshake'
    var { user } = setup(<BatchFailedModal variant="uninstall" reason={unfinishedLogin} onRepairPrinter={vi.fn()} onClose={vi.fn()} />)

    await user.click(screen.getByTitle(en('explainer.show')))
    expect(screen.getByText(unfinishedLogin)).toBeInTheDocument()
  })
})
