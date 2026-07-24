import { useState, useEffect } from 'react'
import { Group } from '../../../common/Group'
import { Toggle } from '../../../common/Toggle'
import { SettingRow } from '../../../common/SettingRow'
import { useI18n } from '../../../../i18n/context'

export function useUpdatePrefs() {
  const [prefs, setPrefs] = useState<UpdatePrefs | null>(null)
  function loadPrefs() {
    window.b3d.settings.get().then((settings) =>
      setPrefs({
        appUpdateFrequency: settings.appUpdateFrequency,
        appUpdateAutoDownload: settings.appUpdateAutoDownload,
        appUpdateInstallOnQuit: settings.appUpdateInstallOnQuit,
      }))
  }
  useEffect(loadPrefs, [])
  function change(patch: Partial<UpdatePrefs>) {
    setPrefs((prev) => (prev ? { ...prev, ...patch } : prev))
    window.b3d.settings.set(patch).then(() => window.b3d.appUpdate.reconfigure())
  }

  return { prefs, change }
}

function FrequencyRow({ prefs, onChange }: { prefs: UpdatePrefs; onChange: (patch: Partial<UpdatePrefs>) => void }) {
  const { t } = useI18n()

  return (
    <SettingRow label={t('set.update.frequency')} controls={
      <select className="set-select" value={prefs.appUpdateFrequency}
        onChange={(event) => onChange({ appUpdateFrequency: event.target.value as UpdateFrequency })}>
        <option value="launch">{t('set.update.freq_launch')}</option>
        <option value="daily">{t('set.update.freq_daily')}</option>
        <option value="weekly">{t('set.update.freq_weekly')}</option>
        <option value="manual">{t('set.update.freq_manual')}</option>
      </select>
    } />
  )
}

// Update cadence + auto-download + install-timing preferences.
export function UpdatePreferencesGroup({ prefs, onChange, canAutoInstall }: { prefs: UpdatePrefs; onChange: (patch: Partial<UpdatePrefs>) => void; canAutoInstall: boolean }) {
  const { t } = useI18n()

  return (
    <Group title={t('set.update.preferences')}>
      <FrequencyRow prefs={prefs} onChange={onChange} />
      {!canAutoInstall && <div className="set-row"><div className="set-row-hint">{t('set.update.mac_note')}</div></div>}
      <SettingRow label={t('set.update.auto_download')} hint={t('set.update.auto_download_hint')} controls={
        <Toggle on={prefs.appUpdateAutoDownload} disabled={!canAutoInstall} onChange={(value) => onChange({ appUpdateAutoDownload: value })} />
      } />
      <SettingRow label={t('set.update.install_timing')} controls={
        <select className="set-select" value={prefs.appUpdateInstallOnQuit ? 'quit' : 'restart'} disabled={!canAutoInstall}
          onChange={(event) => onChange({ appUpdateInstallOnQuit: event.target.value === 'quit' })}>
          <option value="quit">{t('set.update.apply_quit')}</option>
          <option value="restart">{t('set.update.apply_restart')}</option>
        </select>
      } />
    </Group>
  )
}
