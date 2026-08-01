// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// The one gate every install goes through. Before the printer is touched, the app offers to refresh the
// plugin list when that list has not been refreshed for an hour, and shows what moved if anything did;
// then it runs the install that was asked for.
//
// EVERY WAY AN INSTALL CAN START COMES THROUGH HERE: one plugin, an update, a multi select, a
// collection. One check in one place, so no path can skip the offer and none can ask twice.
//
// NOTHING HERE REFRESHES ON ITS OWN and nothing here polls. The offer is asked for at the click, and
// whether it is due at all is answered in main, against the same hour that stops a repo being asked
// twice.
//
// The install waiting on an answer is held in a ref, not in state: it is a callback, it must not be
// re-run by a re-render, and a person who closes the dialog has not installed anything.
import { createContext, useContext, useRef, useState } from 'react'
import { shouldSkipConfirm } from '../components/common/overlay/ConfirmActionDialog'
import { isLocalRegistry } from '../data/catalog/local-source'
import type { RefreshOffer } from '../../../main/registry/listing-freshness'
import type { RefreshedVersion } from '../../../main/registry/refresh-pass'

// Kept in localStorage by ConfirmActionDialog. The what-moved list is information and not a warning, so
// someone who has read it once can tell it not to come back.
export const MOVED_VERSIONS_SUPPRESS_KEY = 'install-gate.moved-versions'

// `sourceUrls` are the registries the versions being installed come from, one per version, when the
// click knew them. A version held on this machine (a dropped .b3, a dev build from bundle.dev.json) has
// nothing online to check. The offer answers to the whole install, so it is skipped only when EVERY
// version in it is held here: an update-all of locally built plugins asks nothing, and one version from
// a published list, or one whose source the click did not know, keeps the offer for the set.
export type GatedInstall = (startInstall: () => void, sourceUrls?: Array<string | undefined>) => void

export type InstallGateStep = 'idle' | 'offer' | 'refreshing' | 'moved'

export interface InstallGate {
  step: InstallGateStep
  // When the plugin list was last refreshed, or null when it never has been. The offer states this as
  // an age; it comes from main, so the renderer never has to hold a clock of its own.
  refreshedAt: number | null
  moved: RefreshedVersion[]
  beforeInstall: GatedInstall
  acceptRefresh: (reloadCatalog: () => Promise<void>) => void
  proceedWithInstall: () => void
  cancel: () => void
}

interface GateHandles {
  setStep: (step: InstallGateStep) => void
  setRefreshedAt: (at: number | null) => void
  setMoved: (moved: RefreshedVersion[]) => void
  pendingInstall: { current: (() => void) | null }
}

function runPendingInstall(handles: GateHandles): void {
  const startInstall = handles.pendingInstall.current
  handles.pendingInstall.current = null
  handles.setStep('idle')
  startInstall?.()
}

function offerOrInstall(handles: GateHandles, offer: RefreshOffer): void {
  if (!offer.offered) {
    runPendingInstall(handles)

    return
  }
  handles.setRefreshedAt(offer.refreshedAt)
  handles.setStep('offer')
}

function showWhatMoved(handles: GateHandles, moved: RefreshedVersion[]): void {
  if (moved.length === 0 || shouldSkipConfirm(MOVED_VERSIONS_SUPPRESS_KEY)) {
    runPendingInstall(handles)

    return
  }
  handles.setMoved(moved)
  handles.setStep('moved')
}

// A refresh that will not run, or a catalog that will not re-read, must never cost someone the install
// they asked for: the list stays as fresh as it already was and the install goes ahead.
function acceptRefresh(handles: GateHandles, reloadCatalog: () => Promise<void>): void {
  handles.setStep('refreshing')
  window.b3d.registry.refreshListing()
    .then((pass) => reloadCatalog().then(() => showWhatMoved(handles, pass.moved)))
    .catch(() => runPendingInstall(handles))
}

function isHeldOnThisMachine(sourceUrl: string | undefined): boolean {
  return sourceUrl ? isLocalRegistry(sourceUrl) : false
}

// An empty list is an install whose sources the click did not know at all: it keeps the offer.
function nothingOnlineToCheck(sourceUrls: Array<string | undefined>): boolean {
  return sourceUrls.length > 0 && sourceUrls.every(isHeldOnThisMachine)
}

function beforeInstall(handles: GateHandles, startInstall: () => void, sourceUrls: Array<string | undefined> = []): void {
  handles.pendingInstall.current = startInstall
  if (nothingOnlineToCheck(sourceUrls)) {
    runPendingInstall(handles)

    return
  }
  window.b3d.registry.refreshOffer()
    .then((offer) => offerOrInstall(handles, offer))
    .catch(() => runPendingInstall(handles))
}

function cancelInstall(handles: GateHandles): void {
  handles.pendingInstall.current = null
  handles.setStep('idle')
}

export function useInstallGate(): InstallGate {
  const [step, setStep] = useState<InstallGateStep>('idle')
  const [refreshedAt, setRefreshedAt] = useState<number | null>(null)
  const [moved, setMoved] = useState<RefreshedVersion[]>([])
  const pendingInstall = useRef<(() => void) | null>(null)
  const handles: GateHandles = { setStep, setRefreshedAt, setMoved, pendingInstall }

  return {
    step,
    refreshedAt,
    moved,
    beforeInstall: (startInstall, sourceUrls) => beforeInstall(handles, startInstall, sourceUrls),
    acceptRefresh: (reloadCatalog) => acceptRefresh(handles, reloadCatalog),
    proceedWithInstall: () => runPendingInstall(handles),
    cancel: () => cancelInstall(handles),
  }
}

// An install started deep inside the store panel reads the gate the app mounted. The default starts the
// install straight away: where no gate is mounted there is nothing to offer, and a missing provider must
// never swallow an install.
export const InstallGateContext = createContext<GatedInstall>((startInstall) => startInstall())

export function useGatedInstall(): GatedInstall {
  return useContext(InstallGateContext)
}
