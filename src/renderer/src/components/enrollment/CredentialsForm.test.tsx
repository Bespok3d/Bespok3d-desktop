// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { act, screen } from '@testing-library/react'
import { setup } from '../../test/harness'
import { makeAdapterInfo } from '../../test/fixtures'
import { CredentialsForm } from './CredentialsForm'

function formFor(adapterId: string) {
  return <CredentialsForm printerId="printer-1" ip="192.0.2.23" adapterId={adapterId} onStart={vi.fn()} onCancel={vi.fn()} />
}

function renderForm(printers = {}) {
  return setup(formFor('snapmaker-u1'), { b3d: { printers } })
}

function adapterDefaultsArriveLater() {
  var arrive = { now: () => {} }
  var adapterGet = vi.fn(() => new Promise((resolve) => {
    arrive.now = () => resolve(makeAdapterInfo({ defaults: { sshUser: 'root', sshPort: 2200, sshPasswordHint: '', runtimeUser: 'lava' } }))
  }))

  return { adapterGet, arrive }
}

describe('CredentialsForm', () => {
  it('ties each label to its field', async () => {
    renderForm()
    expect(screen.getByLabelText('SSH password')).toHaveAttribute('type', 'password')
    expect(await screen.findByDisplayValue('root')).toBe(screen.getByLabelText('SSH user'))
    expect(screen.getByLabelText('Port')).toHaveValue(22)
  })

  it('says why the login fields start empty when the adapter cannot be read, while the fields still match it', async () => {
    var { user } = renderForm({ adapterGet: vi.fn().mockRejectedValue(new Error('fixture adapter unreadable')) })
    expect(await screen.findByText(/could not read this printer's adapter/)).toBeInTheDocument()
    expect(screen.getByLabelText('SSH user')).toHaveValue('')
    expect(screen.getByLabelText('Port')).toHaveValue(22)

    await user.type(screen.getByLabelText('SSH user'), 'owner')
    expect(screen.queryByText(/could not read this printer's adapter/)).not.toBeInTheDocument()
    await user.clear(screen.getByLabelText('SSH user'))
    expect(screen.getByText(/could not read this printer's adapter/)).toBeInTheDocument()
  })

  it('drops the last adapter defaults when the next adapter cannot be read', async () => {
    var adapterGet = vi.fn()
      .mockResolvedValueOnce(makeAdapterInfo({ defaults: { sshUser: 'fixture-factory-user', sshPort: 2200, sshPasswordHint: '', runtimeUser: 'lava' } }))
      .mockRejectedValue(new Error('fixture adapter unreadable'))
    var { rerender } = renderForm({ adapterGet })
    expect(await screen.findByDisplayValue('fixture-factory-user')).toBeInTheDocument()

    rerender(formFor('fixture-other-adapter'))
    expect(await screen.findByText(/could not read this printer's adapter/)).toBeInTheDocument()
    expect(screen.getByLabelText('SSH user')).toHaveValue('')
    expect(screen.getByLabelText('Port')).toHaveValue(22)
  })

  it('never starts with a port no printer can listen on', async () => {
    var { user } = renderForm()
    await user.type(screen.getByLabelText('SSH password'), 'their-secret')
    await user.clear(screen.getByLabelText('Port'))
    await user.type(screen.getByLabelText('Port'), '70000')
    expect(screen.getByRole('button', { name: 'Test connection' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Start enrollment' })).toBeDisabled()
  })

  it('leaves a cleared port empty and never starts with it', async () => {
    var { user } = renderForm()
    await user.type(screen.getByLabelText('SSH password'), 'their-secret')
    await user.clear(screen.getByLabelText('Port'))
    expect(screen.getByLabelText('Port')).toHaveValue(null)
    expect(screen.getByRole('button', { name: 'Start enrollment' })).toBeDisabled()
  })

  it('never lets late adapter defaults overwrite the user and port the user typed', async () => {
    var lateDefaults = adapterDefaultsArriveLater()
    var { user } = renderForm({ adapterGet: lateDefaults.adapterGet })
    await user.type(screen.getByLabelText('SSH user'), 'owner')
    await user.clear(screen.getByLabelText('Port'))
    await user.type(screen.getByLabelText('Port'), '2222')

    await act(async () => lateDefaults.arrive.now())
    expect(screen.getByLabelText('SSH user')).toHaveValue('owner')
    expect(screen.getByLabelText('Port')).toHaveValue(2222)
  })
})

describe('CredentialsForm test connection', () => {
  it('tells a failed test connection in user words, for the port it tried', async () => {
    var { user } = renderForm({ checkSsh: vi.fn().mockResolvedValue({ ok: false, error: 'connect ECONNREFUSED 192.0.2.23:2222' }) })
    await user.type(screen.getByLabelText('SSH password'), 'their-secret')
    await user.clear(screen.getByLabelText('Port'))
    await user.type(screen.getByLabelText('Port'), '2222')
    await user.click(screen.getByRole('button', { name: 'Test connection' }))
    expect(await screen.findByText(/^The printer refused the SSH connection/)).toBeInTheDocument()
  })

  it('tells a test connection the app could not run, instead of testing forever', async () => {
    var { user } = renderForm({ checkSsh: vi.fn().mockRejectedValue(new Error('Timed out while waiting for handshake')) })
    await user.type(screen.getByLabelText('SSH password'), 'their-secret')
    await user.click(screen.getByRole('button', { name: 'Test connection' }))
    expect(await screen.findByText(/^The printer did not finish the SSH login in time/)).toBeInTheDocument()
  })

  it('drops a test connection result once the user edits what it tested', async () => {
    var { user } = renderForm({ checkSsh: vi.fn().mockResolvedValue({ ok: true }) })
    await user.type(screen.getByLabelText('SSH password'), 'their-secret')
    await user.click(screen.getByRole('button', { name: 'Test connection' }))
    expect(await screen.findByText('Connected')).toBeInTheDocument()

    await user.type(screen.getByLabelText('SSH password'), '-changed')
    expect(screen.queryByText('Connected')).not.toBeInTheDocument()
  })

  it('never shows a late test connection answer for values the user changed meanwhile', async () => {
    var answer = { give: (_outcome: { ok: boolean }) => {} }
    var checkSsh = vi.fn(() => new Promise((resolve) => { answer.give = resolve }))
    var { user } = renderForm({ checkSsh })
    await user.type(screen.getByLabelText('SSH password'), 'their-secret')
    await user.click(screen.getByRole('button', { name: 'Test connection' }))
    await user.type(screen.getByLabelText('SSH password'), '-changed')

    await act(async () => answer.give({ ok: true }))
    expect(screen.queryByText('Connected')).not.toBeInTheDocument()
  })

  it("waits for the adapter's own port before it tests or starts", async () => {
    var lateDefaults = adapterDefaultsArriveLater()
    var { user } = renderForm({ adapterGet: lateDefaults.adapterGet })
    await user.type(screen.getByLabelText('SSH user'), 'owner')
    await user.type(screen.getByLabelText('SSH password'), 'their-secret')
    expect(screen.getByLabelText('Port')).toHaveValue(null)
    expect(screen.getByRole('button', { name: 'Test connection' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Start enrollment' })).toBeDisabled()

    await act(async () => lateDefaults.arrive.now())
    expect(screen.getByLabelText('Port')).toHaveValue(2200)
    expect(screen.getByRole('button', { name: 'Test connection' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Start enrollment' })).toBeEnabled()
  })

  it('never lets an older test connection that ends late replace the newer result', async () => {
    var answers: Array<(outcome: { ok: boolean }) => void> = []
    var checkSsh = vi.fn(() => new Promise((resolve) => { answers.push(resolve) }))
    var { user } = renderForm({ checkSsh })
    await user.type(screen.getByLabelText('SSH password'), 'their-secret')
    await user.click(screen.getByRole('button', { name: 'Test connection' }))
    await user.clear(screen.getByLabelText('Port'))
    await user.type(screen.getByLabelText('Port'), '2222')
    await user.click(screen.getByRole('button', { name: 'Test connection' }))

    await act(async () => answers[1]({ ok: true }))
    await act(async () => answers[0]({ ok: false }))
    expect(screen.getByText('Connected')).toBeInTheDocument()
  })
})
