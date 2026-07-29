// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ButtonHTMLAttributes } from 'react'
import cx from '../../utils/cx'

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'danger-outline'
export type ButtonSize = 'sm' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: boolean
  busy?: boolean
}

export function Button({ variant, size, icon, busy, disabled, className, children, ...rest }: ButtonProps) {
  return (
    <button
      className={cx('btn', variant, size, icon && 'icon', busy && 'refreshing', className)}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      {...rest}
    >
      {children}
    </button>
  )
}
