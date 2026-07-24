import { Group } from '../../../common/Group'
import { Button } from '../../../common/Button'
import { SettingRow } from '../../../common/SettingRow'
import { useI18n } from '../../../../i18n/context'
import type { TFunction } from '../../../../i18n'
import { useAppUpdate } from '../../../app-update/useAppUpdate'

type AppUpdate = ReturnType<typeof useAppUpdate>

function statusText(t: TFunction, appUpdate: AppUpdate): string {
  if (appUpdate.errorMessage) return t('set.update.error')
  if (appUpdate.checking) return t('set.update.checking')
  if (appUpdate.downloaded) return t('set.update.ready', { version: appUpdate.update?.version ?? '' })
  if (appUpdate.update && appUpdate.progressPercent !== null) {
    return t('set.update.downloading', { percent: Math.round(appUpdate.progressPercent) })
  }
  if (appUpdate.update) return t('set.update.available', { version: appUpdate.update.version })
  if (appUpdate.upToDate) return t('set.update.up_to_date')

  return ''
}

// The current-version + check-for-updates + download-progress status block.
export function UpdateStatusGroup({ appUpdate }: { appUpdate: AppUpdate }) {
  const { t } = useI18n()
  const status = statusText(t, appUpdate)
  const downloading = appUpdate.update && appUpdate.progressPercent !== null && !appUpdate.downloaded

  return (
    <Group title={t('set.update.status')}>
      {appUpdate.appliedVersion && (
        <SettingRow label={t('set.update.applied', { version: appUpdate.appliedVersion })} hint={t('set.update.applied_hint')} controls={
          <Button variant="ghost" size="sm" onClick={appUpdate.dismissApplied}>{t('set.update.dismiss')}</Button>
        } />
      )}
      <div className="set-row">
        <div className="set-row-text">
          <div className="set-row-label">{t('set.update.current_version')}</div>
          <div className="set-row-hint mono">{__APP_VERSION__}{status ? ` · ${status}` : ''}</div>
        </div>
        <div className="set-row-control">
          <Button size="sm" disabled={appUpdate.checking} onClick={appUpdate.check}>{t('set.update.check')}</Button>
        </div>
      </div>
      {downloading && (
        <div className="set-row vertical">
          <progress value={appUpdate.progressPercent ?? 0} max={100} className="u-w-full" />
        </div>
      )}
    </Group>
  )
}
