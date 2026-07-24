import { useState, useMemo } from 'react'
import { makeT, detectSystemLocale } from '../i18n'
import { useAsyncEffect } from '../components/common/hooks/useAsyncEffect'

export function useAppI18n() {
  const [localePref, setLocalePref] = useState(detectSystemLocale)
  const [customLocales, setCustomLocales] = useState<Record<string, Record<string, string>>>({})
  useAsyncEffect(async (stale) => {
    const settings = await window.b3d.settings.get()
    if (stale() || !settings.uiLocale) return
    setLocalePref(settings.uiLocale)
  }, [])
  function changeLocale(next: string) { setLocalePref(next); void window.b3d.settings.set({ uiLocale: next }) }
  const i18n = useMemo(() => ({
    locale: localePref,
    t: makeT(localePref, customLocales[localePref]),
    setLocale: changeLocale,
    customLocales,
    setCustomTranslations(code: string, dict: Record<string, string>) {
      setCustomLocales((prev) => ({ ...prev, [code]: dict }))
    },
  }), [localePref, customLocales])

  return { i18n, localePref, setLocalePref: changeLocale }
}
