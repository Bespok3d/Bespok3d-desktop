// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useState, useRef, type Dispatch, type SetStateAction } from 'react'
import { useGatedInstall } from './installGate'
import type { ReleaseChannel } from '../data/types'

type Phase = 'idle' | 'working' | 'error'

interface LastCall {
  op: 'install' | 'uninstall'
  printerId: string
  pluginId: string
  vars?: Record<string, string>
  depIds?: string[]
  cascade?: boolean
  sourceUrl?: string
  channel?: ReleaseChannel
}

export interface UsePluginOpsResult {
  phase: Phase; errorKind: LastCall['op']; stepLabel: string; steps: string[]; errorMsg: string; log: InstallLog | null
  install: (printerId: string, pluginId: string, vars?: Record<string, string>, depIds?: string[], sourceUrl?: string, channel?: ReleaseChannel) => void
  uninstall: (printerId: string, pluginId: string, cascade?: boolean) => void
  retry: () => void
}

// Whether the device's live installed set proves the op already took effect: an uninstall is done when
// the plugin is gone, an install when it is present.
export function isOpCompleted(op: LastCall['op'], installedIds: string[], pluginId: string): boolean {
  const stillInstalled = installedIds.includes(pluginId)

  return op === 'uninstall' ? !stillInstalled : stillInstalled
}

// After an op request rejects, ask the device what is actually installed now: a network wobble can drop
// the response AFTER the daemon already finished the op, and telling the user "nothing changed" then is a
// lie (the camera really was removed). Returns the live installed ids when the end state already matches
// the op (so it succeeded despite the dropped reply), else null so the genuine error is shown.
async function verifyOpCompleted(call: LastCall): Promise<string[] | null> {
  try {
    const caps = await window.b3d.store.capabilities(call.printerId)
    const installedIds = Object.keys(caps.installed)

    return isOpCompleted(call.op, installedIds, call.pluginId) ? installedIds : null
  } catch {
    return null
  }
}

// The reactive surface a running op drives, bundled so the op machinery can live outside the hook body.
interface OpHandlers {
  setPhase: Dispatch<SetStateAction<Phase>>
  setErrorKind: Dispatch<SetStateAction<LastCall['op']>>
  setStepLabel: Dispatch<SetStateAction<string>>
  setSteps: Dispatch<SetStateAction<string[]>>
  setErrorMsg: Dispatch<SetStateAction<string>>
  setLog: Dispatch<SetStateAction<InstallLog | null>>
  onDone: (ids: string[], pluginId: string, action: LastCall['op'], log?: InstallLog) => void
}

function subscribeOpProgress(call: LastCall, handlers: OpHandlers): () => void {
  return window.b3d.store.onPluginProgress((progressEvent) => {
    if (progressEvent.pluginId !== call.pluginId) return
    handlers.setStepLabel(progressEvent.message)
    handlers.setSteps((prev) => [...prev, progressEvent.message])
  })
}

async function handleOpFailure(call: LastCall, err: Error, handlers: OpHandlers): Promise<void> {
  const verifiedIds = await verifyOpCompleted(call)
  if (verifiedIds) {
    handlers.setPhase('idle')
    handlers.onDone(verifiedIds, call.pluginId, call.op)

    return
  }
  handlers.setErrorKind(call.op)
  handlers.setPhase('error')
  handlers.setErrorMsg(err.message)
}

function executeOp(call: LastCall, handlers: OpHandlers): void {
  handlers.setPhase('working'); handlers.setStepLabel(''); handlers.setSteps([]); handlers.setErrorMsg('')
  const unsub = subscribeOpProgress(call, handlers)
  function onFail(err: Error) { unsub(); void handleOpFailure(call, err, handlers) }
  if (call.op === 'install') {
    window.b3d.store.install(call.printerId, call.pluginId, call.vars, call.depIds, call.sourceUrl, call.channel)
      .then(({ installedIds, log }) => { unsub(); handlers.setLog(log); handlers.setPhase('idle'); handlers.onDone(installedIds, call.pluginId, 'install', log) })
      .catch(onFail)

    return
  }
  window.b3d.store.uninstall(call.printerId, call.pluginId, call.cascade)
    .then((ids) => { unsub(); handlers.setPhase('idle'); handlers.onDone(ids, call.pluginId, 'uninstall') })
    .catch(onFail)
}

export function usePluginOps(
  onDone: (ids: string[], pluginId: string, action: 'install' | 'uninstall', log?: InstallLog) => void,
): UsePluginOpsResult {
  const [phase, setPhase] = useState<Phase>('idle')
  const [errorKind, setErrorKind] = useState<LastCall['op']>('install')
  const [stepLabel, setStepLabel] = useState('')
  const [steps, setSteps] = useState<string[]>([])
  const [errorMsg, setErrorMsg] = useState('')
  const [log, setLog] = useState<InstallLog | null>(null)
  const lastCall = useRef<LastCall | null>(null)
  const gatedInstall = useGatedInstall()
  const handlers: OpHandlers = { setPhase, setErrorKind, setStepLabel, setSteps, setErrorMsg, setLog, onDone }
  function runOp(call: LastCall) { lastCall.current = call; executeOp(call, handlers) }

  return {
    phase, errorKind, stepLabel, steps, errorMsg, log,
    // Every single-plugin install goes through the install gate here, at the one seam it has, so no
    // caller can start one without the listing being offered first. A retry does not: it repeats a
    // call that already passed the gate.
    install: (printerId, pluginId, vars, depIds, sourceUrl, channel) =>
      gatedInstall(() => runOp({ op: 'install', printerId, pluginId, vars, depIds, sourceUrl, channel })),
    uninstall: (printerId, pluginId, cascade) => runOp({ op: 'uninstall', printerId, pluginId, cascade }),
    retry: () => { if (lastCall.current) runOp(lastCall.current) },
  }
}
