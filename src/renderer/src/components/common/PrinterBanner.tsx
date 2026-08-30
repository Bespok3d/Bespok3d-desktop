// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ReactNode } from 'react'
import { Button } from './Button'
import './printer-banner.css'

// The one bar across the top of the window that tells the user something about the selected printer
// and, when there is something to press, gives them the one button that answers it. The sentence and
// the button are the caller's: what warrants a bar is not this file's business.
export function PrinterBanner({ message, actionLabel, onAction }: { message: ReactNode; actionLabel?: string; onAction?: () => void }) {
  return (
    <div className="printer-banner">
      <span className="printer-banner-msg">{message}</span>
      {actionLabel && onAction && <Button size="sm" className="printer-banner-action" onClick={onAction}>{actionLabel}</Button>}
    </div>
  )
}
