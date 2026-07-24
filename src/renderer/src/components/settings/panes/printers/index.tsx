import { useState } from 'react'
import type { ReactNode } from 'react'
import { IconPlus } from '../../../../design-system/icons'
import { Group } from '../../../common/Group'
import { Button } from '../../../common/Button'
import { Toggle } from '../../../common/Toggle'
import { ConfirmActionDialog, shouldSkipConfirm } from '../../../common/overlay/ConfirmActionDialog'
import type { Printer } from '../../../../data/types'
import { useI18n } from '../../../../i18n/context'
import { usePrinterActions, type PrinterActions } from '../../printer-actions'
import { PrinterRow } from './printer-row'

// The printer list plus every action the Settings shell can take on a printer. The shell receives
// this from the app; the actions are provided to the pane through PrinterActionsContext.
export interface PrinterManagementProps extends PrinterActions {
  printers: Printer[]
}

export interface PrintersPaneProps {
  printers: Printer[]
  adapters: AdapterInfo[]
}

type ConfirmKind = 'deactivate' | 'uninstall' | 'remove'
type PendingConfirm = { printerId: string; kind: ConfirmKind }

// The opt-in shown in the Remove dialog: removing a printer from Bespok3d forgets the app record; this
// toggle additionally tears Bespok3d down on the device itself.
function TeardownToggle({ on, onChange }: { on: boolean; onChange: (value: boolean) => void }) {
  const { t } = useI18n()

  return (
    <div className="printer-remove-teardown">
      <Toggle on={on} onChange={onChange} ariaLabel={t('printers.remove_also_teardown')} />
      <span>
        <span className="printer-remove-teardown-label">{t('printers.remove_also_teardown')}</span>
        <span className="printer-remove-teardown-hint">{t('printers.remove_also_teardown_hint')}</span>
      </span>
    </div>
  )
}

function ConfirmDialogs({ pending, printer, alsoTeardown, onTeardownChange, onConfirm, onCancel }: {
  pending: PendingConfirm | null
  printer: Printer | null
  alsoTeardown: boolean
  onTeardownChange: (value: boolean) => void
  onConfirm: () => void
  onCancel: () => void
}): ReactNode {
  const { t } = useI18n()
  if (!pending || !printer) return null
  const name = printer.nick || printer.model

  if (pending.kind === 'deactivate') {
    return <ConfirmActionDialog title={t('printers.deactivate_title', { name })} summary={t('printers.deactivate_summary')} detail={t('printers.deactivate_detail')} confirmLabel={t('printers.deactivate')} suppressKey="b3d.confirm.deactivate" onConfirm={onConfirm} onCancel={onCancel} />
  }
  if (pending.kind === 'uninstall') {
    return <ConfirmActionDialog title={t('printers.uninstall_title', { name })} summary={t('printers.uninstall_summary')} detail={t('printers.uninstall_detail')} confirmLabel={t('printers.uninstall')} danger onConfirm={onConfirm} onCancel={onCancel} />
  }

  return <ConfirmActionDialog title={t('printers.remove_title', { name })} summary={t('printers.remove_summary')} detail={t('printers.remove_detail')} confirmLabel={t('printers.remove')} danger={alsoTeardown} extra={<TeardownToggle on={alsoTeardown} onChange={onTeardownChange} />} onConfirm={onConfirm} onCancel={onCancel} />
}

export function PrintersPane({ printers, adapters }: PrintersPaneProps) {
  const { t } = useI18n()
  const actions = usePrinterActions()
  const [pending, setPending] = useState<PendingConfirm | null>(null)
  const [alsoTeardown, setAlsoTeardown] = useState(false)

  function closePending() {
    setPending(null)
    setAlsoTeardown(false)
  }

  function requestDeactivate(printerId: string) {
    if (shouldSkipConfirm('b3d.confirm.deactivate')) {
      actions.onDeactivatePrinter(printerId)

      return
    }
    setPending({ printerId, kind: 'deactivate' })
  }

  function handleConfirm() {
    if (!pending) return
    const { printerId, kind } = pending
    const teardown = alsoTeardown
    closePending()
    if (kind === 'deactivate') actions.onDeactivatePrinter(printerId)
    else if (kind === 'uninstall' || (kind === 'remove' && teardown)) actions.onUninstallPrinter(printerId)
    else actions.onRemovePrinter(printerId)
  }

  const pendingPrinter = pending ? printers.find((printer) => printer.id === pending.printerId) ?? null : null

  return (
    <>
      <div className="set-pane-intro">{t('printers.intro')}</div>

      <Group
        title={t('printers.my_printers')}
        action={
          <Button variant="outline" size="sm" onClick={actions.onAddPrinter}>
            <IconPlus size={13} /> {t('printers.add_printer')}
          </Button>
        }
      >
        {printers.length === 0 && <div className="set-empty">{t('printers.empty')}</div>}
        {printers.map((printer) => (
          <PrinterRow
            key={printer.id}
            printer={printer}
            adapters={adapters}
            onRemovePrinter={(id) => { setAlsoTeardown(false); setPending({ printerId: id, kind: 'remove' }) }}
            onUpdatePrinterIcon={actions.onUpdatePrinterIcon}
            onEnrollPrinter={actions.onEnrollPrinter}
            onRepair={actions.onRepairPrinter}
            onRecover={actions.onRecoverPrinter}
            onReinstall={actions.onReinstallPlugins}
            onViewEnrollmentLog={actions.onViewEnrollmentLog}
            onUpdateDaemon={actions.onUpdateDaemon}
            onUpdateJinni={actions.onUpdateJinni}
            onDeactivate={requestDeactivate}
            onReactivate={actions.onReactivatePrinter}
            onUninstall={(id) => setPending({ printerId: id, kind: 'uninstall' })}
            onSetCustomSshCredentials={actions.onSetCustomSshCredentials}
          />
        ))}
      </Group>

      <ConfirmDialogs
        pending={pending}
        printer={pendingPrinter}
        alsoTeardown={alsoTeardown}
        onTeardownChange={setAlsoTeardown}
        onConfirm={handleConfirm}
        onCancel={closePending}
      />
    </>
  )
}
