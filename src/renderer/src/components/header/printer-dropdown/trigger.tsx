import { useI18n } from '../../../i18n/context'
import { TriggerUpdates } from './trigger-updates'
import { PrinterIdentity } from './identity'
import type { Printer } from '../../../data/types'

// The selected printer's summary inside the closed dropdown trigger: name + model + update badges on
// top, ip + installed-count (+ an installing hint) below. The closed state stays terse: the badges
// flag what is pending; the wordier "X available" detail and per-update actions live in the open rows.
export function PrinterTriggerInfo({ printer, installingCount, adapterJinniVersion }: { printer: Printer; installingCount: number; adapterJinniVersion?: string }) {
  const { t } = useI18n()

  return (
    <div className="printer-info">
      <PrinterIdentity
        printer={printer}
        nameExtra={<TriggerUpdates printer={printer} adapterJinniVersion={adapterJinniVersion} />}
        metaExtra={installingCount > 0 ? <><span>·</span><span className="u-warn">{t('header.installing')}</span></> : null}
      />
    </div>
  )
}
