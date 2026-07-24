import { useI18n } from '../../../i18n/context'
import { IconArrowUp, IconPlus, IconSettings } from '../../../design-system/icons'

interface PrinterMenuActionsProps {
  addLabel: string
  pluginUpdates: number
  onUpdateAll: () => void
  onAddPrinter: () => void
  onOpenSettings: () => void
  onClose: () => void
}

// The dropdown footer: a one-click "Update all" for the selected printer's plugin updates, then
// add-printer and printer-settings. Daemon/jinni updates are prompted per row now, so they do not live
// here. Each action closes the menu after firing.
export function PrinterMenuActions({ addLabel, pluginUpdates, onUpdateAll, onAddPrinter, onOpenSettings, onClose }: PrinterMenuActionsProps) {
  const { t } = useI18n()

  return (
    <>
      {pluginUpdates > 0 && (
        <button className="menu-action update-all" onClick={onUpdateAll}>
          <IconArrowUp size={16} /> {t('printers.update_all', { count: pluginUpdates })}
        </button>
      )}
      <div className="menu-divider" />
      <button className="menu-action" onClick={() => { onAddPrinter(); onClose() }}>
        <IconPlus size={16} /> {addLabel}
      </button>
      <button className="menu-action" onClick={() => { onOpenSettings(); onClose() }}>
        <IconSettings size={16} /> {t('header.printer_settings')}
      </button>
    </>
  )
}
