// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import cx from '../../utils/cx'

interface SegmentedOption<T> {
  value: T
  label: React.ReactNode
  icon?: React.ReactNode
  // A choice that cannot be made right now (the caller explains why nearby); it stays visible so
  // the control never silently changes shape.
  disabled?: boolean
}

// A single-choice control: a row of mutually-exclusive segments, one active. Labels/icons are passed
// in (the caller localizes), so this primitive holds no text of its own.
export function Segmented<T extends string>({ value, options, onChange }: {
  value: T
  options: SegmentedOption<T>[]
  onChange: (selected: T) => void
}) {
  return (
    <div className="segmented">
      {options.map((option) => (
        <button key={option.value} className={cx('seg', value === option.value && 'active')} disabled={option.disabled} onClick={() => onChange(option.value)}>
          {option.icon} {option.label}
        </button>
      ))}
    </div>
  )
}
