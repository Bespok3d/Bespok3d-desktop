// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { Group } from '../../../common/Group'
import { Segmented } from '../../../common/Segmented'
import { SettingRow } from '../../../common/SettingRow'
import { detectSystemLocale } from '../../../../i18n'
import { useI18n } from '../../../../i18n/context'
import type { LocaleSettings } from './index'

export function RegionFormatsGroup({ settings, onChange }: {
  settings: LocaleSettings
  onChange: (s: LocaleSettings) => void
}) {
  const { t } = useI18n()
  const effectiveCode = settings.locale === 'system' ? detectSystemLocale() : settings.locale
  const numberSample = (1234567.89).toLocaleString(effectiveCode)
  const dateSample = new Date('2026-05-22T10:30:00').toLocaleString(effectiveCode, {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })

  return (
    <Group title={t('lang.region_formats')}>
      <SettingRow label={t('lang.number_formatting')} hint={t('lang.number_hint')} controls={
        <code className="region-sample mono">{numberSample}</code>
      } />
      <SettingRow label={t('lang.date_time')} hint={t('lang.date_hint')} controls={
        <code className="region-sample mono">{dateSample}</code>
      } />
      <SettingRow label={t('lang.first_day')} controls={
        <Segmented
          value={settings.firstDayOfWeek}
          onChange={(selected) => onChange({ ...settings, firstDayOfWeek: selected })}
          options={[{ value: 'auto', label: t('lang.auto') }, { value: 'mon', label: t('lang.mon') }, { value: 'sun', label: t('lang.sun') }]}
        />
      } />
      <SettingRow label={t('lang.units')} hint={t('lang.units_hint')} controls={
        <Segmented
          value={settings.units}
          onChange={(selected) => onChange({ ...settings, units: selected })}
          options={[{ value: 'metric', label: t('lang.metric') }, { value: 'imperial', label: t('lang.imperial') }]}
        />
      } />
    </Group>
  )
}
