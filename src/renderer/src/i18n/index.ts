// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import en from './locales/en.json'
import fr from './locales/fr.json'
import de from './locales/de.json'
import es from './locales/es.json'
import ja from './locales/ja.json'
import zhCN from './locales/zh-CN.json'
import ptBR from './locales/pt-BR.json'
import it from './locales/it.json'
import ko from './locales/ko.json'
import tr from './locales/tr.json'

export interface Locale {
  code: string
  name: string
  nativeName: string
  region: string
}

export type TFunction = (key: string, params?: Record<string, string | number>) => string

export const LOCALES: Locale[] = [
  { code: 'en',    name: 'English',               nativeName: 'English',          region: 'GB' },
  { code: 'fr',    name: 'French',                nativeName: 'Français',          region: 'FR' },
  { code: 'de',    name: 'German',                nativeName: 'Deutsch',           region: 'DE' },
  { code: 'es',    name: 'Spanish',               nativeName: 'Español',           region: 'ES' },
  { code: 'ja',    name: 'Japanese',              nativeName: '日本語',             region: 'JP' },
  { code: 'zh-CN', name: 'Chinese (Simplified)',  nativeName: '中文（简体）',       region: 'CN' },
  { code: 'pt-BR', name: 'Portuguese (Brazil)',   nativeName: 'Português (BR)',    region: 'BR' },
  { code: 'it',    name: 'Italian',               nativeName: 'Italiano',          region: 'IT' },
  { code: 'ko',    name: 'Korean',                nativeName: '한국어',             region: 'KR' },
  { code: 'tr',    name: 'Turkish',               nativeName: 'Türkçe',            region: 'TR' },
]

export const LOCALE_DATA: Record<string, Record<string, string>> = {
  en, fr, de, es, ja, 'zh-CN': zhCN, 'pt-BR': ptBR, it, ko, tr,
}

const EN_KEY_COUNT = Object.keys(en).length

export function localeProgress(code: string): number {
  if (code === 'en') return 100
  const data = LOCALE_DATA[code]
  if (!data) return 0

  return Math.round((Object.keys(data).length / EN_KEY_COUNT) * 100)
}

export function makeT(localeCode: string, customDict?: Record<string, string>): TFunction {
  const builtIn = LOCALE_DATA[localeCode] ?? LOCALE_DATA['en']
  const dict = customDict ? { ...builtIn, ...customDict } : builtIn
  const enDict = LOCALE_DATA['en']

  return function t(key, params) {
    const base = dict[key] ?? enDict[key] ?? key
    if (!params) return base

    return Object.entries(params).reduce(
      (acc, [paramKey, paramVal]) => acc.split(`{${paramKey}}`).join(String(paramVal)),
      base
    )
  }
}

export function detectSystemLocale(): string {
  const systemLanguage = typeof navigator !== 'undefined' ? (navigator.language ?? '') : ''
  const match =
    LOCALES.find((locale) => locale.code === systemLanguage) ??
    LOCALES.find((locale) => systemLanguage.startsWith(locale.code)) ??
    LOCALES.find((locale) => locale.code.split('-')[0] === systemLanguage.split('-')[0])

  return match?.code ?? 'en'
}
