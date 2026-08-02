// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// The place a user comes back to. It answers two questions without leaving the pane: is this on, and
// what exactly is sent. There is no third question about starting over as somebody new, because
// nothing is ever sent that tells this install from any other one.
//
// It reads the answer itself rather than taking it as a prop, because the one-time request can change
// the same setting from the other side of the app, and a value threaded down from App would have to be
// kept in step by hand.
import { Group } from '../../../common/Group'
import { Toggle } from '../../../common/Toggle'
import { SettingRow } from '../../../common/SettingRow'
import { useAsyncResource } from '../../../common/hooks/useAsyncResource'
import { useI18n } from '../../../../i18n/context'
import { WhatIsSent } from './what-is-sent'
import './usage-reporting.css'

export function UsageReportingGroup() {
  const { t } = useI18n()
  const consent = useAsyncResource(() => window.b3d.analytics.consent(), [])
  const granted = consent.value?.answer === 'granted'

  async function answer(wanted: boolean) {
    await window.b3d.analytics.setConsent(wanted)
    consent.reload()
  }

  return (
    <Group title={t('gen.privacy')}>
      <SettingRow
        label={t('gen.telemetry')}
        hint={t('gen.telemetry_hint')}
        controls={<Toggle on={granted} onChange={answer} ariaLabel={t('gen.telemetry')} />}
      />
      <SettingRow className="vertical" label={<WhatIsSent />} hint={t('gen.telemetry_off_note')} />
    </Group>
  )
}
