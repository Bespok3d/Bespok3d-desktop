// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useState, useEffect } from 'react'
import { useAsyncResource } from '../common/hooks/useAsyncResource'
import type { KeyRecord, KeyAssignment } from '../../data/keyTypes'

type RepoRef = { owner: string; repo: string }

function reposPresentIn(candidates: RepoRef[] | undefined, available: RepoRef[]) {
  return (candidates ?? []).filter((repo) => available.some((known) => known.owner === repo.owner && known.repo === repo.repo))
}

export function useAdaptersList() {
  const { value } = useAsyncResource(() => window.b3d.printers.adaptersList(), [])

  return value ?? []
}

export function useGitHostSettings() {
  const [settings, setSettings] = useState<GitHostSettings | null>(null)
  const [allUserRepos, setAllUserRepos] = useState<RepoRef[]>([])
  const [loaded, setLoaded] = useState(false)

  async function load() {
    const [connected, settingsData] = await Promise.all([
      window.b3d.gitHost.isConnected(),
      window.b3d.gitHost.settings(),
    ])
    if (!connected) {
      setSettings(settingsData)
      setAllUserRepos([])
      setLoaded(true)

      return
    }
    try {
      const all = await window.b3d.gitHost.listRepos()
      setAllUserRepos(all)
      setSettings({ ...settingsData, pluginRepos: reposPresentIn(settingsData.pluginRepos, all), listRepos: reposPresentIn(settingsData.listRepos, all) })
    } catch {
      setSettings(settingsData)
      setAllUserRepos([])
    }
    setLoaded(true)
  }

  function onMount() { load() }
  useEffect(onMount, [])

  return { settings, allUserRepos, loaded, reload: load }
}

// Pure transforms of the in-memory key list; the hook below pairs each with its window.b3d write.
function withoutKey(keys: KeyRecord[], removed: KeyRecord): KeyRecord[] {
  const remaining = keys.filter((existing) => existing.id !== removed.id)
  if (removed.isDefault && remaining.length > 0) remaining[0] = { ...remaining[0], isDefault: true }

  return remaining
}

function withDefault(keys: KeyRecord[], defaultId: string): KeyRecord[] {
  return keys.map((existing) => ({ ...existing, isDefault: existing.id === defaultId }))
}

function withIcon(keys: KeyRecord[], id: string, color?: string, image?: string, size?: number): KeyRecord[] {
  return keys.map((existing) => (existing.id === id ? { ...existing, iconColor: color, iconImage: image, iconSize: size } : existing))
}

function withPublishedAt(keys: KeyRecord[], id: string, date: string | null): KeyRecord[] {
  return keys.map((existing) => (existing.id === id ? { ...existing, publishedAt: date ?? undefined } : existing))
}

export function useKeysManager() {
  const [keys, setKeys] = useState<KeyRecord[]>([])
  const [loaded, setLoaded] = useState(false)

  function loadKeys() {
    window.b3d.keys.list().then((loadedKeys) => { setKeys(loadedKeys); setLoaded(true) })
  }
  useEffect(loadKeys, [])

  async function handleGenerate(generatedLabel: string) {
    const newKey = await window.b3d.keys.generate({ label: generatedLabel })
    setKeys((prev) => [...prev, newKey])
  }

  async function handleRemove(key: KeyRecord) {
    await window.b3d.keys.remove(key.id)
    setKeys((prev) => withoutKey(prev, key))
  }

  async function handleSetDefault(key: KeyRecord) {
    await window.b3d.keys.setDefault(key.id)
    setKeys((prev) => withDefault(prev, key.id))
  }

  async function handleSetAssignments(key: KeyRecord, assignments: KeyAssignment[]) {
    await window.b3d.keys.setAssignments(key.id, assignments)
    window.b3d.keys.list().then(setKeys)
  }

  async function handleSetIcon(key: KeyRecord, color?: string, image?: string, size?: number) {
    await window.b3d.keys.setIcon(key.id, color, image, size)
    setKeys((prev) => withIcon(prev, key.id, color, image, size))
  }

  function handleSetPublishedAt(key: KeyRecord, date: string | null) {
    setKeys((prev) => withPublishedAt(prev, key.id, date))
  }

  return { keys, loaded, handleGenerate, handleRemove, handleSetDefault, handleSetAssignments, handleSetIcon, handleSetPublishedAt }
}
