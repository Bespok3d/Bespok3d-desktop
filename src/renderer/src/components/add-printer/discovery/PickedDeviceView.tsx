import cx from '../../../utils/cx'
import type { DiscoveredPrinterRecord } from '../../../env'
import { looksLikePrinter } from '../../../data/printerDiscovery'
import { AdapterSelect } from '../AdapterSelect'
import { IconPrinter, IconServer } from '../../../design-system/icons'
import { useI18n } from '../../../i18n/context'
import '../add-printer.css'

interface PickedDeviceViewProps {
  picked: DiscoveredPrinterRecord
  nick: string
  adapterId: string
  onPick: (device: DiscoveredPrinterRecord | null) => void
  onNickChange: (value: string) => void
  onAdapterChange: (value: string) => void
}

export function PickedDeviceView({
  picked,
  nick,
  adapterId,
  onPick,
  onNickChange,
  onAdapterChange,
}: PickedDeviceViewProps) {
  const { t } = useI18n()

  return (
    <>
      <div className="ap-list">
        <button className={cx('ap-row', 'picked')} onClick={() => onPick(null)}>
          <div className="ap-row-avatar">
            {looksLikePrinter(picked) ? <IconPrinter size={18} /> : <IconServer size={18} />}
          </div>
          <div className="ap-row-info">
            <div className="ap-row-title">
              {picked.model !== 'Network device' ? picked.model : picked.ip}
            </div>
            <div className="ap-row-meta">
              <span className="mono">{picked.ip}</span>
              <span>·</span>
              <span>{picked.service}</span>
            </div>
          </div>
          <span className="ap-row-change">
            {t('add.change')}
          </span>
        </button>
      </div>

      <div className="ap-confirm">
        <div className="ap-confirm-label">{t('add.configure')}</div>
        <div className="ap-confirm-fields">
          <input
            className="ap-nick"
            type="text"
            placeholder={t('add.nick_label')}
            value={nick}
            onChange={(event) => onNickChange(event.target.value)}
            autoFocus
          />
          <span className="ap-confirm-sep">·</span>
          <span className="ap-confirm-host">{picked.ip}</span>
        </div>
        <AdapterSelect adapterId={adapterId} onChange={onAdapterChange} />
      </div>
    </>
  )
}
