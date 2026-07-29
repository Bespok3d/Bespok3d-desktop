// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useState } from 'react'
import type { ReactNode } from 'react'
import cx from '../../../utils/cx'
import { useI18n } from '../../../i18n/context'
import { Modal } from '../../common/overlay/Modal'
import { Button } from '../../common/Button'
import './report-modal.css'

// The shared scaffold for the two "something went wrong, here is a shareable report" modals (an
// install failure, a safety auto-deactivate). Owns the progressive-disclosure Technical-details
// toggle so both reveal the raw daemon text the same way, and owns the Close button; callers supply
// the headline copy, an optional callout, the report text, and their own primary actions.
export function BugReportModal({ title, subtitle, callout, guidance, tech, techTone = 'neutral', actions, onClose }: {
  title: string
  subtitle: string
  callout?: ReactNode
  guidance: string
  tech?: string
  techTone?: 'danger' | 'neutral'
  actions: ReactNode
  onClose: () => void
}) {
  const { t } = useI18n()
  const [showTech, setShowTech] = useState(false)

  return (
    <Modal onClose={onClose} className="report-modal">
      <div className="modal-head">
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
      <div className="report-body">
        {callout}
        <p className="report-guidance">{guidance}</p>
        {tech && (
          <Button variant="outline" size="sm" className="report-tech-toggle" onClick={() => setShowTech((prev) => !prev)}>
            {showTech ? t('report.hide_tech') : t('report.show_tech')}
          </Button>
        )}
        {tech && showTech && <pre className={cx('report-tech', techTone === 'danger' && 'danger')}>{tech}</pre>}
      </div>
      <div className="report-foot">
        {actions}
        <Button className="report-close" onClick={onClose}>{t('btn.close')}</Button>
      </div>
    </Modal>
  )
}
