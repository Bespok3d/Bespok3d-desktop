// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { setup } from '../../../../test/harness'
import { GitHostPane } from './index'

function connected() {
  return {
    getAccount: vi.fn().mockResolvedValue({ login: 'tester', name: 'Tester' }),
    isConnected: vi.fn().mockResolvedValue(true),
    storageEncrypted: vi.fn().mockResolvedValue(true),
    settings: vi.fn().mockResolvedValue({ type: 'github' as const, pluginRepos: [], listRepos: [] }),
    listRepos: vi.fn().mockResolvedValue([{ owner: 'tester', repo: 'my-plugins', url: '', isNew: false }]),
  }
}

describe('GitHostPane repo adder', () => {
  it('adds a selected repository to the plugin sources', async () => {
    var { user, b3d } = setup(<GitHostPane onSettingsUpdated={vi.fn()} />, { b3d: { gitHost: connected() } })

    await user.click((await screen.findAllByRole('button', { name: 'Add repository' }))[0])
    await user.selectOptions(await screen.findByRole('combobox'), 'tester/my-plugins')

    expect(b3d.gitHost.writeSettings).toHaveBeenCalledWith(expect.objectContaining({
      pluginRepos: [{ owner: 'tester', repo: 'my-plugins' }],
    }))
  })

  // Regression: loadOwners is total, so a failing account probe while opening the create form no
  // longer aborts owner loading; org listing still populates the owner picker (no swallowed rejection).
  it('still lists org owners when the account probe fails while opening the create form', async () => {
    var gitHost = {
      ...connected(),
      getAccount: vi.fn()
        .mockResolvedValueOnce({ login: 'tester', name: 'Tester' })
        .mockRejectedValue(new Error('account probe failed')),
      listOrgs: vi.fn().mockResolvedValue(['acme-org']),
    }
    var { user } = setup(<GitHostPane onSettingsUpdated={vi.fn()} />, { b3d: { gitHost } })

    await user.click((await screen.findAllByRole('button', { name: 'Add repository' }))[0])
    await user.click(await screen.findByRole('button', { name: '+ New' }))

    expect(await screen.findByRole('option', { name: 'acme-org' })).toBeInTheDocument()
  })
})
