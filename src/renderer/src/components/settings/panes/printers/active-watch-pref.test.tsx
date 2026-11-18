// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { setup } from '../../../../test/harness'
import { makeT } from '../../../../i18n'
import { makePrinter } from '../../../../test/fixtures'
import { ActiveWatchPref } from './active-watch-pref'

const en = makeT('en')
const SETTING: ActiveWatchSetting = { enabled: true, files: ['/dev/kmsg'], remedies: { 'screen-stuck': 'notify' } }

function renderPref(daemonVersion: string | undefined, savedAnswer: ActiveWatchSetting = SETTING, keptSetting: ActiveWatchSetting | null = SETTING) {
  const activeWatchSetting = vi.fn().mockResolvedValue(keptSetting)
  const saveActiveWatchSetting = vi.fn().mockResolvedValue(savedAnswer)
  const printer = makePrinter({ id: 'p1', status: 'managed', daemonVersion })
  const harness = setup(<ActiveWatchPref printer={printer} />, { b3d: { printers: { activeWatchSetting, saveActiveWatchSetting } } })

  return { ...harness, activeWatchSetting, saveActiveWatchSetting }
}

describe('the active-watch setting', () => {
  it('shows what the printer watches and what it does about a stuck screen', async () => {
    const { activeWatchSetting } = renderPref('0.15.0')
    expect(await screen.findByRole('switch', { name: en('printers.active_watch') })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByText(en('printers.active_watch.token.screen-stuck'))).toBeInTheDocument()
    expect(activeWatchSetting).toHaveBeenCalledWith('p1')
  })

  it('saves the choice to reboot when not printing', async () => {
    const rebootWhenIdle: ActiveWatchSetting = { ...SETTING, remedies: { 'screen-stuck': 'reboot-when-idle' } }
    const { user, saveActiveWatchSetting } = renderPref('0.15.0', rebootWhenIdle)
    await user.click(await screen.findByRole('button', { name: en('printers.active_watch.reboot_when_idle') }))
    expect(saveActiveWatchSetting).toHaveBeenCalledWith('p1', rebootWhenIdle)
    await waitFor(() => expect(screen.getByRole('button', { name: en('printers.active_watch.reboot_when_idle') })).toHaveClass('active'))
  })

  it('saves the watch turned off', async () => {
    const { user, saveActiveWatchSetting } = renderPref('0.15.0', { ...SETTING, enabled: false })
    await user.click(await screen.findByRole('switch', { name: en('printers.active_watch') }))
    expect(saveActiveWatchSetting).toHaveBeenCalledWith('p1', { ...SETTING, enabled: false })
    await waitFor(() => expect(screen.queryByText(en('printers.active_watch.token.screen-stuck'))).not.toBeInTheDocument())
  })

  it('holds the switch still until the printer has saved the change', async () => {
    const { user, saveActiveWatchSetting } = renderPref('0.15.0')
    saveActiveWatchSetting.mockReturnValue(new Promise(() => {}))
    const watchSwitch = await screen.findByRole('switch', { name: en('printers.active_watch') })
    await user.click(watchSwitch)
    expect(watchSwitch).toHaveAttribute('aria-checked', 'true')
    expect(watchSwitch).toBeDisabled()
    expect(screen.getByRole('button', { name: en('printers.active_watch.reboot_when_idle') })).toBeDisabled()
  })

  it('is hidden for a daemon older than the watch, without asking the printer', () => {
    const { activeWatchSetting } = renderPref('0.14.0')
    expect(screen.queryByRole('switch')).not.toBeInTheDocument()
    expect(activeWatchSetting).not.toHaveBeenCalled()
  })

  it('is hidden when the printer answers it has no watch', async () => {
    const { activeWatchSetting } = renderPref(undefined, SETTING, null)
    await waitFor(() => expect(activeWatchSetting).toHaveBeenCalledWith('p1'))
    await activeWatchSetting.mock.results[0].value
    expect(screen.queryByRole('switch')).not.toBeInTheDocument()
  })
})
