// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { setup } from '../../test/harness'
import { makeT } from '../../i18n'
import { AddPrinter } from './index'
import type { DiscoveredPrinterRecord } from '../../env'

const en = makeT('en')

function device(): DiscoveredPrinterRecord {
  return { id: 'dev-1', host: 'u1.local', ip: '10.0.0.5', model: 'Snapmaker U1', vendor: 'Snapmaker', service: '_klipper._tcp' }
}

describe('AddPrinter manual entry', () => {
  it('builds and adds a manual printer with the custom-SSH preference', async () => {
    var onAdd = vi.fn()
    var { user } = setup(
      <AddPrinter initialTab="manual" discovered={[]} existingPrinters={[]} onAdd={onAdd} onClose={vi.fn()} />,
    )

    await user.type(screen.getByPlaceholderText(en('add.ip_placeholder')), '10.0.0.9')
    await user.type(screen.getByPlaceholderText(en('add.nick_placeholder')), 'Workshop U1')
    await user.click(screen.getByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: en('add.submit') }))

    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ ip: '10.0.0.9', nick: 'Workshop U1', customSshCredentials: true }))
  })

  it('keeps Add disabled until the required fields are filled', () => {
    setup(<AddPrinter initialTab="manual" discovered={[]} existingPrinters={[]} onAdd={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByRole('button', { name: en('add.submit') })).toBeDisabled()
  })
})

describe('AddPrinter tab reset', () => {
  it('clears a typed manual IP when the tab is switched away and back', async () => {
    var { user } = setup(
      <AddPrinter initialTab="manual" discovered={[]} existingPrinters={[]} onAdd={vi.fn()} onClose={vi.fn()} />,
    )

    await user.type(screen.getByPlaceholderText(en('add.ip_placeholder')), '10.0.0.9')
    await user.click(screen.getByRole('button', { name: /Scan/ }))
    await user.click(screen.getByRole('button', { name: /Manual/ }))

    expect(screen.getByPlaceholderText(en('add.ip_placeholder'))).toHaveValue('')
  })
})

describe('AddPrinter discovery pick', () => {
  it('adds a picked discovered printer carrying its address', async () => {
    var onAdd = vi.fn()
    var { user } = setup(
      <AddPrinter initialTab="scan" initialPickedId="dev-1" discovered={[device()]} existingPrinters={[]} onAdd={onAdd} onClose={vi.fn()} />,
    )

    await user.type(screen.getByPlaceholderText(en('add.nick_label')), 'Bench')
    await user.click(screen.getByRole('button', { name: en('add.submit') }))

    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ ip: '10.0.0.5', model: 'Snapmaker U1', nick: 'Bench' }))
  })
})
