// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useState } from 'react'
import type { EnrollPhase } from '../../hooks/enrollment'
import type { EnrollMode } from './index'

// Opening one of these windows is not the user's go-ahead. Each one stops the plugins, re-deploys the
// daemon or restarts the printer, so it waits on a screen that says what is about to happen and lets
// the user hand over their own SSH login first, the way enrollment has always asked.
const MODES_THAT_ASK_FIRST: ReadonlySet<EnrollMode> = new Set<EnrollMode>(['deactivate', 'reactivate', 'reboot', 'uninstall', 'repair', 'update-daemon'])

export function autoStartEligible(mode: EnrollMode, customSshCredentials: boolean): boolean {
  if (mode === 'history' || MODES_THAT_ASK_FIRST.has(mode)) return false

  return !customSshCredentials
}

export function awaitingGoAhead(mode: EnrollMode, phase: EnrollPhase, goAheadGiven: boolean): boolean {
  return MODES_THAT_ASK_FIRST.has(mode) && phase === 'credentials' && !goAheadGiven
}

interface GoAheadRequest {
  mode: EnrollMode
  phase: EnrollPhase
  customSshCredentials: boolean
  startWithAdapterDefaults: () => void
}

export interface GoAhead {
  awaiting: boolean
  showCredentialsForm: boolean
  dismissable: boolean
  give: () => void
  askForOwnCredentials: () => void
}

// Holds the op on its go-ahead screen, and answers which screen the modal shows once the user has
// answered: their own SSH login if they asked for it, the running op if they just said go.
export function useGoAhead(request: GoAheadRequest): GoAhead {
  const [given, setGiven] = useState(false)
  const [ownCredentialsWanted, setOwnCredentialsWanted] = useState(false)

  function give() {
    setGiven(true)
    if (request.customSshCredentials) return
    request.startWithAdapterDefaults()
  }
  // Asking for the login screen is not the go-ahead: the op waits until the form itself is submitted.
  function askForOwnCredentials() {
    setOwnCredentialsWanted(true)
    setGiven(true)
  }

  const awaiting = awaitingGoAhead(request.mode, request.phase, given)
  const wantsTheirOwnLogin = request.customSshCredentials || ownCredentialsWanted
  const showCredentialsForm = request.phase === 'credentials' && wantsTheirOwnLogin && !awaiting

  return { awaiting, showCredentialsForm, dismissable: showCredentialsForm || awaiting, give, askForOwnCredentials }
}
