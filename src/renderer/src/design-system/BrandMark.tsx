// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { CSSProperties } from 'react'

export type BrandMarkVariant = 'package' | 'file' | 'proto'

interface Props {
  variant?: BrandMarkVariant
  tile?: number
}

function ringForTile(tile: number): string {
  if (tile <= 24) return '1.5px'
  if (tile <= 40) return '2px'
  if (tile <= 60) return '3px'

  return '4px'
}

export function BrandMark({ variant, tile }: Props) {
  const style =
    tile !== undefined
      ? ({ '--tile': `${tile}px`, '--ring': ringForTile(tile) } as CSSProperties)
      : undefined

  return (
    <span className="b3mark" data-variant={variant} style={style}>
      <span className="bee">b</span>
      <span className="three">3</span>
    </span>
  )
}
