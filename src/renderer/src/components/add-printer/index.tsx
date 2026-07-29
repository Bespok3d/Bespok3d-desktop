// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Printer } from '../../data/types'
import type { DiscoveredPrinterRecord } from '../../env'
import { useI18n } from '../../i18n/context'
import { Modal } from '../common/overlay/Modal'
import { Button } from '../common/Button'
import { TabBar } from './TabBar'
import type { Tab } from './TabBar'
import { ScanBody } from './discovery/ScanBody'
import { ManualBody } from './ManualBody'
import { useAddPrinterForm } from './useAddPrinterForm'
import './add-printer.css'

interface AddPrinterProps {
  initialTab: Tab
  initialPickedId?: string
  discovered: DiscoveredPrinterRecord[]
  existingPrinters: Printer[]
  onAdd: (printer: Printer) => void
  onClose: () => void
}

function AddPrinterFoot({ canAdd, onClose, onAdd }: { canAdd: boolean; onClose: () => void; onAdd: () => void }) {
  const { t } = useI18n()

  return (
    <div className="modal-foot">
      <Button variant="ghost" onClick={onClose}>{t('btn.cancel')}</Button>
      <Button variant="primary" disabled={!canAdd} onClick={onAdd}>{t('add.submit')}</Button>
    </div>
  )
}

function CustomCredentialsCheckbox({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) {
  const { t } = useI18n()

  return (
    <div className="ap-body ap-body-tight">
      <label className="ap-custom-ssh">
        <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
        <span>
          <span className="ap-custom-ssh-label">{t('add.custom_ssh')}</span>
          <span className="ap-custom-ssh-hint">{t('add.custom_ssh_hint')}</span>
        </span>
      </label>
    </div>
  )
}

export function AddPrinter({
  initialTab,
  initialPickedId,
  discovered,
  existingPrinters,
  onAdd,
  onClose,
}: AddPrinterProps) {
  const { t } = useI18n()
  const form = useAddPrinterForm(initialTab, initialPickedId, discovered)

  function isAlreadyAdded(device: DiscoveredPrinterRecord) {
    return existingPrinters.some((existing) => existing.ip === device.ip)
  }

  const available = discovered.filter((device) => !isAlreadyAdded(device))
  const showConfigure = form.tab === 'manual' || form.picked !== null

  function handleAdd() {
    if (!form.canAdd) return
    onAdd(form.buildEntry())
  }

  return (
    <Modal onClose={onClose} className="add-printer">
      <div className="modal-head">
        <h2>{t('header.add_printer')}</h2>
        <p>{t('add.subtitle')}</p>
      </div>

      <TabBar tab={form.tab} count={available.length} onSwitch={form.switchTab} />

      {form.tab === 'scan' && (
        <ScanBody
          scanning={form.scanning}
          discovered={discovered}
          picked={form.picked}
          nick={form.nick}
          adapterId={form.adapterId}
          isAlreadyAdded={isAlreadyAdded}
          onRescan={form.onRescan}
          onPick={form.setPicked}
          onNickChange={form.setNick}
          onAdapterChange={form.setAdapterId}
        />
      )}

      {form.tab === 'manual' && (
        <ManualBody
          manualIp={form.manualIp}
          nick={form.nick}
          adapterId={form.adapterId}
          onIpChange={form.setManualIp}
          onNickChange={form.setNick}
          onAdapterChange={form.setAdapterId}
        />
      )}

      {showConfigure && (
        <CustomCredentialsCheckbox checked={form.customSshCredentials} onChange={form.setCustomSshCredentials} />
      )}

      <AddPrinterFoot canAdd={form.canAdd} onClose={onClose} onAdd={handleAdd} />
    </Modal>
  )
}
