// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { IconProps } from '../../../design-system/icons'

interface IconBodyProps {
  size: number
  color: string
  image?: string
  fallbackImage?: string
  DefaultIcon: React.ComponentType<IconProps>
}

// The colour is always painted behind the artwork so a transparent PNG/WebP/SVG shows the chosen
// background through its see-through pixels. `image` is the user's own picture; `fallbackImage` is the
// adapter-declared default, shown when the user has not set one (and "Revert to icon" falls back to it).
export function IconBody({ size, color, image, fallbackImage, DefaultIcon }: IconBodyProps) {
  const artwork = image ?? fallbackImage

  return (
    <div
      className="ei-body"
      style={{
        width: size,
        height: size,
        background: color,
        overflow: 'hidden',
        transition: 'width 120ms, height 120ms',
      }}
    >
      {artwork ? (
        <img src={artwork} className="ei-body-img" />
      ) : (
        <DefaultIcon size={Math.round(size * 0.55)} className="ei-default-glyph" />
      )}
    </div>
  )
}
