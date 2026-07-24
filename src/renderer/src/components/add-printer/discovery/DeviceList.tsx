import type { DiscoveredPrinterRecord } from '../../../env'
import { useI18n } from '../../../i18n/context'
import { DiscoveryCloudHint } from './DiscoveryCloudHint'
import { Button } from '../../common/Button'
import { DeviceRow } from './DeviceRow'
import { useDiscoveryList } from './useDiscoveryList'
import '../add-printer.css'

interface DeviceListProps {
  discovered: DiscoveredPrinterRecord[]
  scanning: boolean
  isAlreadyAdded: (device: DiscoveredPrinterRecord) => boolean
  onPick: (device: DiscoveredPrinterRecord) => void
}

export function DeviceList({ discovered, scanning, isAlreadyAdded, onPick }: DeviceListProps) {
  const { t } = useI18n()
  const { showAll, setShowAll, visible, hiddenN, total } = useDiscoveryList(discovered)

  if (visible.length === 0 && !scanning) {
    return (
      <>
        <div className="ap-empty">{t('add.no_printers')}</div>
        <DiscoveryCloudHint />
        {hiddenN > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAll(true)}
            className="ap-show-more"
          >
            {t('add.show_all_devices', { total, hidden: hiddenN })}
          </Button>
        )}
      </>
    )
  }

  return (
    <>
      <div className="ap-list">
        {visible.map((device) => (
          <DeviceRow
            key={device.host}
            device={device}
            added={isAlreadyAdded(device)}
            onPick={() => onPick(device)}
          />
        ))}
      </div>
      {(hiddenN > 0 || showAll) && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowAll((prev) => !prev)}
          className="ap-show-more"
        >
          {showAll
            ? t('add.show_printers_only')
            : t('add.show_all_devices', { total, hidden: hiddenN })}
        </Button>
      )}
    </>
  )
}
