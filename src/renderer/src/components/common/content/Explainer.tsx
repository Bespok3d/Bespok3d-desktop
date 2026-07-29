// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useState } from 'react'
import { useI18n } from '../../../i18n/context'
import { IconInfo } from '../../../design-system/icons'
import './explainer.css'

interface ExplainerProps {
  brief: React.ReactNode
  detail: React.ReactNode
}

export function Explainer({ brief, detail }: ExplainerProps) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)

  return (
    <span className="explainer">
      <span className="explainer-brief">
        {brief}
        <button
          className={`explainer-toggle${open ? ' open' : ''}`}
          onClick={(toggleEvent) => { toggleEvent.stopPropagation(); setOpen((prev) => !prev) }}
          title={open ? t('explainer.hide') : t('explainer.show')}
        >
          <IconInfo size={11} />
        </button>
      </span>
      {open && <span className="explainer-detail">{detail}</span>}
    </span>
  )
}
