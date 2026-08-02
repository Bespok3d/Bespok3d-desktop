// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom
// The two places a person meets usage reporting: the question asked once, and the pane they can come
// back to. What both must hold is that no is the easy answer, that the list of what is sent is on the
// screen rather than behind a link, and that the switch is not the only control here.
import { describe, it, expect, vi } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import { setup } from '../../../../test/harness'
import { UsageReportingGroup } from './index'
import { UsageReportingRequest } from './UsageReportingRequest'

const NEVER_ANSWERED = { answer: null, ask: true }
const SAID_NO = { answer: 'refused' as const, ask: false }
const SAID_YES = { answer: 'granted' as const, ask: false }

function askedInstall(overrides = {}) {
  return { analytics: { consent: vi.fn().mockResolvedValue(NEVER_ANSWERED), ...overrides } }
}

describe('the question, asked once', () => {
  it('is put to an install that has never answered', async () => {
    setup(<UsageReportingRequest />, { b3d: askedInstall() })
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
  })

  it('is not put to an install main has already settled, whatever the reason', async () => {
    var { container } = setup(<UsageReportingRequest />, {
      b3d: { analytics: { consent: vi.fn().mockResolvedValue(SAID_NO) } },
    })
    await waitFor(() => expect(container.querySelector('[role="dialog"]')).toBeNull())
  })

  it('says what is sent and what is never sent on the spot, not behind a link', async () => {
    setup(<UsageReportingRequest />, { b3d: askedInstall() })
    expect(await screen.findByText('What is sent')).toBeInTheDocument()
    expect(screen.getByText('What is never sent')).toBeInTheDocument()
    expect(screen.getByText(/no names, no addresses, no passwords/)).toBeInTheDocument()
  })

  it('sends a yes only when the yes button is the thing pressed', async () => {
    var setConsent = vi.fn().mockResolvedValue(undefined)
    var { user } = setup(<UsageReportingRequest />, { b3d: askedInstall({ setConsent }) })
    await user.click(await screen.findByRole('button', { name: 'Yes, send it' }))
    expect(setConsent).toHaveBeenCalledTimes(1)
    expect(setConsent).toHaveBeenCalledWith(true)
  })

  it('counts the no button as a no', async () => {
    var setConsent = vi.fn().mockResolvedValue(undefined)
    var { user } = setup(<UsageReportingRequest />, { b3d: askedInstall({ setConsent }) })
    await user.click(await screen.findByRole('button', { name: 'No thanks' }))
    expect(setConsent).toHaveBeenCalledWith(false)
  })

  it('counts walking away as a no, so a dismissed question is never a pending one', async () => {
    var setConsent = vi.fn().mockResolvedValue(undefined)
    setup(<UsageReportingRequest />, { b3d: askedInstall({ setConsent }) })
    fireEvent.keyDown(await screen.findByRole('dialog'), { key: 'Escape' })
    await waitFor(() => expect(setConsent).toHaveBeenCalledWith(false))
  })

  it('counts a press on the backdrop as a no as well', async () => {
    var setConsent = vi.fn().mockResolvedValue(undefined)
    var { container } = setup(<UsageReportingRequest />, { b3d: askedInstall({ setConsent }) })
    var scrim: HTMLElement
    await screen.findByRole('dialog')
    scrim = container.querySelector('.modal-scrim') as HTMLElement
    fireEvent.pointerDown(scrim)
    fireEvent.pointerUp(scrim)
    await waitFor(() => expect(setConsent).toHaveBeenCalledWith(false))
  })

  it('goes away once answered, rather than waiting for a restart to notice', async () => {
    var { user } = setup(<UsageReportingRequest />, { b3d: askedInstall() })
    await user.click(await screen.findByRole('button', { name: 'No thanks' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })
})

describe('the pane you come back to', () => {
  it('shows the switch as the stored answer left it', async () => {
    setup(<UsageReportingGroup />, { b3d: { analytics: { consent: vi.fn().mockResolvedValue(SAID_YES) } } })
    await waitFor(() => expect(screen.getByRole('switch')).toBeChecked())
  })

  it('shows it off when the answer was no', async () => {
    setup(<UsageReportingGroup />, { b3d: { analytics: { consent: vi.fn().mockResolvedValue(SAID_NO) } } })
    await waitFor(() => expect(screen.getByRole('switch')).not.toBeChecked())
  })

  it('switches off through analytics, which is what makes the id go with it', async () => {
    var setConsent = vi.fn().mockResolvedValue(undefined)
    var { user } = setup(<UsageReportingGroup />, {
      b3d: { analytics: { consent: vi.fn().mockResolvedValue(SAID_YES), setConsent } },
    })
    await waitFor(() => expect(screen.getByRole('switch')).toBeChecked())
    await user.click(screen.getByRole('switch'))
    expect(setConsent).toHaveBeenCalledWith(false)
  })

  it('lists what is collected without leaving the pane', async () => {
    setup(<UsageReportingGroup />, { b3d: { analytics: { consent: vi.fn().mockResolvedValue(SAID_YES) } } })
    expect(await screen.findByText('What is sent')).toBeInTheDocument()
    expect(screen.getByText(/Error messages and stack traces/)).toBeInTheDocument()
  })

  // The host is configured to add no location and to keep no address, so the strongest thing this
  // pane can say is that where the user is never leaves the machine. Copy that instead names a
  // country as collected is claiming a thing the project does not do, and it stood in this pane
  // once.
  // The address promise has to stop at what usage reporting does with it. The proxy that fronts the
  // site records the address a failed request came from, so it can be defended against attack, and
  // copy saying the address is never kept at all was claiming more than the project can hold to.
  it('promises no location at all, and never names a country as something collected', async () => {
    setup(<UsageReportingGroup />, { b3d: { analytics: { consent: vi.fn().mockResolvedValue(SAID_YES) } } })
    expect(await screen.findByText(/no country, no town, nothing/)).toBeInTheDocument()
    expect(screen.queryByText(/country your connection comes from/)).toBeNull()
    expect(screen.getByText(/never kept with what you send/)).toBeInTheDocument()
    expect(screen.queryByText(/never looked up and never kept/)).toBeNull()
  })

  // The taxonomy has no screen-view event, and copy that claims one is a promise the code does not
  // keep. This held a real defect: the first draft of the list said screens were counted.
  it('claims no more than the app sends, so it never says screens are counted', async () => {
    setup(<UsageReportingGroup />, { b3d: { analytics: { consent: vi.fn().mockResolvedValue(SAID_YES) } } })
    await screen.findByText('What is sent')
    expect(screen.queryByText(/screens you open/)).toBeNull()
  })

  // There is nothing to start over from. Offering to would tell the user the app holds something that
  // follows them, which would be the pane describing an app this is not.
  //
  // Saying every event arrives "under the same name" reads as though a name of the user's travels with
  // it, which is the opposite of what the sender word is. It stood in this pane once.
  it('offers nothing to reset, because no value that could tell this install apart is ever sent', async () => {
    setup(<UsageReportingGroup />, { b3d: { analytics: { consent: vi.fn().mockResolvedValue(SAID_YES) } } })
    await screen.findByText('What is sent')
    expect(screen.queryByRole('button', { name: /new id/i })).toBeNull()
    expect(screen.getByText(/There is no installation id/)).toBeInTheDocument()
    expect(screen.queryByText(/under the same name/)).toBeNull()
  })

  // A property the app attaches to everything is a thing collected, and a list that leaves it out is
  // telling the user less than is true.
  it('names the kind of app, the operating system and the language, which ride on every event', async () => {
    setup(<UsageReportingGroup />, { b3d: { analytics: { consent: vi.fn().mockResolvedValue(SAID_YES) } } })
    expect(await screen.findByText(/operating system it runs on, and the language/)).toBeInTheDocument()
  })

  it('never shows the note that used to stand in for this, which promised nothing was collected', () => {
    setup(<UsageReportingGroup />, { b3d: { analytics: { consent: vi.fn().mockResolvedValue(SAID_YES) } } })
    expect(screen.queryByText(/analytics/i)).toBeNull()
    expect(screen.queryByText(/telemetry/i)).toBeNull()
  })
})
