// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useState, useRef } from 'react'
import { useI18n } from '../../../i18n/context'
import { useClickOutside } from '../../common/hooks/useClickOutside'
import { useCatalog } from '../../../data/catalog'
import { buildUpdateSpecs } from '../../plugin-store/update-all'
import { useChannelPrefs } from '../../common/hooks/useChannelPrefs'
import { usePrinterUpdates } from './usePrinterUpdates'
import { statusLabel } from '../status-presentation'
import { statusDotClass } from '../../../data/printers'
import { PrinterAvatar } from '../PrinterAvatar'
import { PrinterTriggerInfo } from './trigger'
import { PrinterMenuItem } from './menu-item'
import { PrinterMenuActions } from './menu-actions'
import { IconChevron } from '../../../design-system/icons'
import type { Printer } from '../../../data/types'

export interface PrinterDropdownProps {
  printers: Printer[]
  selectedId: string | null
  adapterIcons: Record<string, string>
  adapterJinniVersions: Record<string, string>
  savedPluginVars: Record<string, string>
  onSelect: (id: string) => void
  onAddPrinter: () => void
  onOpenSettings: () => void
  onUpdateDaemon: (id: string) => void
  onUpdateJinni: (id: string) => void
  onUpdateAll: (printerId: string, updates: PluginUpdateSpec[]) => void
  installingCount: number
}

// The header's printer picker: a trigger summarising the selected printer, and a dropdown listing all
// printers plus the add/settings/update actions. Owns the open state + close-on-outside-press; the
// trigger and menu contents live in sibling files.
export function PrinterDropdown({
  printers,
  selectedId,
  adapterIcons,
  adapterJinniVersions,
  savedPluginVars,
  onSelect,
  onAddPrinter,
  onOpenSettings,
  onUpdateDaemon,
  onUpdateJinni,
  onUpdateAll,
  installingCount,
}: PrinterDropdownProps) {
  const { t } = useI18n()
  const { plugins } = useCatalog()
  const { ceilingFor, disabledChannels } = useChannelPrefs()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useClickOutside(ref, () => setOpen(false), open)

  const selected = printers.find((printer) => printer.id === selectedId)
  const selectedUpdates = usePrinterUpdates(selected ?? null)
  if (!selected) return null

  const isInstalling = installingCount > 0
  const dotClass = isInstalling ? 'installing' : statusDotClass(selected)

  function updateAllPlugins() {
    if (!selected) return
    onUpdateAll(selected.id, buildUpdateSpecs(plugins, selected.installedIds, selected.installedVersions ?? {}, savedPluginVars, ceilingFor, disabledChannels))
    setOpen(false)
  }

  return (
    <div className="printer-select" ref={ref}>
      <button className="printer-trigger" onClick={() => setOpen((prev) => !prev)}>
        <PrinterAvatar
          printer={selected}
          adapterIcon={adapterIcons[selected.adapter]}
          dotClass={dotClass}
          dotTitle={statusLabel(selected, isInstalling, t)}
        />
        <PrinterTriggerInfo printer={selected} installingCount={installingCount} adapterJinniVersion={adapterJinniVersions[selected.adapter]} />
        <span className="printer-chevron">
          <IconChevron size={18} />
        </span>
      </button>

      {open && (
        <div className="printer-menu">
          <div className="menu-section-title">{t('header.my_printers')}</div>
          {printers.map((printer) => (
            <PrinterMenuItem
              key={printer.id}
              printer={printer}
              adapterIcon={adapterIcons[printer.adapter]}
              adapterJinniVersion={adapterJinniVersions[printer.adapter]}
              isSelected={printer.id === selectedId}
              onSelect={() => { onSelect(printer.id); setOpen(false) }}
              onUpdateDaemon={() => { onUpdateDaemon(printer.id); setOpen(false) }}
              onUpdateJinni={() => { onUpdateJinni(printer.id); setOpen(false) }}
            />
          ))}
          <PrinterMenuActions
            addLabel={t('header.add_printer')}
            pluginUpdates={selectedUpdates.pluginUpdates}
            onUpdateAll={updateAllPlugins}
            onAddPrinter={onAddPrinter}
            onOpenSettings={onOpenSettings}
            onClose={() => setOpen(false)}
          />
        </div>
      )}
    </div>
  )
}
