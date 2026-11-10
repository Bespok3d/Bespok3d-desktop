// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useState } from 'react'

// Backs React state with a localStorage key: the initial value is read once (falling back to
// `fallback` when the key is missing or the stored JSON is corrupt) and `setValue` writes through.
// Several callers hand-rolled this load/parse/try-catch + setItem pair (channel prefs, saved vars).
export function useLocalStorageState<T>(key: string, fallback: T): [T, (next: T) => void] {
  const [value, setValue] = useState<T>(() => readStoredJson(key, fallback))

  function update(next: T): void {
    setValue(next)
    writeStoredJson(key, next)
  }

  return [value, update]
}

// The stored value, or `fallback` when the key is missing or its JSON is corrupt.
export function readStoredJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)

    return raw == null ? fallback : (JSON.parse(raw) as T)
  } catch {
    return fallback
  }
}

export function writeStoredJson<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // localStorage may be unavailable (private mode, quota); persistence is best-effort.
  }
}
