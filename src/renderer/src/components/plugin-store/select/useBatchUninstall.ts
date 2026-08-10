// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useState } from 'react'
import type { Plugin } from '../../../data/types'
import { useSelectMode } from './useSelectMode'
import { cascadeDependents } from '../../../data/deps'

interface BatchUninstallDeps {
  plugins: Plugin[]
  installedIds: string[]
  printerId?: string
  onUninstallSelected?: (printerId: string, pluginIds: string[], cascade: boolean) => void
}

export interface BatchUninstall {
  active: boolean
  selectedIds: string[]
  uninstallableIds: string[]
  // Non-null while the cascade confirm is open, holding the extra installed plugins a cascade must
  // also remove (transitive dependents of the selection).
  cascadeIds: string[] | null
  enter: () => void
  exit: () => void
  toggle: (pluginId: string) => void
  clear: () => void
  begin: () => void
  cancelCascade: () => void
  confirmCascade: () => void
}

// The daemon and the adapter's jinni arrive as packages and read as installed like anything else, but
// removing either one strands an enrolled printer, so neither can ever be picked into a removal set.
// The card's own Uninstall button is already withheld from them; this is the same rule for the
// select-several-and-remove flow, which reaches every card in the grid rather than one panel.
function removableIds(plugins: readonly Plugin[], installedIds: readonly string[]): string[] {
  const systemIds = plugins.filter((plugin) => plugin.systemPackage === true).map((plugin) => plugin.id)

  return installedIds.filter((installedId) => !systemIds.includes(installedId))
}

// The multi-select-and-uninstall flow as one hook, the removal twin of useBatchInstall (both share the
// useSelectMode pick state; the action differs). On "Uninstall selected" it either opens the cascade
// confirm (a pick still has installed dependents outside the selection) or removes the set directly.
// The batch rides the daemon's uninstall-batch, so the whole set restarts services only once.
export function useBatchUninstall(deps: BatchUninstallDeps): BatchUninstall {
  const [cascadeIds, setCascadeIds] = useState<string[] | null>(null)
  const select = useSelectMode(() => setCascadeIds(null))

  function run(cascade: boolean) {
    if (deps.printerId && deps.onUninstallSelected) deps.onUninstallSelected(deps.printerId, select.selectedIds, cascade)
    select.exit()
  }
  function begin() {
    const extra = cascadeDependents(deps.plugins, select.selectedIds, deps.installedIds)
    if (extra.length > 0) {
      setCascadeIds(extra)

      return
    }
    run(false)
  }

  return {
    active: select.active, selectedIds: select.selectedIds, uninstallableIds: removableIds(deps.plugins, deps.installedIds), cascadeIds,
    enter: select.enter, exit: select.exit, toggle: select.toggle, clear: select.clear,
    begin, cancelCascade: () => setCascadeIds(null), confirmCascade: () => run(true),
  }
}
