// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { setup } from '../../../../test/harness'
import type { B3dOverrides } from '../../../../test/b3d-mock'
import { GitHostPane } from './index'

function renderPane(gitHost: Partial<Window['b3d']['gitHost']> = {}) {
  var overrides: B3dOverrides = { gitHost }

  return setup(<GitHostPane onSettingsUpdated={vi.fn()} />, { b3d: overrides })
}

describe('GitHostPane GitHub connect', () => {
  it('starts the device flow and opens the verification page', async () => {
    var neverResolves = new Promise<void>(function hold() {})
    var waitForAuth = vi.fn(() => neverResolves)
    var { user, b3d } = renderPane({ waitForAuth })

    await user.click(await screen.findByRole('button', { name: /Connect with GitHub/i }))

    expect(b3d.gitHost.beginConnect).toHaveBeenCalled()
    expect(b3d.openUrl).toHaveBeenCalledWith('https://github.com/login/device')
    expect(await screen.findByText(/Waiting for authorization/i)).toBeInTheDocument()
  })

  it('puts the device code on the clipboard as soon as it is shown', async () => {
    var neverResolves = new Promise<void>(function hold() {})
    var waitForAuth = vi.fn(() => neverResolves)
    var { user } = renderPane({ waitForAuth })
    var writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })

    await user.click(await screen.findByRole('button', { name: /Connect with GitHub/i }))
    await screen.findByText(/Waiting for authorization/i)

    const code = await screen.findByRole('button', { name: 'ABCD-1234' })
    expect(writeText).toHaveBeenCalledWith('ABCD-1234')
    expect(await screen.findByText('Copied')).toBeInTheDocument()

    writeText.mockClear()
    await user.click(code)
    expect(writeText).toHaveBeenCalledWith('ABCD-1234')

    writeText.mockClear()
    await user.click(screen.getByRole('button', { name: /Copy the code/i }))
    expect(writeText).toHaveBeenCalledWith('ABCD-1234')
  })
})

describe('GitHostPane storage warning', () => {
  it('warns when the token is stored without OS encryption', async () => {
    renderPane({
      getAccount: vi.fn().mockResolvedValue({ login: 'tester', name: 'Tester' }),
      isConnected: vi.fn().mockResolvedValue(true),
      storageEncrypted: vi.fn().mockResolvedValue(false),
      listRepos: vi.fn().mockResolvedValue([]),
    })
    expect(await screen.findByText(/Token stored without encryption/i)).toBeInTheDocument()
  })

  it('does not warn when encrypted storage is available', async () => {
    renderPane({
      getAccount: vi.fn().mockResolvedValue({ login: 'tester', name: 'Tester' }),
      isConnected: vi.fn().mockResolvedValue(true),
      storageEncrypted: vi.fn().mockResolvedValue(true),
      listRepos: vi.fn().mockResolvedValue([]),
    })
    await screen.findByText('@tester')
    expect(screen.queryByText(/Token stored without encryption/i)).not.toBeInTheDocument()
  })
})
