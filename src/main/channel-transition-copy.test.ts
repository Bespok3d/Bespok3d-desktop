// SPDX-FileCopyrightText: Copyright (C) 2026 Luciano Colosio
import { afterAll, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { channelTransitionText } from './channel-transition-copy'

const betaProfile = mkdtempSync(join(tmpdir(), 'b3d-transition-locale-'))

afterAll(() => rmSync(betaProfile, { recursive: true, force: true }))

describe('the Beta transition prompt language', () => {
  it('uses the Beta profile language preference for all transition choices', () => {
    writeFileSync(join(betaProfile, 'settings.json'), JSON.stringify({ uiLocale: 'it' }))

    expect(channelTransitionText('title', betaProfile, 'en')).toBe('Bespok3d Staging')
    expect(channelTransitionText('copy', betaProfile, 'en')).toBe('Copia dati Beta')
    expect(channelTransitionText('conflict', betaProfile, 'en')).toContain('Staging contiene già dati')
  })

  it('uses the operating-system locale when the Beta profile follows the system', () => {
    writeFileSync(join(betaProfile, 'settings.json'), JSON.stringify({ uiLocale: 'system' }))

    expect(channelTransitionText('copy', betaProfile, 'fr-FR')).toBe('Copier les données Beta')
  })

  it('falls back to English for unsupported system languages', () => {
    expect(channelTransitionText('fresh', betaProfile, 'xx-YY')).toBe('Start Staging fresh')
  })
})
