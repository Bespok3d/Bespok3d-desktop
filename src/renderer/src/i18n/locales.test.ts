// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect } from 'vitest'
import { LOCALE_DATA } from './index'

const english = LOCALE_DATA['en']
const translatedLocales = Object.keys(LOCALE_DATA).filter((code) => code !== 'en')
const emDash = String.fromCharCode(0x2014)
const enDash = String.fromCharCode(0x2013)

function placeholdersIn(text: string): string[] {
  return [...new Set(text.match(/\{\w+\}/g) ?? [])].sort()
}

function keysEnglishHasButLocaleLacks(dictionary: Record<string, string>): string[] {
  return Object.keys(english).filter((key) => !(key in dictionary))
}

function keysLocaleHasButEnglishLacks(dictionary: Record<string, string>): string[] {
  return Object.keys(dictionary).filter((key) => !(key in english))
}

function keysWithOtherPlaceholders(dictionary: Record<string, string>): string[] {
  return Object.keys(english)
    .filter((key) => key in dictionary)
    .filter((key) => placeholdersIn(dictionary[key]).join() !== placeholdersIn(english[key]).join())
}

function keysWithDashes(dictionary: Record<string, string>): string[] {
  return Object.entries(dictionary)
    .filter(([, text]) => text.includes(emDash) || text.includes(enDash))
    .map(([key]) => key)
}

describe.each(translatedLocales)('the %s words', (code) => {
  const dictionary = LOCALE_DATA[code]

  it('have every text the app shows in English', () => {
    expect(keysEnglishHasButLocaleLacks(dictionary)).toEqual([])
  })

  it('hold no text the app no longer shows', () => {
    expect(keysLocaleHasButEnglishLacks(dictionary)).toEqual([])
  })

  it('fill in the same names as the English text', () => {
    expect(keysWithOtherPlaceholders(dictionary)).toEqual([])
  })

  it('contain no em-dash or en-dash (RULE ZERO)', () => {
    expect(keysWithDashes(dictionary)).toEqual([])
  })
})
