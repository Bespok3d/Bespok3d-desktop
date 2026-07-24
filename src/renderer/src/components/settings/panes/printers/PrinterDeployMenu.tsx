import { useI18n } from '../../../../i18n/context'
import { PopoverMenu } from './PopoverMenu'

export interface PrinterDeployActions {
  onUpdateDaemon: (id: string) => void
  onUpdateJinni: (id: string) => void
}

// The row's redeploy menu: one "Update" button that opens a choice of deploying the daemon or the
// device-side adapter (jinni). The trigger reads as primary when an update is pending so the row signals
// the action without it being the only thing the user can do. Both items are always available: a
// redeploy is valid at any time (it is how a stuck or lagging half is put right), like the Force menu.
export function PrinterDeployMenu({ printerId, updatePending, actions }: { printerId: string; updatePending: boolean; actions: PrinterDeployActions }) {
  const { t } = useI18n()

  return (
    <PopoverMenu label={t('printers.deploy')} triggerVariant={updatePending ? 'primary' : 'outline'}>
      {(close) => (
        <>
          <button className="menu-action" onClick={() => { close(); actions.onUpdateDaemon(printerId) }}>{t('printers.update_daemon')}</button>
          <button className="menu-action" onClick={() => { close(); actions.onUpdateJinni(printerId) }}>{t('printers.update_jinni')}</button>
        </>
      )}
    </PopoverMenu>
  )
}
