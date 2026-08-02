// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { Group } from '../../common/Group'
import { Segmented } from '../../common/Segmented'
import { SettingRow } from '../../common/SettingRow'
import { IconSun, IconMoon, IconScreen } from '../../../design-system/icons'
import { RegionFormatsGroup } from './language'
import { UsageReportingGroup } from './usage-reporting'
import type { LocaleSettings } from './language'
import { useI18n } from '../../../i18n/context'

type Density = 'compact' | 'comfortable' | 'spacious'

interface AppearancePaneProps {
  theme: 'light' | 'dark' | 'system'
  onSetTheme: (t: 'light' | 'dark' | 'system') => void
  density: Density
  onSetDensity: (d: Density) => void
  storeGrouped: boolean
  onSetStoreGrouped: (v: boolean) => void
  localeSettings: LocaleSettings
  onLocaleChange: (s: LocaleSettings) => void
}

export function AppearancePane({ theme, onSetTheme, density, onSetDensity, storeGrouped, onSetStoreGrouped, localeSettings, onLocaleChange }: AppearancePaneProps) {
  const { t } = useI18n()

  return (
    <>
      <Group title={t('app.theme')}>
        <SettingRow className="vertical" label={t('app.appearance')} hint={t('app.appearance_hint')} controls={
          <Segmented
            value={theme}
            onChange={onSetTheme}
            options={[
              { value: 'light', label: t('app.theme_light'), icon: <IconSun size={13} /> },
              { value: 'dark', label: t('app.theme_dark'), icon: <IconMoon size={13} /> },
              { value: 'system', label: t('app.theme_system'), icon: <IconScreen size={13} /> },
            ]}
          />
        } />
      </Group>

      <Group title={t('app.density')}>
        <SettingRow label={t('app.grid_layout')} hint={t('app.density_hint')} controls={
          <Segmented
            value={density}
            onChange={onSetDensity}
            options={[
              { value: 'compact', label: t('app.compact') },
              { value: 'comfortable', label: t('app.comfortable') },
              { value: 'spacious', label: t('app.spacious') },
            ]}
          />
        } />
      </Group>

      <Group title={t('app.store_grouping')}>
        <SettingRow label={t('app.store_grouping')} hint={t('app.store_grouping_hint')} controls={
          <Segmented<'flat' | 'grouped'>
            value={storeGrouped ? 'grouped' : 'flat'}
            onChange={(grouping) => onSetStoreGrouped(grouping === 'grouped')}
            options={[
              { value: 'flat', label: t('app.store_flat') },
              { value: 'grouped', label: t('app.store_grouped') },
            ]}
          />
        } />
      </Group>

      <RegionFormatsGroup settings={localeSettings} onChange={onLocaleChange} />
      <UsageReportingGroup />
    </>
  )
}
