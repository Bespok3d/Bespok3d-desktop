// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useI18n } from '../../i18n/context'
import type { TFunction } from '../../i18n'
import { Markdown } from '../common/content/Markdown'
import { Button } from '../common/Button'
import { Modal } from '../common/overlay/Modal'

interface UpdateModalProps {
  update: UpdateAvailablePayload
  progressPercent: number | null
  downloaded: boolean
  downloadRequested: boolean
  errorMessage: string | null
  onInstall: () => void
  onDownload: () => void
  onOpenDownload: () => void
  onLater: () => void
}

// The download bytes can reach 100% and then never finish (a finalize/verify hang on the private-repo
// redirect emits no event), leaving the modal on a disabled "Downloading…" forever. After a grace
// period at full progress with nothing downloaded, treat it as stalled so a manual fallback appears.
const STALL_GRACE_MS = 20000

function useStalled(active: boolean): boolean {
  const [stalled, setStalled] = useState(false)
  useEffect(() => {
    if (!active) { setStalled(false);

 return }
    const handle = setTimeout(() => setStalled(true), STALL_GRACE_MS)

    return () => clearTimeout(handle)
  }, [active])

  return stalled
}

type PrimaryAction = 'restart' | 'openDownload' | 'download' | 'downloading'

// Pure: which primary button the modal offers. Extracted so the state machine is unit-tested rather
// than read off the rendered tree (keeps it stable across refactors).
export function primaryAction(
  update: Pick<UpdateAvailablePayload, 'action' | 'releaseUrl'>,
  downloaded: boolean, downloadRequested: boolean, errorMessage: string | null, stalled: boolean,
): PrimaryAction {
  if (downloaded) return 'restart'
  if (update.action === 'openDownload') return 'openDownload'
  if ((errorMessage || stalled) && update.releaseUrl) return 'openDownload'

  return downloadRequested ? 'downloading' : 'download'
}

// Pure: the activity indicator to show. macOS reports no progress, so a requested download with no
// percentage yet is shown as an animated indeterminate bar (not a dead button) until it completes.
export function progressMode(
  downloadRequested: boolean, downloaded: boolean, errorMessage: string | null, stalled: boolean, progressPercent: number | null,
): 'none' | 'indeterminate' | 'determinate' {
  if (!downloadRequested || downloaded || errorMessage || stalled) return 'none'

  return progressPercent === null ? 'indeterminate' : 'determinate'
}

function PrimaryButton({ action, props, t }: { action: PrimaryAction; props: UpdateModalProps; t: TFunction }) {
  if (action === 'restart') return <Button variant="primary" onClick={props.onInstall}>{t('app_update.restart')}</Button>
  if (action === 'openDownload') return <Button variant="primary" onClick={props.onOpenDownload}>{t('app_update.open_download')}</Button>
  if (action === 'download') return <Button variant="primary" onClick={props.onDownload}>{t('app_update.download')}</Button>

  return <Button variant="primary" disabled>{t('app_update.downloading')}</Button>
}

function UpdateModalActions(props: UpdateModalProps, stalled: boolean): ReactNode {
  const { t } = useI18n()
  const action = primaryAction(props.update, props.downloaded, props.downloadRequested, props.errorMessage, stalled)

  return (
    <>
      <Button onClick={props.onLater}>{t('app_update.later')}</Button>
      <PrimaryButton action={action} props={props} t={t} />
    </>
  )
}

function ProgressBar({ mode, progressPercent }: { mode: 'none' | 'indeterminate' | 'determinate'; progressPercent: number | null }) {
  if (mode === 'none') return null

  return (
    <div className="app-update-progress">
      {mode === 'indeterminate'
        ? <progress max={100} className="u-w-full" />
        : <progress value={progressPercent ?? 0} max={100} className="u-w-full" />}
    </div>
  )
}

function UpdateStatusNote({ errorMessage, stalled, t }: { errorMessage: string | null; stalled: boolean; t: TFunction }) {
  if (errorMessage) return <p className="app-update-note error">{t('app_update.error', { message: errorMessage })}</p>
  if (stalled) return <p className="app-update-note">{t('app_update.stalled')}</p>

  return null
}

export function UpdateModal(props: UpdateModalProps) {
  const { t } = useI18n()
  const { update, progressPercent, downloaded, downloadRequested, errorMessage, onLater } = props
  const stalled = useStalled(update.action === 'autoInstall' && progressPercent === 100 && !downloaded && !errorMessage)
  const mode = progressMode(downloadRequested, downloaded, errorMessage, stalled, progressPercent)
  const showQuitHint = downloaded && update.installOnQuit

  return (
    <Modal onClose={onLater} className="size-md">
      <div className="modal-head">
        <h2>{t('app_update.title')}</h2>
        <p>{t('app_update.version_line', { version: update.version })}</p>
      </div>
      <div className="app-update-body">
        {update.releaseNotesMarkdown && <Markdown source={update.releaseNotesMarkdown} />}
        {update.warningsMarkdown && <Markdown source={update.warningsMarkdown} />}
        {showQuitHint && <p className="u-hint-sm">{t('app_update.install_on_quit_hint')}</p>}
        <UpdateStatusNote errorMessage={errorMessage} stalled={stalled} t={t} />
      </div>
      <ProgressBar mode={mode} progressPercent={progressPercent} />
      <div className="app-update-foot">
        {UpdateModalActions(props, stalled)}
      </div>
    </Modal>
  )
}
