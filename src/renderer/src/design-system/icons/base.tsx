// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { SVGProps, ReactNode } from 'react'

interface IconBaseProps extends SVGProps<SVGSVGElement> {
  size?: number
  children?: ReactNode
}

export type IconProps = Omit<IconBaseProps, 'children'>

export function Icon({
  size = 20,
  fill = 'none',
  stroke = 'currentColor',
  strokeWidth = 1.6,
  viewBox = '0 0 24 24',
  children,
  ...rest
}: IconBaseProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={viewBox}
      fill={fill}
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...rest}
    >
      {children}
    </svg>
  )
}
