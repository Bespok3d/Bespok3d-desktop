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
