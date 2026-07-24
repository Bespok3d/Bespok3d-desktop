import { useI18n } from '../../../i18n/context'
import cx from '../../../utils/cx'

export type PluginStatus = 'installed' | 'disabled' | 'update'

export function StatusPill({ status }: { status: PluginStatus }) {
  const { t } = useI18n()

  return <span className={cx('status-pill', status)}>{t(`status.${status}`)}</span>
}
