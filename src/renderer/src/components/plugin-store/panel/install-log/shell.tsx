// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ReactNode } from 'react'
import { useI18n } from '../../../../i18n/context'
import { Modal } from '../../../common/overlay/Modal'
import { Button } from '../../../common/Button'
import { IconClose } from '../../../../design-system/icons'

// Shared frame for the install-log modals (the structured report and the live run): the install-log
// modal with a titled head, plugin-name subtitle, and a ghost close button. The body is the children.
export function InstallLogShell({ title, pluginName, onClose, children }: {
  title: string; pluginName: string; onClose: () => void; children: ReactNode
}) {
  const { t } = useI18n()

  return (
    <Modal onClose={onClose} scrimClassName="modal-scrim install-log-scrim" className="install-log">
      <div className="modal-head">
        <div className="modal-title">
          <span>{title}</span>
          <span className="modal-subtitle">{pluginName}</span>
        </div>
        <Button variant="ghost" icon onClick={onClose} aria-label={t('install.log.close')}>
          <IconClose size={16} />
        </Button>
      </div>
      {children}
    </Modal>
  )
}
