// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useI18n } from '../../i18n/context'
import { useUploadProgress, formatUploadRate, uploadPercent } from './progress'

// The client-side upload stage shown above the daemon's phase steps: an explicit "Uploading N%" with a
// determinate bar and average speed, so a multi-MB transfer to the printer is never silent. Renders
// nothing once the upload completes (the phase feed takes over) or when no transfer is in flight.
export function UploadBar({ printerId }: { printerId: string | undefined }) {
  const { t } = useI18n()
  const progress = useUploadProgress(printerId)
  if (!progress) return null
  const rate = formatUploadRate(progress.bytesPerSecond)

  return (
    <div className="upload-bar">
      <div className="upload-bar-row">
        <span className="upload-bar-label">{t('upload.sending', { percent: uploadPercent(progress) })}</span>
        {rate && <span className="upload-bar-rate">{rate}</span>}
      </div>
      <progress className="batch-progress-bar" value={progress.sent} max={progress.total} />
    </div>
  )
}
