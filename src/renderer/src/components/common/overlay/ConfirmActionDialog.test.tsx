// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen } from '@testing-library/react'
import { setup } from '../../../test/harness'
import { makeT } from '../../../i18n'
import { ConfirmActionDialog, shouldSkipConfirm } from './ConfirmActionDialog'

const en = makeT('en')
const SUPPRESS_KEY = 'b3d.test.suppress'

afterEach(() => localStorage.removeItem(SUPPRESS_KEY))

function renderDialog(props: Partial<React.ComponentProps<typeof ConfirmActionDialog>>) {
  return setup(
    <ConfirmActionDialog
      title="Remove plugin?"
      summary="This removes the plugin."
      detail="The files are deleted from the printer."
      confirmLabel="Remove"
      onConfirm={vi.fn()}
      onCancel={vi.fn()}
      {...props}
    />,
  )
}

describe('ConfirmActionDialog', () => {
  it('confirms and cancels through the right handlers', async () => {
    var onConfirm = vi.fn()
    var onCancel = vi.fn()
    var { user } = renderDialog({ onConfirm, onCancel })
    await user.click(screen.getByRole('button', { name: 'Remove' }))
    expect(onConfirm).toHaveBeenCalledOnce()
    await user.click(screen.getByRole('button', { name: en('btn.cancel') }))
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('persists the do-not-show-again preference to localStorage', async () => {
    var { user } = renderDialog({ suppressKey: SUPPRESS_KEY })
    expect(shouldSkipConfirm(SUPPRESS_KEY)).toBe(false)
    await user.click(screen.getByRole('checkbox'))
    expect(shouldSkipConfirm(SUPPRESS_KEY)).toBe(true)
  })

  it('has no suppress checkbox without a suppress key', () => {
    renderDialog({})
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })
})
