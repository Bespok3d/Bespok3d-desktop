// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useI18n } from '../../i18n/context'
import { Button } from '../common/Button'
import { Modal } from '../common/overlay/Modal'
import './batch-ops.css'
import type { ReactNode } from 'react'

// However a batch op ends, the user meets the same thing: what it was, one line saying how it went,
// whatever detail that ending carries, and one button to close. The per-plugin results report and the
// refusal both render through here, so the two endings of the same operation cannot drift apart.
export function BatchReportModal({ title, summary, summaryTone, size, children, action, onClose }: {
  title: string
  summary: string
  // The colour the one-line verdict is read in: green when the printer did the work, red when it did not.
  summaryTone: 'ok' | 'bad'
  size: 'size-sm' | 'size-md'
  children?: ReactNode
  // The way out of this ending, when there is one: an ending the user can act on offers the action
  // beside Close, so a refusal that only re-enrolling clears is not a dead end.
  action?: ReactNode
  onClose: () => void
}) {
  const { t } = useI18n()

  return (
    <Modal onClose={onClose} className={size}>
      <div className="modal-head">
        <h2>{title}</h2>
        <p className={`batch-report-${summaryTone}`}>{summary}</p>
      </div>
      {children}
      <div className="recovery-foot">
        {action}
        <Button size="sm" onClick={onClose}>{t('btn.close')}</Button>
      </div>
    </Modal>
  )
}
