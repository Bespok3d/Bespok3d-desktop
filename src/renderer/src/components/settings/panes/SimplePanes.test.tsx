// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { setup } from '../../../test/harness'
import { makeT } from '../../../i18n'
import { AppearancePane } from './AppearancePane'
import { LabsPane } from './LabsPane'
import { AboutPane } from './AboutPane'
import type { LocaleSettings } from './language'

const en = makeT('en')
const locale: LocaleSettings = { locale: 'system', firstDayOfWeek: 'auto', units: 'metric' }

describe('AppearancePane', () => {
  it('reports theme and density changes through its callbacks', async () => {
    var onSetTheme = vi.fn()
    var onSetDensity = vi.fn()
    var { user } = setup(
      <AppearancePane
        theme="system" onSetTheme={onSetTheme} density="comfortable" onSetDensity={onSetDensity}
        storeGrouped={false} onSetStoreGrouped={vi.fn()} localeSettings={locale} onLocaleChange={vi.fn()}
      />,
    )
    await user.click(screen.getByRole('button', { name: en('app.theme_light') }))
    expect(onSetTheme).toHaveBeenCalledWith('light')
  })
})

describe('LabsPane', () => {
  it('persists the workbench layout choice', async () => {
    var { user, b3d } = setup(<LabsPane />)
    await screen.findByText(en('labs.layout_label'))
    await user.click(screen.getByRole('button', { name: en('labs.layout_b') }))
    expect(b3d.settings.set).toHaveBeenCalledWith({ workbenchLayout: 'B' })
  })
})

describe('AboutPane', () => {
  it('opens the support link', async () => {
    var { user, b3d } = setup(<AboutPane />)
    await user.click(screen.getByRole('button', { name: /coffee/i }))
    expect(b3d.openUrl).toHaveBeenCalledWith('https://buymeacoffee.com/unlucio')
  })

  it('shows the copyright, the licence and the absence of warranty', () => {
    setup(<AboutPane />)
    expect(screen.getByText(en('about.copyright'))).toBeTruthy()
    expect(screen.getByText(en('about.license'))).toBeTruthy()
    expect(screen.getByText(en('about.warranty'))).toBeTruthy()
    expect(en('about.license')).toContain('or any later version')
  })

  it('offers the source for this version at the project repository', async () => {
    var { user, b3d } = setup(<AboutPane />)
    expect(screen.getByText(en('about.source'))).toBeTruthy()
    await user.click(screen.getByRole('link', { name: en('about.github') }))
    expect(b3d.openUrl).toHaveBeenCalledWith('https://github.com/Bespok3d/Bespok3d-desktop')
  })
})
