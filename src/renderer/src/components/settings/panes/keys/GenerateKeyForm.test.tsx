// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { setup } from '../../../../test/harness'
import { GenerateKeyForm } from './GenerateKeyForm'

describe('GenerateKeyForm', () => {
  it('generates a key with the entered label', async () => {
    var onGenerate = vi.fn().mockResolvedValue(undefined)
    var { user } = setup(<GenerateKeyForm onGenerate={onGenerate} />)

    expect(screen.getByRole('button', { name: /Generate/ })).toBeDisabled()
    await user.type(screen.getByPlaceholderText(/Label/), 'My laptop')
    await user.click(screen.getByRole('button', { name: /Generate/ }))
    expect(onGenerate).toHaveBeenCalledWith('My laptop')
  })

  it('surfaces a generation error', async () => {
    var onGenerate = vi.fn().mockRejectedValue(new Error('gpg not available'))
    var { user } = setup(<GenerateKeyForm onGenerate={onGenerate} />)
    await user.type(screen.getByPlaceholderText(/Label/), 'Key')
    await user.click(screen.getByRole('button', { name: /Generate/ }))
    expect(await screen.findByText('gpg not available')).toBeInTheDocument()
  })
})
