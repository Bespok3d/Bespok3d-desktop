// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// The plain list of what leaves the machine and what never does. It is one component because the
// question is asked in two places, the one-time request and Settings, and an answer that differed
// between them would be worse than no answer at all.
import { useI18n } from '../../../../i18n/context'

export function WhatIsSent() {
  const { t } = useI18n()

  return (
    <div className="usage-facts">
      <h3 className="usage-facts-title">{t('gen.telemetry_sent')}</h3>
      <ul className="usage-facts-list">
        <li>{t('gen.telemetry_sent_actions')}</li>
        <li>{t('gen.telemetry_sent_result')}</li>
        <li>{t('gen.telemetry_sent_client')}</li>
      </ul>
      <h3 className="usage-facts-title">{t('gen.telemetry_never')}</h3>
      <ul className="usage-facts-list">
        <li>{t('gen.telemetry_never_typed')}</li>
        <li>{t('gen.telemetry_never_printer')}</li>
        <li>{t('gen.telemetry_never_location')}</li>
        <li>{t('gen.telemetry_never_text')}</li>
        <li>{t('gen.telemetry_never_id')}</li>
      </ul>
    </div>
  )
}
