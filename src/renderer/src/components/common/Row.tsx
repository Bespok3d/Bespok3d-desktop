// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import cx from '../../utils/cx'
import './row.css'

interface RowProps {
  icon: React.ReactNode
  children: React.ReactNode
  controls?: React.ReactNode
  className?: string
}

export function Row({ icon, children, controls, className }: RowProps) {
  return (
    <div className={cx('set-row', className)}>
      {icon}
      <div className="set-row-text">{children}</div>
      {controls && <div className="set-row-control">{controls}</div>}
    </div>
  )
}
