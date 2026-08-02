// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// The question, asked once. It decides for itself whether to appear, so the app mounts it as one line
// and never has to know the state of the setting.
//
// Every way out of it that is not the yes button is a no, the backdrop and the escape key included.
// There is no ask-me-later: an app that keeps asking is an app that wears the user down into a yes.
import { useState } from 'react'
import { Modal } from '../../../common/overlay/Modal'
import { Button } from '../../../common/Button'
import { useAsyncResource } from '../../../common/hooks/useAsyncResource'
import { useI18n } from '../../../../i18n/context'
import { WhatIsSent } from './what-is-sent'
import './usage-reporting.css'

export function UsageReportingRequest() {
  const { t } = useI18n()
  const request = useAsyncResource(() => window.b3d.analytics.consent(), [])
  const [answered, setAnswered] = useState(false)

  async function answer(granted: boolean) {
    setAnswered(true)
    await window.b3d.analytics.setConsent(granted)
  }

  // Never asked, already answered, or a run whose events would not be sent anyway: main decides all
  // three, and an unattended run is one of them, which is what lets it finish with nobody there.
  if (answered || !request.value?.ask) return null

  return (
    <Modal onClose={() => answer(false)}>
      <div className="modal-head">
        <h2 className="dialog-title">{t('gen.telemetry_ask_title')}</h2>
        <p className="dialog-subtitle">{t('gen.telemetry_ask_summary')}</p>
      </div>
      <div className="dialog-body">
        <WhatIsSent />
        <div className="dialog-actions">
          <Button variant="outline" size="sm" onClick={() => answer(false)}>{t('gen.telemetry_ask_no')}</Button>
          <Button variant="primary" size="sm" onClick={() => answer(true)}>{t('gen.telemetry_ask_yes')}</Button>
        </div>
      </div>
    </Modal>
  )
}
