// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import cx from '../../utils/cx'
import './toggle.css'

interface ToggleProps {
  on: boolean
  onChange: (on: boolean) => void
  disabled?: boolean
  ariaLabel?: string
}

export function Toggle({ on, onChange, disabled, ariaLabel }: ToggleProps) {
  return (
    <button className={cx('toggle', on && 'on', disabled && 'disabled')} disabled={disabled} onClick={() => onChange(!on)} role="switch" aria-checked={on} aria-label={ariaLabel}>
      <span className="toggle-thumb" />
    </button>
  )
}
