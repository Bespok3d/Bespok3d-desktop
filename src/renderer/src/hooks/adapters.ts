// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useState, useEffect } from 'react'

// The adapter-declared printer icons, keyed by adapter id, for the header dropdown. Loaded once: the
// adapter set is static for a build, so there is nothing to refresh.
export function useAdapterIcons(): Record<string, string> {
  const [icons, setIcons] = useState<Record<string, string>>({})
  function loadAdapterIcons() {
    window.b3d.printers.adaptersList().then((adapters) => {
      setIcons(Object.fromEntries(adapters.filter((adapter) => adapter.icon).map((adapter) => [adapter.id, adapter.icon as string])))
    })
  }
  useEffect(loadAdapterIcons, [])

  return icons
}

// The adapter-declared jinni (device-side) versions, keyed by adapter id, so a banner can compare the
// version a printer reports against the one this build ships. Loaded once: the adapter set is static
// for a build. The value is single-sourced in the adapter, so there is no app-side constant.
export function useAdapterJinniVersions(): Record<string, string> {
  const [versions, setVersions] = useState<Record<string, string>>({})
  function loadAdapterJinniVersions() {
    window.b3d.printers.adaptersList().then((adapters) => {
      setVersions(Object.fromEntries(adapters.map((adapter) => [adapter.id, adapter.jinniVersion])))
    })
  }
  useEffect(loadAdapterJinniVersions, [])

  return versions
}
