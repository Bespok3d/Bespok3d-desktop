// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useI18n } from '../../../i18n/context'
import { usePrintState } from '../../plugin-store/usePrintState'
import { TriggerUpdates } from './trigger-updates'
import { PrinterIdentity } from './identity'
import type { Printer } from '../../../data/types'

// What the printer is busy doing right now, as an i18n key + its tone. Installing wins: the app is
// acting on the printer this second, which is the more immediate fact. Printing is a statement, not a
// gate: nothing in the menu is disabled by it, the daemon is still the thing that refuses a batch
// mid-print. Saying it here is the warning BEFORE the user aims "Update all" at a running print.
function printerLiveState(installing: boolean, printing: boolean): { key: string; tone: string } | null {
  if (installing) return { key: 'header.installing', tone: 'u-warn' }
  if (printing) return { key: 'header.printing', tone: 'u-accent' }

  return null
}

// The selected printer's summary inside the closed dropdown trigger: name + model + update badges on
// top, ip + installed-count (+ an installing or printing hint) below. The closed state stays terse: the
// badges flag what is pending; the wordier "X available" detail and per-update actions live in the open
// rows. The trigger stays on screen while the menu is open, so the hint is there as the user reads it.
export function PrinterTriggerInfo({ printer, installingCount, adapterJinniVersion }: { printer: Printer; installingCount: number; adapterJinniVersion?: string }) {
  const { t } = useI18n()
  const { printActive } = usePrintState(printer)
  const liveState = printerLiveState(installingCount > 0, printActive)

  return (
    <div className="printer-info">
      <PrinterIdentity
        printer={printer}
        nameExtra={<TriggerUpdates printer={printer} adapterJinniVersion={adapterJinniVersion} />}
        metaExtra={liveState ? <><span>·</span><span className={liveState.tone}>{t(liveState.key)}</span></> : null}
      />
    </div>
  )
}
