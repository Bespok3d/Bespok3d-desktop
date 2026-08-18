// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useState } from 'react'
import { isDaemonRestartMode } from '../components/enrollment'
import type { EnrollMode } from '../components/enrollment'
import { useBatchOps } from '../components/batch-ops'
import { restartAfterReapply } from '../components/batch-ops/restart-after-reapply'
import { useInstallGate } from '../hooks/installGate'
import { POST_OPERATION_GRACE_MS } from '../components/printer-banners'
import { toRecord, pingAndUpdate, applyToId } from '../data/printers'
import { daemonAccessDecision, enrollPathDecision } from '../data/enroll-gate'
import type { Printer } from '../data/types'

export type AddPrinterModal = { tab: 'scan' | 'manual'; pickedId?: string }
// forced: opened from the Force menu, which is the user saying he wants this run whatever the printer
// reports about its daemon version.
export type EnrollModal = { printer: Printer; mode: EnrollMode; fromAdd?: boolean; forced?: boolean }

type SetPrinters = (update: Printer[] | ((prev: Printer[]) => Printer[])) => void

// Decide whether adding/enrolling a printer opens enrollment, the access request, or the root-access
// guidance gate. Enrollment is all SSH, so a closed port 22 means the user has not turned on root
// access yet; show the gate with a retry instead of letting the first SSH step fail cryptically.
function useEnrollGate(
  setEnrollModal: (value: EnrollModal | null) => void,
  setAccessModal: (value: Printer | null) => void,
) {
  const [rootAccessGate, setRootAccessGate] = useState<{ printer: Printer; fromAdd: boolean; forced: boolean } | null>(null)
  const [enrollProposal, setEnrollProposal] = useState<Printer | null>(null)
  // After SSH is confirmed reachable: when the printer was just added, propose enrollment and wait for
  // the user to confirm; when they explicitly clicked Enroll, start straight away.
  function startEnrollWhenSshOpen(printer: Printer, fromAdd: boolean, forced: boolean) {
    window.b3d.printers.checkSshOpen(printer.ip).then((sshOpen) => {
      const decision = enrollPathDecision({ sshOpen, fromAdd })
      if (decision === 'root-gate') setRootAccessGate({ printer, fromAdd, forced })
      else if (decision === 'enroll-proposal') setEnrollProposal(printer)
      else setEnrollModal({ printer, mode: 'enroll', fromAdd, forced })
    })
  }
  // Takes the printer object (not an id) so it works for a just-added printer that is not yet in the
  // printers state array (the setPrinters update has not flushed when add triggers this).
  function openEnrollOrAccess(printer: Printer, fromAdd: boolean, forced = false) {
    window.b3d.printers.checkDaemon(printer.id).then((result) => {
      const decision = daemonAccessDecision({ isManaged: result.isManaged, enrolled: Boolean(printer.enrollmentLog), hasAccessIdentity: Boolean(printer.accessIdentity) })
      if (decision === 'access') setAccessModal(printer)
      else startEnrollWhenSshOpen(printer, fromAdd, forced)
    })
  }
  function retryRootAccessGate() {
    if (!rootAccessGate) return
    const gate = rootAccessGate
    setRootAccessGate(null)
    startEnrollWhenSshOpen(gate.printer, gate.fromAdd, gate.forced)
  }
  function confirmEnrollProposal() {
    if (!enrollProposal) return
    setEnrollModal({ printer: enrollProposal, mode: 'enroll', fromAdd: true })
    setEnrollProposal(null)
  }

  return {
    openEnrollOrAccess, rootAccessGate, setRootAccessGate, retryRootAccessGate,
    enrollProposal, setEnrollProposal, confirmEnrollProposal,
  }
}

type EnrollGate = ReturnType<typeof useEnrollGate>
type BatchOps = ReturnType<typeof useBatchOps>

interface PrinterActionDeps {
  printers: Printer[]
  setPrinters: SetPrinters
  setSelectedId: (id: string) => void
  setDiscovered: (value: []) => void
  setAddPrinterModal: (value: AddPrinterModal | null) => void
  setEnrollModal: (value: EnrollModal | null) => void
  removePrinter: (id: string) => void
  enrollGate: EnrollGate
  enrollMode: EnrollMode | undefined
  enrollForced: boolean | undefined
  markExpectedRestart: (id: string, durationMs: number) => void
  runRecover: (id: string) => void
}

// Recovery and repair leave a working daemon with the plugins still to put back, so the app re-applies
// them once their modal closes. Reactivation puts them back as one of its own steps, on the printer,
// before the reboot that picks them up: running it again here would repeat the whole job for nothing.
const MODES_THAT_LEAVE_THE_PLUGINS_TO_PUT_BACK: ReadonlySet<EnrollMode> = new Set<EnrollMode>(['recovery', 'repair'])
// The three the Force menu offers. Each one is run on a printer that is already misbehaving and each
// rebuilds the write layer the plugins hang off, which unplugs every one of them, so each ends with
// the plugins put back on. A forced re-enroll that stopped there left the printer able to print with
// every plugin dark, which is what the colours plugin then failed to update over.
const MODES_THE_FORCE_MENU_OFFERS: ReadonlySet<EnrollMode> = new Set<EnrollMode>(['enroll', 'recovery', 'repair'])

