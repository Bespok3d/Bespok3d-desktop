// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import cx from '../../utils/cx'
import type { Printer } from '../../data/types'
import { IconPrinter } from '../../design-system/icons'
import { DEFAULT_ICON_COLOR } from '../common/editable-icon'
import './header.css'

// The read-only printer avatar in the header dropdown. Mirrors the editable settings avatar: the user's
// own picture wins, otherwise the adapter-declared icon, otherwise the generic glyph. Any picture sits on
// the printer's chosen colour so a transparent icon shows the colour through.
export function PrinterAvatar({ printer, adapterIcon, dotClass, dotTitle }: {
  printer: Printer
  adapterIcon?: string
  dotClass: string
  dotTitle?: string
}) {
  const artwork = printer.iconImage ?? adapterIcon

  return (
    <div className="printer-avatar" style={artwork ? { background: printer.iconColor ?? DEFAULT_ICON_COLOR } : undefined}>
      {artwork ? <img className="printer-avatar-img" src={artwork} alt="" /> : <IconPrinter />}
      <span
        className={cx('status-dot', dotClass, 'avatar-status-dot')}
        title={dotTitle}
      />
    </div>
  )
}
