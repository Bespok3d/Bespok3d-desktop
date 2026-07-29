// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ReactNode } from 'react'
import { useI18n } from '../../../i18n/context'
import type { Printer } from '../../../data/types'

// The printer's name + meta identity, shared by the closed trigger and each open menu row so the two
// never drift. `nameExtra` rides the name line (e.g. update badges on the trigger); `metaExtra` rides
// the meta line (e.g. the installing hint). The row adds its own interfaces/versions lines below this.
export function PrinterIdentity({ printer, nameExtra, metaExtra }: { printer: Printer; nameExtra?: ReactNode; metaExtra?: ReactNode }) {
  const { t } = useI18n()

  return (
    <>
      <div className="printer-name">
        <span className="nick">{printer.nick}</span>
        <span className="model">· {printer.model}</span>
        {nameExtra}
      </div>
      <div className="printer-meta">
        <span>{printer.ip}</span>
        <span>·</span>
        <span>{t('header.installed_count', { count: printer.installedIds.length })}</span>
        {metaExtra}
      </div>
    </>
  )
}
