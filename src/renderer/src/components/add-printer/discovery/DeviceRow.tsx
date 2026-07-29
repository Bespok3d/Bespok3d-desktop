// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import cx from '../../../utils/cx'
import type { DiscoveredPrinterRecord } from '../../../env'
import { looksLikePrinter } from '../../../data/printerDiscovery'
import { IconPrinter, IconServer } from '../../../design-system/icons'
import { useI18n } from '../../../i18n/context'
import '../add-printer.css'

interface DeviceRowProps {
  device: DiscoveredPrinterRecord
  added: boolean
  onPick: () => void
}

export function DeviceRow({ device, added, onPick }: DeviceRowProps) {
  const { t } = useI18n()

  return (
    <button
      className={cx('ap-row', added && 'unsupported')}
      disabled={added}
      onClick={() => !added && onPick()}
    >
      <div className="ap-row-avatar">
        {looksLikePrinter(device) ? <IconPrinter size={18} /> : <IconServer size={18} />}
      </div>
      <div className="ap-row-info">
        <div className="ap-row-title">
          {device.model !== 'Network device' ? device.model : device.ip}
          {added && (
            <span className="ap-tag ap-tag-added">
              {t('add.added')}
            </span>
          )}
        </div>
        <div className="ap-row-meta">
          <span className="mono">{device.ip}</span>
          <span>·</span>
          <span>{device.service}</span>
        </div>
      </div>
    </button>
  )
}
