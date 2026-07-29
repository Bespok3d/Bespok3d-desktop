// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useState, type DependencyList } from 'react'
import { useAsyncEffect } from './useAsyncEffect'
import { errorMessage } from '../../../utils/errorMessage'

interface AsyncResource<T> {
  value: T | null
  error: string | null
  loading: boolean
  reload: () => void
}

// Loads a one-shot resource (a window.b3d.* fetch) into state, re-running when `deps` change. Built on
// useAsyncEffect so a late resolve after unmount never sets state on a dead tree. Several panes
// hand-rolled this as `.then(setState).catch(() => {})`, which silently swallowed the failure; here a
// rejection is captured as `error` instead of being lost. `reload` re-fetches on demand.
export function useAsyncResource<T>(load: () => Promise<T>, deps: DependencyList): AsyncResource<T> {
  const [value, setValue] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [reloadCount, setReloadCount] = useState(0)

  async function fetchResource(stale: () => boolean) {
    setLoading(true)
    setError(null)
    try {
      const loaded = await load()
      if (!stale()) { setValue(loaded); setLoading(false) }
    } catch (caught: unknown) {
      if (stale()) return
      setError(errorMessage(caught))
      setLoading(false)
    }
  }
  useAsyncEffect(fetchResource, [...deps, reloadCount])

  function reload() { setReloadCount((prev) => prev + 1) }

  return { value, error, loading, reload }
}
