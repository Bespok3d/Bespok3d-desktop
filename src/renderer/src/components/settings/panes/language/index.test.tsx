// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { setup, realI18nValue } from '../../../../test/harness'
import { I18nProvider } from '../../../../i18n/context'
import { LanguagePane, makeDefaultLocaleSettings } from './index'
import type { LocaleSettings } from './index'

const base: LocaleSettings = { locale: 'en', firstDayOfWeek: 'auto', units: 'metric' }

describe('LanguagePane', () => {
  it('a fresh install shows the machine-language toggle already on', () => {
    setup(<LanguagePane settings={makeDefaultLocaleSettings()} onChange={vi.fn()} />)
    expect(screen.getByRole('switch')).toBeChecked()
  })

  it('the machine-language toggle stores "system", not the language it currently resolves to', async () => {
    var setLocale = vi.fn()
    var { user } = setup(
      <I18nProvider value={{ ...realI18nValue(), setLocale }}>
        <LanguagePane settings={base} onChange={vi.fn()} />
      </I18nProvider>
    )
    await user.click(screen.getByRole('switch'))
    expect(setLocale).toHaveBeenCalledWith('system')
  })

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
