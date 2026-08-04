// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useState } from 'react'
import type { ReleaseChannel } from '../../../data/types'
import type { UsePluginOpsResult } from '../../../hooks/pluginOps'

export interface PanelActionInputs {
  ops: UsePluginOpsResult
  printerId?: string
  pluginId: string
  installVars?: Record<string, string>
  missingDeps: string[]
  dependents: string[]
  needsNewerDaemon: boolean
  selectedSource?: string
  selectedChannel?: ReleaseChannel
  // Runs before the install goes out: the port this install claims is taken off whoever holds it.
  beforeInstall?: () => Promise<void>
}

export function usePanelActions(input: PanelActionInputs) {
  const { ops, printerId, pluginId, installVars, missingDeps, dependents, needsNewerDaemon, selectedSource, selectedChannel, beforeInstall } = input
  const [showDaemonGate, setShowDaemonGate] = useState(false)
  const [showCascadeGate, setShowCascadeGate] = useState(false)
  // Moving the other web UI off the claimed port is a courtesy to that UI, not the thing the user
  // clicked. If the printer refuses the move, the install still goes out and its own trail reports
  // what went wrong, rather than the button silently doing nothing.
  async function startInstall() {
    if (!printerId) return
    await beforeInstall?.().catch((error: unknown) => console.error('port hand-over failed', error))
    ops.install(printerId, pluginId, installVars, missingDeps, selectedSource, selectedChannel)
  }
  function requestInstall() {
    if (needsNewerDaemon) { setShowDaemonGate(true);

 return }
    startInstall()
  }
  function uninstall() {
    if (!printerId) return
    if (dependents.length > 0) { setShowCascadeGate(true);

 return }
    ops.uninstall(printerId, pluginId)
  }
  function confirmCascade() {
    setShowCascadeGate(false)
    if (printerId) ops.uninstall(printerId, pluginId, true)
  }
  function confirmDaemonGate() {
    setShowDaemonGate(false)
    startInstall()
  }

  return { showDaemonGate, setShowDaemonGate, showCascadeGate, setShowCascadeGate, requestInstall, uninstall, confirmCascade, confirmDaemonGate }
}
