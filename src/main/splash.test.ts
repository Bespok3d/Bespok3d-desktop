// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect, vi } from 'vitest'

const splashWindow = vi.hoisted(() => ({ loadedUrls: [] as string[] }))

vi.mock('electron', () => ({
  app: { getVersion: () => '0.0.0-test' },
  BrowserWindow: class {
    loadURL(url: string): void {
      splashWindow.loadedUrls.push(url)
    }
  },
}))

import { splashDocument, createSplash } from './splash'

describe('splash screen', () => {
  it('names the build: the app name and the version the user is about to run', () => {
    const document = splashDocument('Bespok3d', '0.1.0-alpha.33')

    expect(document).toContain('<h1>Bespok3d</h1>')
    expect(document).toContain('0.1.0-alpha.33')
  })

  it('shows the dev build under its own name so it is not mistaken for the release', () => {
    expect(splashDocument('Bespok3d Dev', '0.1.0-alpha.33')).toContain('<h1>Bespok3d Dev</h1>')
  })

  it('survives being carried in a data: URL', () => {
    const roundTripped = decodeURIComponent(encodeURIComponent(splashDocument('Bespok3d', '1.2.3')))

    expect(roundTripped).toContain('1.2.3')
  })

  it('puts the running build version on screen, not just in the template', () => {
    createSplash('Bespok3d')
    const shown = decodeURIComponent(splashWindow.loadedUrls[0])

    expect(shown).toContain('<h1>Bespok3d</h1>')
    expect(shown).toContain('0.0.0-test')
  })
})
