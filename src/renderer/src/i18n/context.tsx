// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { createContext, useContext } from 'react'
import type { ReactNode } from 'react'
import { makeT, detectSystemLocale } from './index'
import type { TFunction } from './index'

export interface I18nValue {
  locale: string
  t: TFunction
  setLocale: (locale: string) => void
  customLocales: Record<string, Record<string, string>>
  setCustomTranslations: (code: string, dict: Record<string, string>) => void
}

const defaultLocale = detectSystemLocale()

const I18nContext = createContext<I18nValue>({
  locale: defaultLocale,
  t: makeT(defaultLocale),
  setLocale: () => {},
  customLocales: {},
  setCustomTranslations: () => {},
})

export function useI18n(): I18nValue {
  return useContext(I18nContext)
}

export function I18nProvider({ value, children }: { value: I18nValue; children: ReactNode }) {
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}
