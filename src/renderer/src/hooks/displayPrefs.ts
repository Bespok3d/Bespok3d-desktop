import { useEffect, useState } from 'react'
import { useAsyncEffect } from '../components/common/hooks/useAsyncEffect'

export type Theme = 'light' | 'dark' | 'system'
export type Density = 'compact' | 'comfortable' | 'spacious'

type DisplayPatch = Partial<{ theme: Theme; density: Density; storeGrouped: boolean }>

function prefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function persist(patch: DisplayPatch): void {
  void window.b3d.settings.set(patch)
}

// The explicit theme pick resolved against the OS: a concrete 'light'/'dark' is honored as-is, while
// 'system' follows whether the OS currently prefers dark.
function resolveThemePreference(theme: Theme, sysDark: boolean): 'light' | 'dark' {
  if (theme !== 'system') return theme

  return sysDark ? 'dark' : 'light'
}

// The shell's display preferences, backed by the main settings store so they survive a reload (theme,
// density, store grouping). themeOverride is a session-only toggle (the header sun/moon) that does not
// persist; the persisted `theme` is the user's explicit pick, resolved against the OS for 'system'.
export function useDisplayPrefs() {
  const [theme, setThemeState] = useState<Theme>('system')
  const [themeOverride, setThemeOverride] = useState<'light' | 'dark' | null>(null)
  const [density, setDensityState] = useState<Density>('comfortable')
  const [storeGrouped, setStoreGroupedState] = useState(false)
  const [sysDark, setSysDark] = useState(prefersDark)

  useAsyncEffect(async (stale) => {
    const settings = await window.b3d.settings.get()
    if (stale()) return
    setThemeState(settings.theme ?? 'system')
    setDensityState(settings.density ?? 'comfortable')
    setStoreGroupedState(settings.storeGrouped ?? false)
  }, [])

  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)')
    function onChange(event: MediaQueryListEvent) { setSysDark(event.matches) }
    query.addEventListener('change', onChange)

    return () => query.removeEventListener('change', onChange)
  }, [])

  function setTheme(next: Theme) { setThemeState(next); persist({ theme: next }) }
  function setDensity(next: Density) { setDensityState(next); persist({ density: next }) }
  function setStoreGrouped(next: boolean) { setStoreGroupedState(next); persist({ storeGrouped: next }) }

  const preference: 'light' | 'dark' = resolveThemePreference(theme, sysDark)
  const resolved: 'light' | 'dark' = themeOverride ?? preference

  return { theme, setTheme, themeOverride, setThemeOverride, resolved, density, setDensity, storeGrouped, setStoreGrouped }
}
