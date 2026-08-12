// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { Modal } from '../common/overlay/Modal'
import { RebootProgress } from '../common/feedback/RebootProgress'
import { useI18n } from '../../i18n/context'

// What the user watches between the last plugin going back on the printer and the recovery report.
// The printer is restarted at the end of recovery, and the report used to appear the moment the
// plugins were back, so the user read "recovery complete" over a printer that was still rebooting and
// unreachable. This screen holds that report until the printer answers again. It cannot be dismissed:
// there is nothing to decide, and the report is behind it.
export function PrinterRestartingModal({ restartSeconds }: { restartSeconds?: number | null }) {
  const { t } = useI18n()

  return (
    <Modal dismissable={false} className="size-sm">
      <div className="modal-head">
        <h2>{t('recovery_restart.title')}</h2>
        <p>{t('recovery_restart.body')}</p>
      </div>
      <div className="batch-progress-body">
        {typeof restartSeconds === 'number' && <RebootProgress restartSeconds={restartSeconds} />}
      </div>
    </Modal>
  )
}
