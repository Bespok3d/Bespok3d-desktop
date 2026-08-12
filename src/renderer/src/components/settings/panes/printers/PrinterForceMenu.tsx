// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useI18n } from '../../../../i18n/context'
import { PopoverMenu } from './PopoverMenu'

export interface PrinterForceActions {
  onEnroll: (id: string, forced?: boolean) => void
  onRecover: (id: string, forced?: boolean) => void
  onRepair: (id: string, forced?: boolean) => void
  onReinstall: (id: string) => void
}

// On-demand access to the setup flows that the primary action hides: an enrolled printer can be
// re-enrolled, fully recovered, daemon-repaired, or have its plugins re-applied at any time, regardless
// of the status the connection ladder currently reports. Forced is what the menu is for: the printer
// reporting a newer daemon than this app ships no longer refuses the run, because putting it back onto
// the shipped daemon is sometimes the repair being asked for. A running print still refuses.
export function PrinterForceMenu({ printerId, actions }: { printerId: string; actions: PrinterForceActions }) {
  const { t } = useI18n()

  return (
    <PopoverMenu label={t('printers.force')} title={t('printers.force_hint')}>
      {(close) => (
        <>
          <button className="menu-action" onClick={() => { close(); actions.onEnroll(printerId, true) }}>{t('printers.force_enroll')}</button>
          <button className="menu-action" onClick={() => { close(); actions.onRecover(printerId, true) }}>{t('printers.force_recover')}</button>
          <button className="menu-action" onClick={() => { close(); actions.onRepair(printerId, true) }}>{t('printers.force_repair')}</button>
          <button className="menu-action" onClick={() => { close(); actions.onReinstall(printerId) }}>{t('printers.force_reinstall')}</button>
        </>
      )}
    </PopoverMenu>
  )
}
