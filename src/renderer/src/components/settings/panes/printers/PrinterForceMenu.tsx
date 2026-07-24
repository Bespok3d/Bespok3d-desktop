import { useI18n } from '../../../../i18n/context'
import { PopoverMenu } from './PopoverMenu'

export interface PrinterForceActions {
  onEnroll: (id: string) => void
  onRecover: (id: string) => void
  onRepair: (id: string) => void
  onReinstall: (id: string) => void
}

// On-demand access to the setup flows that the primary action hides: an enrolled printer can be
// re-enrolled, fully recovered, daemon-repaired, or have its plugins re-applied at any time, regardless
// of the status the connection ladder currently reports.
export function PrinterForceMenu({ printerId, actions }: { printerId: string; actions: PrinterForceActions }) {
  const { t } = useI18n()

  return (
    <PopoverMenu label={t('printers.force')} title={t('printers.force_hint')}>
      {(close) => (
        <>
          <button className="menu-action" onClick={() => { close(); actions.onEnroll(printerId) }}>{t('printers.force_enroll')}</button>
          <button className="menu-action" onClick={() => { close(); actions.onRecover(printerId) }}>{t('printers.force_recover')}</button>
          <button className="menu-action" onClick={() => { close(); actions.onRepair(printerId) }}>{t('printers.force_repair')}</button>
          <button className="menu-action" onClick={() => { close(); actions.onReinstall(printerId) }}>{t('printers.force_reinstall')}</button>
        </>
      )}
    </PopoverMenu>
  )
}
