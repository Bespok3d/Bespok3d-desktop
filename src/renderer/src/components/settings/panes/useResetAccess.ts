// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useState } from 'react'
import { readPrinterLogin, usesTheirOwnLogin, type PrinterLogin } from '../../../data/printers/login'
import { mainProcessMessage } from '../../../utils/errorMessage'
import { failureInUserWords } from '../../../utils/knownFailures'
import { useI18n } from '../../../i18n/context'
import type { Printer } from '../../../data/types'
import type { SshCredentials } from '../../../hooks/enrollment'

interface ResetOutcome {
  done: () => void
  problem: (userWords: string) => void
}

export interface ResetAccess {
  resetting: boolean
  askingTheirLogin: boolean
  start: () => void
  resetWithTheirLogin: (login: SshCredentials) => void
  cancelTheirLogin: () => void
}

// Runs one reset of access at a time and tells the pane while it runs.
// A reset stays "running" from the click until the printer answers, so the button cannot start a second
// one meanwhile and the pane keeps saying so after the login form closes. While the form waits for the
// user's own login nothing runs yet, and the form covers the button.
export function useResetAccess(printer: Printer, outcome: ResetOutcome): ResetAccess {
  const { t } = useI18n()
  const [resetting, setResetting] = useState(false)
  const [askingTheirLogin, setAskingTheirLogin] = useState(false)

  function stopWithProblem(userWords: string) {
    setResetting(false)
    outcome.problem(userWords)
  }
  function resetWith(login: SshCredentials) {
    setResetting(true)
    window.b3d.printers.resetAccess(printer.id, printer.ip, login.user, login.password, login.port).then(
      () => { setResetting(false); outcome.done() },
      (failure) => stopWithProblem(failureInUserWords(mainProcessMessage(failure), t, login.port)),
    )
  }
  function askTheirLogin() {
    setResetting(false)
    setAskingTheirLogin(true)
  }
  function resetWithLogin(login: PrinterLogin) {
    if (login.source === 'factory') resetWith(login.credentials)
    else if (login.source === 'their-own') askTheirLogin()
    else stopWithProblem(t('access.reset_no_adapter', { adapter: printer.adapter }))
  }
  // A printer with its own login opens the form at once, so the pane never flashes "resetting" for it.
  function start() {
    if (usesTheirOwnLogin(printer)) {
      askTheirLogin()

      return
    }
    setResetting(true)
    readPrinterLogin(printer).then(resetWithLogin).catch((failure) => stopWithProblem(failureInUserWords(mainProcessMessage(failure), t)))
  }
  function resetWithTheirLogin(login: SshCredentials) {
    setAskingTheirLogin(false)
    resetWith(login)
  }
  function cancelTheirLogin() { setAskingTheirLogin(false) }

  return { resetting, askingTheirLogin, start, resetWithTheirLogin, cancelTheirLogin }
}
