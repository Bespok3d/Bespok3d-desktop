// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useState, useMemo } from 'react'
import { makeT, detectSystemLocale } from '../i18n'
import { useAsyncEffect } from '../components/common/hooks/useAsyncEffect'

// The stored preference is either a locale code or 'system' (follow the OS), and 'system' is what a
// fresh install carries: the app ships full translations, so the language it opens in is the one the
// machine is set to until the user picks another.
export function useAppI18n() {
  const [localePref, setLocalePref] = useState('system')
  const [customLocales, setCustomLocales] = useState<Record<string, Record<string, string>>>({})
  useAsyncEffect(async (stale) => {
    const settings = await window.b3d.settings.get()
    if (stale() || !settings.uiLocale) return
    setLocalePref(settings.uiLocale)
  }, [])
  function changeLocale(next: string) { setLocalePref(next); void window.b3d.settings.set({ uiLocale: next }) }
  const locale = localePref === 'system' ? detectSystemLocale() : localePref
  const i18n = useMemo(() => ({
    locale,
    t: makeT(locale, customLocales[locale]),
    setLocale: changeLocale,
    customLocales,
    setCustomTranslations(code: string, dict: Record<string, string>) {
      setCustomLocales((prev) => ({ ...prev, [code]: dict }))
    },
  }), [locale, customLocales])

  return { i18n, localePref, setLocalePref: changeLocale }
}
