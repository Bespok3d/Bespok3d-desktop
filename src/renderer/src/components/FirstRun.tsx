// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { IconPrinter, IconPlus, IconRefresh, IconWifi } from '../design-system/icons'
import type { DiscoveredPrinterRecord } from '../env'
import { looksLikePrinter, discoveredVendorLabel } from '../data/printerDiscovery'
import { DiscoveryCloudHint } from './add-printer/discovery/DiscoveryCloudHint'
import { useDiscoveryList } from './add-printer/discovery/useDiscoveryList'
import { Button } from './common/Button'
import { useI18n } from '../i18n/context'
import './first-run.css'

interface FirstRunProps {
  discovered: DiscoveredPrinterRecord[]
  onOpenAdd: (pickedId?: string) => void
  onOpenManual: () => void
  onRescan: () => void
}

function DiscoveredRow({
  printer,
  isPrinter,
  onSelect,
}: {
  printer: DiscoveredPrinterRecord
  isPrinter: boolean
  onSelect: () => void
}) {
  const vendorLabel = discoveredVendorLabel(printer)
  const trailing =
    vendorLabel && printer.model === 'Network device' ? vendorLabel : printer.model

  return (
    <button
      className="discovery-row"
      onClick={onSelect}
    >
      {isPrinter ? <IconPrinter size={14} /> : <IconWifi size={14} />}
      <span className="dr-host">{printer.host}</span>
      <span className="dr-ip">{printer.ip}</span>
      <span className="dr-model">{trailing}</span>
    </button>
  )
}

export function FirstRun({ discovered, onOpenAdd, onOpenManual, onRescan }: FirstRunProps) {
  const { t } = useI18n()
  const { showAll, setShowAll, visible, hiddenN, total } = useDiscoveryList(discovered)

  return (
    <div className="empty">
      <div className="empty-card">
        <div className="scanner">
          <div className="scanner-ring" />
          <div className="scanner-ring" />
          <div className="scanner-ring" />
          <div className="scanner-core">
            <IconPrinter size={30} />
          </div>
        </div>

        <h2>{t('first_run.empty_title')}</h2>
        <p>{t('first_run.scanning_hint')}</p>

        {visible.length === 0 && <DiscoveryCloudHint />}

        {discovered.length > 0 && (
          <div className="first-run-discovery-list">
            {visible.map((printer) => (
              <DiscoveredRow
                key={printer.host}
                printer={printer}
                isPrinter={looksLikePrinter(printer)}
                onSelect={() => onOpenAdd(printer.id)}
              />
            ))}
            {(hiddenN > 0 || showAll) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAll((prev) => !prev)}
                className="first-run-show-more"
              >
                {showAll
                  ? t('first_run.show_printers_only', { count: hiddenN })
                  : t('first_run.show_all_devices', { total, hidden: hiddenN })}
              </Button>
            )}
          </div>
        )}

        <div className="first-run-actions">
          <Button variant="primary" onClick={() => onOpenAdd()}>
            <IconPlus size={14} /> {t('header.add_printer')}
          </Button>
          <Button variant="outline" onClick={onOpenManual}>
            {t('first_run.add_manually')}
          </Button>
          <Button variant="ghost" onClick={onRescan}>
            <IconRefresh size={14} /> {t('header.rescan')}
          </Button>
        </div>
      </div>
    </div>
  )
}
