// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useI18n } from '../../i18n/context'
import { Button } from '../common/Button'

// The screen the user says yes on. The title above it already says what is about to happen, so this
// carries the decision itself: go ahead, cancel, or hand over their own SSH login first.
export function GoAheadStep({ actionLabel, onConfirm, onOwnCredentials, onCancel }: { actionLabel: string; onConfirm: () => void; onOwnCredentials: () => void; onCancel: () => void }) {
  const { t } = useI18n()

  return (
    <div className="enroll-body">
      <div className="modal-foot">
        <Button variant="ghost" onClick={onOwnCredentials}>{t('enroll.creds.own')}</Button>
        <Button variant="outline" onClick={onCancel}>{t('btn.cancel')}</Button>
        <Button variant="primary" onClick={onConfirm}>{actionLabel}</Button>
      </div>
    </div>
  )
}
