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
}

export function usePanelActions(input: PanelActionInputs) {
  const { ops, printerId, pluginId, installVars, missingDeps, dependents, needsNewerDaemon, selectedSource, selectedChannel } = input
  const [showDaemonGate, setShowDaemonGate] = useState(false)
  const [showCascadeGate, setShowCascadeGate] = useState(false)
  function startInstall() {
    if (printerId) ops.install(printerId, pluginId, installVars, missingDeps, selectedSource, selectedChannel)
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
