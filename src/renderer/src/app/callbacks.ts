// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useState } from 'react'
import { isDaemonRestartMode } from '../components/enrollment'
import type { EnrollMode } from '../components/enrollment'
import { useBatchOps } from '../components/batch-ops'
import { useInstallGate } from '../hooks/installGate'
import { POST_OPERATION_GRACE_MS } from '../components/printer-banners'
import { toRecord, pingAndUpdate, applyToId } from '../data/printers'
import { daemonAccessDecision, enrollPathDecision } from '../data/enroll-gate'
import type { Printer } from '../data/types'

export type AddPrinterModal = { tab: 'scan' | 'manual'; pickedId?: string }
export type EnrollModal = { printer: Printer; mode: EnrollMode; fromAdd?: boolean }

type SetPrinters = (update: Printer[] | ((prev: Printer[]) => Printer[])) => void

// Decide whether adding/enrolling a printer opens enrollment, the access request, or the root-access
// guidance gate. Enrollment is all SSH, so a closed port 22 means the user has not turned on root
// access yet; show the gate with a retry instead of letting the first SSH step fail cryptically.
function useEnrollGate(
  setEnrollModal: (value: EnrollModal | null) => void,
  setAccessModal: (value: Printer | null) => void,
) {
  const [rootAccessGate, setRootAccessGate] = useState<{ printer: Printer; fromAdd: boolean } | null>(null)
  const [enrollProposal, setEnrollProposal] = useState<Printer | null>(null)
  // After SSH is confirmed reachable: when the printer was just added, propose enrollment and wait for
  // the user to confirm; when they explicitly clicked Enroll, start straight away.
  function startEnrollWhenSshOpen(printer: Printer, fromAdd: boolean) {
    window.b3d.printers.checkSshOpen(printer.ip).then((sshOpen) => {
      const decision = enrollPathDecision({ sshOpen, fromAdd })
      if (decision === 'root-gate') setRootAccessGate({ printer, fromAdd })
      else if (decision === 'enroll-proposal') setEnrollProposal(printer)
      else setEnrollModal({ printer, mode: 'enroll', fromAdd })
    })
  }
  // Takes the printer object (not an id) so it works for a just-added printer that is not yet in the
  // printers state array (the setPrinters update has not flushed when add triggers this).
  function openEnrollOrAccess(printer: Printer, fromAdd: boolean) {
    window.b3d.printers.checkDaemon(printer.id).then((result) => {
      const decision = daemonAccessDecision({ isManaged: result.isManaged, enrolled: Boolean(printer.enrollmentLog), hasAccessIdentity: Boolean(printer.accessIdentity) })
      if (decision === 'access') setAccessModal(printer)
      else startEnrollWhenSshOpen(printer, fromAdd)
    })
  }
  function retryRootAccessGate() {
    if (!rootAccessGate) return
    const gate = rootAccessGate
    setRootAccessGate(null)
    startEnrollWhenSshOpen(gate.printer, gate.fromAdd)
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
  markExpectedRestart: (id: string, durationMs: number) => void
  runRecover: (id: string) => void
}

// Persist the just-enrolled printer and follow up per mode: uninstall removes it, the restart-bearing
// modes mark an expected-restart window, and recovery-style modes kick off a plugin recover.
function applyEnrolledOutcome(updatedPrinter: Printer, mode: EnrollMode | undefined, deps: PrinterActionDeps) {
  if (mode === 'uninstall') {
    deps.removePrinter(updatedPrinter.id)

    return
  }
  window.b3d.printers.patch(updatedPrinter.id, toRecord(updatedPrinter))
  deps.setPrinters((prev) => prev.map((printer) => (printer.id === updatedPrinter.id ? updatedPrinter : printer)))
  if (mode && isDaemonRestartMode(mode)) deps.markExpectedRestart(updatedPrinter.id, POST_OPERATION_GRACE_MS)
  pingAndUpdate(updatedPrinter, deps.setPrinters)
  if (mode === 'recovery' || mode === 'reactivate' || mode === 'repair') deps.runRecover(updatedPrinter.id)
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
  function handleEnrollPrinter(id: string) {
    const printer = deps.printers.find((candidate) => candidate.id === id)
    if (printer) deps.enrollGate.openEnrollOrAccess(printer, false)
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

// Every per-printer toolbar/settings action that just opens enrollment in a specific mode.
function enrollModeHandlers(openEnrollModal: (id: string, mode: EnrollMode) => void) {
  return {
    handleViewEnrollmentLog: (id: string) => openEnrollModal(id, 'history'),
    handleUpdateDaemon: (id: string) => openEnrollModal(id, 'update-daemon'),
    handleUpdateJinni: (id: string) => openEnrollModal(id, 'update-jinni'),
    handleRecoverPrinter: (id: string) => openEnrollModal(id, 'recovery'),
    handleRepairPrinter: (id: string) => openEnrollModal(id, 'repair'),
    handleDeactivatePrinter: (id: string) => openEnrollModal(id, 'deactivate'),
    handleReactivatePrinter: (id: string) => openEnrollModal(id, 'reactivate'),
    handleUninstallPrinter: (id: string) => openEnrollModal(id, 'uninstall'),
  }
}

// The batch-op state + run handlers the modals and toolbar read straight through from useBatchOps.
function batchOpHandles(batchOps: BatchOps) {
  return {
    recoveryResults: batchOps.recoveryResults, setRecoveryResults: batchOps.setRecoveryResults, recovering: batchOps.recovering,
    updateAllResult: batchOps.updateAllResult, setUpdateAllResult: batchOps.setUpdateAllResult, updatingAll: batchOps.updatingAll,
    installBatchResult: batchOps.installBatchResult, setInstallBatchResult: batchOps.setInstallBatchResult, installingBatch: batchOps.installingBatch, batchProgress: batchOps.batchProgress, uninstallBatchResult: batchOps.uninstallBatchResult, setUninstallBatchResult: batchOps.setUninstallBatchResult, uninstallingBatch: batchOps.uninstallingBatch, handleUninstallBatch: batchOps.runUninstallBatch,
    batchFailure: batchOps.batchFailure, dismissBatchFailure: batchOps.dismissBatchFailure,
    handleRecoverDrift: batchOps.runRecover,
    handleUpdateAll: batchOps.askUpdateAll,
    pendingUpdate: batchOps.pendingUpdate, confirmUpdateAll: batchOps.confirmUpdateAll, cancelUpdateAll: batchOps.cancelUpdateAll,
    handleInstallBatch: batchOps.runInstallBatch,
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
  const batchOps = useBatchOps(printers, setPrinters, installGate.beforeInstall)
  function openEnrollModal(printerId: string, mode: EnrollMode) {
    const printer = printers.find((candidate) => candidate.id === printerId)
    if (printer) setEnrollModal({ printer, mode })
  }
  function markExpectedRestart(printerId: string, durationMs: number) {
    setPrinters(applyToId(printerId, { expectedRestartUntil: Date.now() + durationMs }))
  }
  const actions = buildPrinterActions({
    printers, setPrinters, setSelectedId, setDiscovered, setAddPrinterModal, setEnrollModal,
    removePrinter, enrollGate, enrollMode: enrollModal?.mode, markExpectedRestart, runRecover: batchOps.runRecover,
  })

  return {
    enrollModal, setEnrollModal, accessModal, setAccessModal,
    addPrinterModal, setAddPrinterModal, markExpectedRestart, installGate,
    openAdd: (pickedId?: string) => setAddPrinterModal({ tab: 'scan', pickedId }),
    openManual: () => setAddPrinterModal({ tab: 'manual' }),
    ...actions,
    ...gateHandles(enrollGate),
    ...enrollModeHandlers(openEnrollModal),
    ...batchOpHandles(batchOps),
  }
}

export type AppActions = ReturnType<typeof useAppCallbacks>
