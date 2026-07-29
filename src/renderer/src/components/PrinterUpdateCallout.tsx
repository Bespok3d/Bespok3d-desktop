// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import cx from '../utils/cx'
import { IconArrowUp } from '../design-system/icons'
import { useI18n } from '../i18n/context'
import type { TFunction } from '../i18n'
import type { UpdateCalloutKind } from '../data/printers'

// The label spells out WHICH thing updates (the colour alone is not self-explanatory): daemon, adapter,
// or both. 'both' is one action that runs the daemon update and redeploys the jinni in the same pass.
function calloutLabel(kind: UpdateCalloutKind, adapterJinniVersion: string | undefined, t: TFunction): string {
  if (kind === 'both') return t('printers.update_both')
  if (kind === 'daemon') return t('printers.update_daemon_to', { version: window.b3d.daemonExpectedVersion })

  return t('printers.update_jinni_to', { version: adapterJinniVersion ?? '' })
}

// The actionable update strip a printer surface shows when a device-side update is pending. Shared by
// the header dropdown row and the Settings printer row so both prompt the update identically. 'daemon'
// and 'both' run the daemon update (it covers the jinni); 'jinni' fires only when the daemon is current.
export function PrinterUpdateCallout({ kind, adapterJinniVersion, onUpdateDaemon, onUpdateJinni }: {
  kind: UpdateCalloutKind
  adapterJinniVersion?: string
  onUpdateDaemon: () => void
  onUpdateJinni: () => void
}) {
  const { t } = useI18n()

  return (
    <button className={cx('printer-update-callout', kind)} onClick={kind === 'jinni' ? onUpdateJinni : onUpdateDaemon}>
      <IconArrowUp size={12} />
      <span>{calloutLabel(kind, adapterJinniVersion, t)}</span>
    </button>
  )
}
