// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useState } from 'react'
import type { ReactNode } from 'react'
import cx from '../../../utils/cx'
import { useI18n } from '../../../i18n/context'
import { Modal } from './Modal'
import { Button } from '../Button'

export interface ConfirmActionDialogProps {
  title: string
  summary: string
  detail: string
  confirmLabel: string
  danger?: boolean
  suppressKey?: string
  // Extra controls rendered above the action buttons (e.g. an opt-in toggle that changes what the
  // confirm does). The caller owns the control's state and reads it in onConfirm.
  extra?: ReactNode
  onConfirm: () => void
  onCancel: () => void
}

function useSuppress(suppressKey: string | undefined): [boolean, (v: boolean) => void] {
  const stored = suppressKey ? localStorage.getItem(suppressKey) === 'true' : false
  const [suppressed, setSuppressed] = useState(stored)
  function toggle(value: boolean) {
    setSuppressed(value)
    if (suppressKey) localStorage.setItem(suppressKey, String(value))
  }

  return [suppressed, toggle]
}

export function shouldSkipConfirm(suppressKey: string | undefined): boolean {
  if (!suppressKey) return false

  return localStorage.getItem(suppressKey) === 'true'
}

export function ConfirmActionDialog({ title, summary, detail, confirmLabel, danger, suppressKey, extra, onConfirm, onCancel }: ConfirmActionDialogProps) {
  const { t } = useI18n()
  const [detailOpen, setDetailOpen] = useState(false)
  const [suppressed, setSuppressed] = useSuppress(suppressKey)

  return (
    <Modal onClose={onCancel}>
      <div className="modal-head">
        <h2 className="dialog-title">{title}</h2>
        <p className="dialog-subtitle">
          {summary}
          {' '}
          <button
            className={cx('explainer-toggle', 'dialog-detail-toggle', detailOpen && 'open')}
            onClick={() => setDetailOpen((prev) => !prev)}
          >
            <span className="dialog-detail-caret">▸</span>
          </button>
        </p>
        {detailOpen && (
          <p className="dialog-detail">
            {detail}
          </p>
        )}
      </div>
      <div className="dialog-body">
        {extra}
        {suppressKey && (
          <label className="dialog-suppress">
            <input type="checkbox" checked={suppressed} onChange={(changeEvent) => setSuppressed(changeEvent.target.checked)} />
            {t('btn.dont_show_again')}
          </label>
        )}
        <div className="dialog-actions">
          <Button variant="outline" size="sm" onClick={onCancel}>{t('btn.cancel')}</Button>
          <Button variant={danger ? 'danger' : 'primary'} size="sm" onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </Modal>
  )
}