export function leavesThePluginsToPutBack(mode: EnrollMode | undefined, forced?: boolean): boolean {
  if (mode === undefined) return false
  if (forced === true && MODES_THE_FORCE_MENU_OFFERS.has(mode)) return true

  return MODES_THAT_LEAVE_THE_PLUGINS_TO_PUT_BACK.has(mode)
}

// Persist the just-enrolled printer and follow up per mode: uninstall removes it, the restart-bearing
// modes mark an expected-restart window, and the modes that left the plugins off kick off a recover.
function applyEnrolledOutcome(updatedPrinter: Printer, mode: EnrollMode | undefined, deps: PrinterActionDeps) {
  if (mode === 'uninstall') {
    deps.removePrinter(updatedPrinter.id)

    return
  }
  window.b3d.printers.patch(updatedPrinter.id, toRecord(updatedPrinter))
  deps.setPrinters((prev) => prev.map((printer) => (printer.id === updatedPrinter.id ? updatedPrinter : printer)))
  if (mode && isDaemonRestartMode(mode)) deps.markExpectedRestart(updatedPrinter.id, POST_OPERATION_GRACE_MS)
  pingAndUpdate(updatedPrinter, deps.setPrinters)
  if (leavesThePluginsToPutBack(mode, deps.enrollForced)) deps.runRecover(updatedPrinter.id)
}

// The printer-lifecycle handlers (add / access-granted / enrolled / rescan / enroll). Built from the
// hook's state setters so useAppCallbacks stays thin composition rather than a 80-line god-hook.
function buildPrinterActions(deps: PrinterActionDeps) {
  function handleAccessGranted(printerId: string) {
    deps.setSelectedId(printerId)
    const printer = deps.printers.find((candidate) => candidate.id === printerId)
    if (printer) pingAndUpdate({ ...printer, status: 'managed' }, deps.setPrinters)
  }
  function handleAddPrinter(printer: Printer) {
    window.b3d.printers.save(toRecord(printer))
    deps.setPrinters((prev) => [...prev, printer])
    deps.setSelectedId(printer.id)
    deps.setDiscovered([])
    deps.setAddPrinterModal(null)
    pingAndUpdate(printer, deps.setPrinters)
    deps.enrollGate.openEnrollOrAccess(printer, true)
  }
  function handleEnrolled(updatedPrinter: Printer) {
    deps.setEnrollModal(null)
    applyEnrolledOutcome(updatedPrinter, deps.enrollMode, deps)
  }
  function handleRescan() {
    deps.setDiscovered([])
    window.b3d.mdns.stop().then(() => window.b3d.mdns.start())
  }
  function handleEnrollPrinter(id: string, forced?: boolean) {
    const printer = deps.printers.find((candidate) => candidate.id === id)
    if (printer) deps.enrollGate.openEnrollOrAccess(printer, false, forced)
  }

  return { handleAccessGranted, handleAddPrinter, handleEnrolled, handleRescan, handleEnrollPrinter }
}

// The six enroll-gate passthrough fields the modals read (the gate's openEnrollOrAccess stays private).
function gateHandles(gate: EnrollGate) {
  return {
    rootAccessGate: gate.rootAccessGate, setRootAccessGate: gate.setRootAccessGate, retryRootAccessGate: gate.retryRootAccessGate,
    enrollProposal: gate.enrollProposal, setEnrollProposal: gate.setEnrollProposal, confirmEnrollProposal: gate.confirmEnrollProposal,
  }
}

// Every per-printer toolbar/settings action that just opens enrollment in a specific mode. Recovery and
// repair also come off the Force menu, which hands them forced: a banner calls them with one argument
// and gets the usual refusals.
function enrollModeHandlers(openEnrollModal: (id: string, mode: EnrollMode, forced?: boolean) => void) {
  return {
    handleViewEnrollmentLog: (id: string) => openEnrollModal(id, 'history'),
    handleUpdateDaemon: (id: string) => openEnrollModal(id, 'update-daemon'),
    handleUpdateJinni: (id: string) => openEnrollModal(id, 'update-jinni'),
    handleRecoverPrinter: (id: string, forced?: boolean) => openEnrollModal(id, 'recovery', forced),
    handleRepairPrinter: (id: string, forced?: boolean) => openEnrollModal(id, 'repair', forced),
    handleDeactivatePrinter: (id: string) => openEnrollModal(id, 'deactivate'),
    handleReactivatePrinter: (id: string) => openEnrollModal(id, 'reactivate'),
    handleUninstallPrinter: (id: string) => openEnrollModal(id, 'uninstall'),
  }
}

