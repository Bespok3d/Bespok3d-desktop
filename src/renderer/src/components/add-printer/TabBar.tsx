import cx from '../../utils/cx'
import { IconWifi } from '../../design-system/icons'
import { useI18n } from '../../i18n/context'

export type Tab = 'scan' | 'manual'

interface TabBarProps {
  tab: Tab
  count: number
  onSwitch: (next: Tab) => void
}

export function TabBar({ tab, count, onSwitch }: TabBarProps) {
  const { t } = useI18n()

  return (
    <div className="ap-tabs">
      <button
        className={cx('ap-tab', tab === 'scan' && 'active')}
        onClick={() => onSwitch('scan')}
      >
        <IconWifi size={13} />
        {t('add.tab_scan')}
        <span className="ap-tab-count">{count}</span>
      </button>
      <button
        className={cx('ap-tab', tab === 'manual' && 'active')}
        onClick={() => onSwitch('manual')}
      >
        {t('add.tab_manual')}
      </button>
    </div>
  )
}
