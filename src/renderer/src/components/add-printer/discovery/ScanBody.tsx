// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { DiscoveredPrinterRecord } from '../../../env'
import { looksLikePrinter } from '../../../data/printerDiscovery'
import { IconRefresh, IconCheck } from '../../../design-system/icons'
import { useI18n } from '../../../i18n/context'
import { Button } from '../../common/Button'
import { DeviceList } from './DeviceList'
import { PickedDeviceView } from './PickedDeviceView'
import '../add-printer.css'

export interface ScanBodyProps {
  scanning: boolean
  discovered: DiscoveredPrinterRecord[]
  picked: DiscoveredPrinterRecord | null
  nick: string
  adapterId: string
  isAlreadyAdded: (device: DiscoveredPrinterRecord) => boolean
  onRescan: () => void
  onPick: (device: DiscoveredPrinterRecord | null) => void
  onNickChange: (value: string) => void
  onAdapterChange: (value: string) => void
}

export function ScanBody({
  scanning,
  discovered,
  picked,
  nick,
  adapterId,
  isAlreadyAdded,
  onRescan,
  onPick,
  onNickChange,
  onAdapterChange,
}: ScanBodyProps) {
  const { t } = useI18n()
  const printerCount = discovered.filter(looksLikePrinter).length

  return (
    <div className="ap-body">
      <div className="ap-scan-row">
        <div className="ap-scan-status">
          {scanning ? (
            <>
              <IconRefresh size={12} />
              <span>{t('add.scanning')}</span>
            </>
          ) : (
            <>
              <IconCheck size={12} className="u-ok" />
              <span>{t('add.scan_complete')}</span>
            </>
          )}
          <span className="mono">{t('add.found_count', { count: printerCount })}</span>
        </div>
        <Button variant="ghost" size="sm" onClick={onRescan}>
          <IconRefresh size={12} /> {t('header.rescan')}
        </Button>
      </div>

      {picked ? (
        <PickedDeviceView
          picked={picked}
          nick={nick}
          adapterId={adapterId}
          onPick={onPick}
          onNickChange={onNickChange}
          onAdapterChange={onAdapterChange}
        />
      ) : (
        <DeviceList
          discovered={discovered}
          scanning={scanning}
          isAlreadyAdded={isAlreadyAdded}
          onPick={onPick}
        />
      )}
    </div>
  )
}
