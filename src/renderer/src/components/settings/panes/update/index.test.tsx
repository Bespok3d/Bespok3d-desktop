// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { setup } from '../../../../test/harness'
import { makeT } from '../../../../i18n'
import { UpdatePane } from './index'

const en = makeT('en')

describe('UpdatePane', () => {
  // The version list must never present a failed read as "there are no other versions", and what it
  // says is the reason in the user's own language, never the plumbing that carried it.
  it('says why the version list is empty instead of showing no releases', async () => {
    var listReleases = vi.fn().mockResolvedValue({ releases: [], problem: 'notPublished' })
    setup(<UpdatePane />, { b3d: { appUpdate: { listReleases } } })
    expect(await screen.findByText(en('set.update.problem_not_published'))).toBeInTheDocument()
    expect(screen.queryByText(en('set.update.no_releases'))).not.toBeInTheDocument()
  })

  it('reads the version list again when the reason offers to try again', async () => {
    var listReleases = vi.fn().mockResolvedValue({ releases: [], problem: 'unreachable' })
    var { user } = setup(<UpdatePane />, { b3d: { appUpdate: { listReleases } } })
    await user.click(await screen.findByRole('button', { name: en('set.update.retry') }))
    expect(listReleases).toHaveBeenCalledTimes(2)
  })

  it('shows a broken read as a reason, not as the message the main process threw', async () => {
    var listReleases = vi.fn().mockRejectedValue(new Error('release feed offline'))
    setup(<UpdatePane />, { b3d: { appUpdate: { listReleases } } })
    expect(await screen.findByText(en('set.update.problem_unavailable'))).toBeInTheDocument()
    expect(screen.queryByText('release feed offline')).not.toBeInTheDocument()
  })

  it('checks for updates on demand', async () => {
    var { user, b3d } = setup(<UpdatePane />)
    await user.click(screen.getByRole('button', { name: en('set.update.check') }))
    expect(b3d.appUpdate.checkNow).toHaveBeenCalled()
  })

  it('persists the check-frequency preference', async () => {
    var { user, b3d } = setup(<UpdatePane />)
    var combo = (await screen.findAllByRole('combobox'))[0]
    await user.selectOptions(combo, 'daily')
    expect(b3d.settings.set).toHaveBeenCalledWith({ appUpdateFrequency: 'daily' })
  })
})
