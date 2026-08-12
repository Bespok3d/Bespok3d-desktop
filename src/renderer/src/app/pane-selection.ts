// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useState } from 'react'

// Which pane the window shows (the plugin store or the workbench) and which plugin page the store
// opens on. Opening a plugin's page is always both of those at once, so the deep link, the dropped
// package, the header menu and the recovery report all reach it through openPluginPage instead of
// each repeating the pair.
export function usePaneSelection() {
  const [mode, setMode] = useState<'store' | 'create'>('store')
  const [focusPluginId, setFocusPluginId] = useState<string | null>(null)
  function openPluginPage(pluginId: string) {
    setMode('store')
    setFocusPluginId(pluginId)
  }
  function clearPluginFocus() {
    setFocusPluginId(null)
  }

  return { mode, setMode, focusPluginId, openPluginPage, clearPluginFocus }
}