// The batch-op state + run handlers the modals and toolbar read straight through from useBatchOps.
function batchOpHandles(batchOps: BatchOps) {
  return {
    recoveryResults: batchOps.recoveryResults, setRecoveryResults: batchOps.setRecoveryResults, recovering: batchOps.recovering, restartingAfterRecovery: batchOps.restartingAfterRecovery, printerRestarting: batchOps.printerRestarting, restartSeconds: batchOps.restartSeconds,
    updateAllResult: batchOps.updateAllResult, setUpdateAllResult: batchOps.setUpdateAllResult, updatingAll: batchOps.updatingAll,
    installBatchResult: batchOps.installBatchResult, setInstallBatchResult: batchOps.setInstallBatchResult, installingBatch: batchOps.installingBatch, batchProgress: batchOps.batchProgress, uninstallBatchResult: batchOps.uninstallBatchResult, setUninstallBatchResult: batchOps.setUninstallBatchResult, uninstallingBatch: batchOps.uninstallingBatch, handleUninstallBatch: batchOps.runUninstallBatch,
    batchFailure: batchOps.batchFailure, dismissBatchFailure: batchOps.dismissBatchFailure,
    handleRecoverDrift: batchOps.runRecover,
    handleUpdateAll: batchOps.askUpdateAll,
    pendingUpdate: batchOps.pendingUpdate, confirmUpdateAll: batchOps.confirmUpdateAll, cancelUpdateAll: batchOps.cancelUpdateAll,
    handleInstallBatch: batchOps.runInstallBatch,
  }
}

// Recovery ends by restarting the printer, so the app is told to expect it to drop off and come back
// instead of showing it offline. It answers whether it is restarting the printer itself, which is what
// the recovery report goes on to tell the user.
function recoveryRestart(printers: Printer[], restart: { markExpectedRestart: (printerId: string) => void; askForTheirLogin: (printerId: string) => void }) {
  return function restartTheRecoveredPrinter(printerId: string) {
    const printer = printers.find((candidate) => candidate.id === printerId)
    if (!printer) return Promise.resolve(false)

    return restartAfterReapply(printer, restart.markExpectedRestart, restart.askForTheirLogin)
  }
}

export function useAppCallbacks(
  printers: Printer[],
  setPrinters: SetPrinters,
  setSelectedId: (id: string) => void,
  setDiscovered: (value: []) => void,
  removePrinter: (id: string) => void,
) {
  const [enrollModal, setEnrollModal] = useState<EnrollModal | null>(null)
  const [accessModal, setAccessModal] = useState<Printer | null>(null)
  const [addPrinterModal, setAddPrinterModal] = useState<AddPrinterModal | null>(null)
  const enrollGate = useEnrollGate(setEnrollModal, setAccessModal)
  // The one install gate, made here so every install path shares it: the batch ops take it as an
  // argument and the store panel reads it from the context App puts it in.
  const installGate = useInstallGate()
  const batchOps = useBatchOps(printers, setPrinters, installGate.beforeInstall, recoveryRestart(printers, {
    markExpectedRestart: (printerId) => markExpectedRestart(printerId, POST_OPERATION_GRACE_MS),
    askForTheirLogin: (printerId) => openEnrollModal(printerId, 'reboot'),
  }))
  function openEnrollModal(printerId: string, mode: EnrollMode, forced = false) {
    const printer = printers.find((candidate) => candidate.id === printerId)
    if (printer) setEnrollModal({ printer, mode, forced })
  }
  function markExpectedRestart(printerId: string, durationMs: number) {
    setPrinters(applyToId(printerId, { expectedRestartUntil: Date.now() + durationMs }))
  }
  const actions = buildPrinterActions({
    printers, setPrinters, setSelectedId, setDiscovered, setAddPrinterModal, setEnrollModal,
    removePrinter, enrollGate, enrollMode: enrollModal?.mode, enrollForced: enrollModal?.forced, markExpectedRestart, runRecover: batchOps.runRecover,
  })

  return {
    enrollModal, setEnrollModal, accessModal, setAccessModal,
    addPrinterModal, setAddPrinterModal, markExpectedRestart, installGate,
    openAdd: (pickedId?: string) => setAddPrinterModal({ tab: 'scan', pickedId }),
    openManual: () => setAddPrinterModal({ tab: 'manual' }),
    handleReboot: (id: string) => openEnrollModal(id, 'reboot'),
    ...actions,
    ...gateHandles(enrollGate),
    ...enrollModeHandlers(openEnrollModal),
    ...batchOpHandles(batchOps),
  }
}

export type AppActions = ReturnType<typeof useAppCallbacks>
