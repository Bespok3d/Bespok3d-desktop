// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// Opening enrollment, the access request, or the root-access gate, for a printer the app wants to reach.
import { useState } from 'react'
import type { EnrollMode } from '../components/enrollment'
import { daemonAccessDecision, enrollPathDecision } from '../data/enroll-gate'
import type { AccessPromptState } from '../data/enroll-gate'
import type { Printer } from '../data/types'

// forced: opened from the Force menu, which is the user saying he wants this run whatever the printer
// reports about its daemon version.
export type EnrollModal = { printer: Printer; mode: EnrollMode; fromAdd?: boolean; forced?: boolean }
export type AccessModal = { printer: Printer; state: AccessPromptState; fromAdd: boolean; forced: boolean }
export type ReEnrollWarning = { printer: Printer; fromAdd: boolean; forced: boolean }
// mode: what Retry opens once root access is on.
export type RootAccessGate = { printer: Printer; mode: EnrollMode; fromAdd: boolean; forced: boolean }

function startEnrollWhenSshOpen(printer: Printer, fromAdd: boolean, forced: boolean, setRootAccessGate: (value: RootAccessGate | null) => void, setEnrollProposal: (value: Printer | null) => void, setEnrollModal: (value: EnrollModal | null) => void) {
  window.b3d.printers.checkSshOpen(printer.ip).then((sshOpen) => {
    const decision = enrollPathDecision({ sshOpen, fromAdd })
    if (decision === 'root-gate') setRootAccessGate({ printer, mode: 'enroll', fromAdd, forced })
    else if (decision === 'enroll-proposal') setEnrollProposal(printer)
    else setEnrollModal({ printer, mode: 'enroll', fromAdd, forced })
  })
}

// Recovery, repair, the updates, deactivation, reactivation, the reboot and uninstall run over SSH just
// as enrollment does, so a closed port 22 gets the same root-access gate instead of a raw connection
// error out of the first step.
function openWhenSshOpen(printer: Printer, mode: EnrollMode, forced: boolean, setRootAccessGate: (value: RootAccessGate | null) => void, setEnrollModal: (value: EnrollModal | null) => void) {
  window.b3d.printers.checkSshOpen(printer.ip).then((sshOpen) => {
    if (sshOpen) setEnrollModal({ printer, mode, forced })
    else setRootAccessGate({ printer, mode, fromAdd: false, forced })
  })
}

function chooseAccessOrEnrollment(printer: Printer, fromAdd: boolean, forced: boolean, setters: {
  setAccessModal: (value: AccessModal | null) => void
  setEnrollModal: (value: EnrollModal | null) => void
  setEnrollProposal: (value: Printer | null) => void
  setRootAccessGate: (value: RootAccessGate | null) => void
}) {
  window.b3d.printers.checkDaemon(printer.id).then((result) => {
    const selectedPrinter = result.ip ? { ...printer, ip: result.ip } : printer
    const decision = daemonAccessDecision({ accessState: result.accessState, isManaged: result.isManaged, enrolled: Boolean(printer.enrollmentLog), hasAccessIdentity: Boolean(printer.accessIdentity) })
    if (decision === 'access' || decision === 'identity-warning') setters.setAccessModal({ printer: selectedPrinter, state: result.accessState as AccessModal['state'], fromAdd, forced })
    else if (decision === 'blocked' || (result.accessState === 'authorized' && fromAdd)) return
    else startEnrollWhenSshOpen(selectedPrinter, fromAdd, forced, setters.setRootAccessGate, setters.setEnrollProposal, setters.setEnrollModal)
  })
}

// Retry re-checks the port and opens what the gate was stopping, the enrollment or the SSH action.
function rootGateHandlers(rootAccessGate: RootAccessGate | null, setRootAccessGate: (value: RootAccessGate | null) => void, setEnrollProposal: (value: Printer | null) => void, setEnrollModal: (value: EnrollModal | null) => void) {
  function retryRootAccessGate() {
    if (!rootAccessGate) return
    setRootAccessGate(null)
    if (rootAccessGate.mode === 'enroll') startEnrollWhenSshOpen(rootAccessGate.printer, rootAccessGate.fromAdd, rootAccessGate.forced, setRootAccessGate, setEnrollProposal, setEnrollModal)
    else openWhenSshOpen(rootAccessGate.printer, rootAccessGate.mode, rootAccessGate.forced, setRootAccessGate, setEnrollModal)
  }
  function openBehindRootGate(printer: Printer, mode: EnrollMode, forced: boolean) {
    openWhenSshOpen(printer, mode, forced, setRootAccessGate, setEnrollModal)
  }

  return { retryRootAccessGate, openBehindRootGate }
}

// Decide whether adding/enrolling a printer opens enrollment, the access request, or the root-access
// guidance gate. Enrollment is all SSH, so a closed port 22 means the user has not turned on root
// access yet; show the gate with a retry instead of letting the first SSH step fail cryptically.
export function useEnrollGate(
  setEnrollModal: (value: EnrollModal | null) => void,
  setAccessModal: (value: AccessModal | null) => void,
) {
  const [rootAccessGate, setRootAccessGate] = useState<RootAccessGate | null>(null)
  const [enrollProposal, setEnrollProposal] = useState<Printer | null>(null)
  const [reEnrollWarning, setReEnrollWarning] = useState<ReEnrollWarning | null>(null)
  function warnBeforeReEnroll(printer: Printer, fromAdd: boolean, forced: boolean) {
    setAccessModal(null)
    setReEnrollWarning({ printer, fromAdd, forced })
  }
  function confirmReEnroll() {
    if (!reEnrollWarning) return
    setEnrollModal({ printer: reEnrollWarning.printer, mode: 'enroll', fromAdd: reEnrollWarning.fromAdd, forced: reEnrollWarning.forced })
    setReEnrollWarning(null)
  }
  // Takes the printer object (not an id) so it works for a just-added printer that is not yet in the
  // printers state array (the setPrinters update has not flushed when add triggers this).
  function openEnrollOrAccess(printer: Printer, fromAdd: boolean, forced = false) {
    chooseAccessOrEnrollment(printer, fromAdd, forced, { setAccessModal, setEnrollModal, setEnrollProposal, setRootAccessGate })
  }
  function requestReEnroll(accessModal: AccessModal) {
    warnBeforeReEnroll(accessModal.printer, accessModal.fromAdd, accessModal.forced)
  }
  const { retryRootAccessGate, openBehindRootGate } = rootGateHandlers(rootAccessGate, setRootAccessGate, setEnrollProposal, setEnrollModal)
  function confirmEnrollProposal() {
    if (!enrollProposal) return
    setEnrollModal({ printer: enrollProposal, mode: 'enroll', fromAdd: true })
    setEnrollProposal(null)
  }

  return {
    openEnrollOrAccess, openBehindRootGate, rootAccessGate, setRootAccessGate, retryRootAccessGate,
    enrollProposal, setEnrollProposal, confirmEnrollProposal,
    reEnrollWarning, setReEnrollWarning, confirmReEnroll, requestReEnroll,
  }
}

export type EnrollGate = ReturnType<typeof useEnrollGate>
