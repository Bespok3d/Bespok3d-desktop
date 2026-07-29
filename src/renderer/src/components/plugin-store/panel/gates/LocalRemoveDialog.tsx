// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useI18n } from '../../../../i18n/context'
import { Explainer } from '../../../common/content/Explainer'
import { Button } from '../../../common/Button'
import { Modal } from '../../../common/overlay/Modal'

export interface LocalRemoveContext {
  printers: { id: string; nick: string }[]
  hasOtherSource: boolean
}

// The explained, multi-action removal of a sideloaded package. When it is installed on printer(s) the
// user decides whether to also uninstall it there; the Explainer spells out the consequence of keeping
// it (switch to another source if one exists, else uninstall-only).
export function LocalRemoveDialog({ pluginTitle, context, onRemove, onCancel }: {
  pluginTitle: string
  context: LocalRemoveContext
  onRemove: (uninstallFrom: string[]) => void
  onCancel: () => void
}) {
  const { t } = useI18n()
  const installed = context.printers.length > 0
  const printerIds = context.printers.map((printer) => printer.id)
  const printerNames = context.printers.map((printer) => printer.nick).join(', ')
  const keepDetail = context.hasOtherSource ? t('store.local_remove.keep_switch') : t('store.local_remove.keep_orphan')

  return (
    <Modal onClose={onCancel}>
      <div className="modal-head">
        <h2 className="dialog-title">
          {t('store.local_remove.title', { plugin: pluginTitle })}
        </h2>
        {installed && (
          <p className="dialog-subtitle">
            <Explainer brief={t('store.local_remove.installed_on', { printers: printerNames })} detail={keepDetail} />
          </p>
        )}
      </div>
      <div className="dialog-body snug">
        {installed ? (
          <>
            <Button variant="outline" size="sm" onClick={() => onRemove([])}>{t('store.local_remove.keep')}</Button>
            <Button variant="danger" size="sm" onClick={() => onRemove(printerIds)}>{t('store.local_remove.remove_all')}</Button>
            <Button variant="ghost" size="sm" onClick={onCancel}>{t('btn.cancel')}</Button>
          </>
        ) : (
          <div className="dialog-actions">
            <Button variant="outline" size="sm" onClick={onCancel}>{t('btn.cancel')}</Button>
            <Button variant="danger" size="sm" onClick={() => onRemove([])}>{t('btn.remove')}</Button>
          </div>
        )}
      </div>
    </Modal>
  )
}
