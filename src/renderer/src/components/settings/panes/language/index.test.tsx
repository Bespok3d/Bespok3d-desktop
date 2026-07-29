// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { setup } from '../../../../test/harness'
import { LanguagePane } from './index'
import type { LocaleSettings } from './index'

const base: LocaleSettings = { locale: 'en', firstDayOfWeek: 'auto', units: 'metric' }

describe('LanguagePane', () => {
  it('switches to the system locale when the toggle is enabled', async () => {
    var onChange = vi.fn()
    var { user } = setup(<LanguagePane settings={base} onChange={onChange} />)
    await user.click(screen.getByRole('switch'))
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ locale: 'system' }))
  })

  it('picks an explicit locale from the list', async () => {
    var onChange = vi.fn()
    var { user, container } = setup(<LanguagePane settings={base} onChange={onChange} />)
    var rows = container.querySelectorAll('.locale-row-main')
    await user.click(rows[rows.length - 1] as HTMLElement)
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ locale: expect.any(String) }))
  })
})
