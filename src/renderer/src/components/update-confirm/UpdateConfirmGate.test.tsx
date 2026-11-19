// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { setup } from '../../test/harness'
import { makeIndexEntry, makePrinter } from '../../test/fixtures'
import { makeT } from '../../i18n'
import { UpdateConfirmGate } from './UpdateConfirmGate'

const en = makeT('en')
const PRINTER = makePrinter({ installedIds: ['camera'], installedVersions: { camera: '1.0.0' } })
const CAMERA_ENTRY = makeIndexEntry({
  name: 'camera', title: 'Camera', version: '2.0.0',
  config: [{ key: 'CAMERA_FREEZE_RECOVERY', label: 'Freeze recovery', type: 'text', required: true }],
})
const PENDING = { printerId: PRINTER.id, plan: { updates: [{ pluginId: 'camera', vars: {} }], migrations: [] } }

function renderGate(printerValues: Record<string, string> | null) {
  const onConfirm = vi.fn()
  const pluginConfig = vi.fn().mockResolvedValue(printerValues)
  const rendered = setup(
    <UpdateConfirmGate pending={PENDING} printers={[PRINTER]} onConfirm={onConfirm} onCancel={vi.fn()} />,
    { withCatalog: true, catalog: [CAMERA_ENTRY], b3d: { store: { pluginConfig } } },
  )

  return { onConfirm, ...rendered }
}

describe('UpdateConfirmGate', () => {
  it('asks for a required value nobody gave, and sends the update with it', async () => {
    const { user, onConfirm } = renderGate(null)
    await user.click(await screen.findByRole('button', { name: en('store.update_confirm.confirm') }))
    await user.type(await screen.findByRole('textbox'), '1')
    await user.click(screen.getByRole('button', { name: en('batch_config.update', { count: 1 }) }))
    expect(onConfirm).toHaveBeenCalledWith({ updates: [{ pluginId: 'camera', vars: { CAMERA_FREEZE_RECOVERY: '1' } }], migrations: [] })
  })

  it('sends the update at once when the printer already has the value', async () => {
    const { user, onConfirm } = renderGate({ CAMERA_FREEZE_RECOVERY: '1' })
    await user.click(await screen.findByRole('button', { name: en('store.update_confirm.confirm') }))
    await vi.waitFor(() => expect(onConfirm).toHaveBeenCalledWith(PENDING.plan))
    expect(screen.queryByText(en('batch_config.update_body'))).not.toBeInTheDocument()
  })
})
