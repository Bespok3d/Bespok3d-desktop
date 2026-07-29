// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useState } from 'react'

export interface SelectMode {
  active: boolean
  selectedIds: string[]
  enter: () => void
  exit: () => void
  toggle: (pluginId: string) => void
  clear: () => void
}

// The pick state shared by the store's two mutually-exclusive batch modes (install-select and
// uninstall-select): an active flag and the chosen ids, with enter/exit/toggle/clear. Each mode's own
// hook adds the mode-specific begin/confirm and selectable set; onExit clears that extra state on exit.
export function useSelectMode(onExit?: () => void): SelectMode {
  const [active, setActive] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  function exit() {
    setActive(false)
    setSelectedIds([])
    onExit?.()
  }
  function toggle(pluginId: string) {
    setSelectedIds((prev) => prev.includes(pluginId) ? prev.filter((id) => id !== pluginId) : [...prev, pluginId])
  }

  return {
    active, selectedIds,
    enter: () => setActive(true), exit, toggle, clear: () => setSelectedIds([]),
  }
}
