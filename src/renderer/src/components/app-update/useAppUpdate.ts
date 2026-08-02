// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useEffect, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { useI18n } from '../../i18n/context'
import type { TFunction } from '../../i18n'

interface AppUpdateState {
  update: UpdateAvailablePayload | null
  progressPercent: number | null
  downloaded: boolean
  // True from the moment the user asks to download until it finishes or fails. macOS reports no
  // download progress, so this drives an indeterminate "working" indicator before (and instead of)
  // a percentage bar, rather than leaving the button looking dead.
  downloadRequested: boolean
  upToDate: boolean
  checking: boolean
  // Why the check failed, and the original wording behind it. The problem is what the user is told;
  // the wording is only ever shown as the technical note under it.
  errorProblem: UpdateProblem | null
  errorMessage: string | null
  appliedVersion: string | null
}

const INITIAL_STATE: AppUpdateState = {
  update: null,
  progressPercent: null,
  downloaded: false,
  downloadRequested: false,
  upToDate: false,
  checking: false,
  errorProblem: null,
  errorMessage: null,
  appliedVersion: null,
}

// When the app auto-downloads, the download runs silently in the background: showing an
// "Update available" modal that immediately starts a download the user cannot stop is jarring, and
// (on macOS, which reports no progress) it looks frozen. So the modal appears only when the update is
// ready to install, when it errors, or when the user must act themselves (manual download / a
// platform that cannot auto-install). Live progress stays available in Settings > Update.
export function shouldShowUpdateModal(
  state: Pick<AppUpdateState, 'update' | 'downloaded' | 'errorMessage'>
): boolean {
  if (!state.update) return false
  if (state.downloaded || state.errorMessage) return true

  return state.update.action === 'openDownload' || state.update.autoDownload === false
}

function notifyUpdateReady(t: TFunction, version: string): void {
  if (typeof Notification === 'undefined') return
  new Notification(t('app_update.notify.title'), { body: t('app_update.notify.body', { version }) })
}

function notifyUpdateApplied(t: TFunction, version: string): void {
  if (typeof Notification === 'undefined') return
  new Notification(t('app_update.applied.title'), {
    body: t('app_update.applied.body', { version }),
  })
}

function consumeAppliedUpdate(setState: Dispatch<SetStateAction<AppUpdateState>>, t: TFunction) {
  return function consume(): void {
    window.b3d.appUpdate.consumeApplied().then((version) => {
      if (!version) return
      setState((prev) => ({ ...prev, appliedVersion: version }))
      notifyUpdateApplied(t, version)
    })
  }
}

function subscribeToAppUpdate(setState: Dispatch<SetStateAction<AppUpdateState>>, t: TFunction) {
  return function subscribe(): () => void {
    const unsubAvailable = window.b3d.appUpdate.onUpdateAvailable((payload) => {
      setState((prev) => ({
        ...prev,
        update: payload,
        downloaded: false,
        downloadRequested: false,
        progressPercent: null,
        checking: false,
        upToDate: false,
        errorProblem: null,
        errorMessage: null,
      }))
      if (payload.action === 'openDownload') notifyUpdateReady(t, payload.version)
    })
    const unsubUpToDate = window.b3d.appUpdate.onUpToDate(() =>
      setState((prev) => ({ ...prev, update: null, checking: false, upToDate: true }))
    )
    const unsubProgress = window.b3d.appUpdate.onDownloadProgress((percent) =>
      setState((prev) => ({ ...prev, progressPercent: percent }))
    )
    const unsubDownloaded = window.b3d.appUpdate.onUpdateDownloaded((version) => {
      setState((prev) => ({ ...prev, downloaded: true }))
      notifyUpdateReady(t, version)
    })
    const unsubError = window.b3d.appUpdate.onUpdateError((payload) =>
      setState((prev) => ({ ...prev, errorProblem: payload.problem, errorMessage: payload.detail, checking: false }))
    )

    return () => {
      unsubAvailable()
      unsubUpToDate()
      unsubProgress()
      unsubDownloaded()
      unsubError()
    }
  }
}

export function useAppUpdate() {
  const { t } = useI18n()
  const [state, setState] = useState<AppUpdateState>(INITIAL_STATE)

  useEffect(subscribeToAppUpdate(setState, t), [t])
  useEffect(consumeAppliedUpdate(setState, t), [t])

  function check(): void {
    setState((prev) => ({ ...prev, checking: true, upToDate: false, errorProblem: null, errorMessage: null }))
    window.b3d.appUpdate.checkNow()
  }
  function download(): void {
    setState((prev) => ({ ...prev, downloadRequested: true }))
    window.b3d.appUpdate.download()
  }
  function installNow(): void {
    window.b3d.appUpdate.installNow()
  }
  function openDownload(): void {
    if (state.update?.releaseUrl) window.b3d.appUpdate.openDownload(state.update.releaseUrl)
  }
  function dismiss(): void {
    setState((prev) => ({ ...prev, update: null }))
  }
  function dismissApplied(): void {
    setState((prev) => ({ ...prev, appliedVersion: null }))
  }

  return {
    ...state,
    showModal: shouldShowUpdateModal(state),
    check,
    download,
    installNow,
    openDownload,
    dismiss,
    dismissApplied,
  }
}
