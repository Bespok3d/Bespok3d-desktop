// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import cx from '../../utils/cx'

interface SettingRowProps {
  label: React.ReactNode
  hint?: React.ReactNode
  controls?: React.ReactNode
  // Extra set-row modifiers (e.g. 'vertical'). Unlike common/Row this carries no icon column; it is
  // the labelled settings row: a label + optional hint on the left, optional controls on the right.
  className?: string
}

export function SettingRow({ label, hint, controls, className }: SettingRowProps) {
  return (
    <div className={cx('set-row', className)}>
      <div className="set-row-text">
        <div className="set-row-label">{label}</div>
        {hint && <div className="set-row-hint">{hint}</div>}
      </div>
      {controls && <div className="set-row-control">{controls}</div>}
    </div>
  )
}
