import { useState } from 'react'
import { IconPencil } from '../../../design-system/icons'
import type { IconProps } from '../../../design-system/icons'
import { usePickerBehavior } from './usePickerBehavior'
import { IconBody } from './IconBody'
import { IconPicker } from './IconPicker'
import './editable-icon.css'

export type EditableIconFeature = 'zoom' | 'color' | 'image'

export const DEFAULT_ICON_COLOR = 'oklch(55% 0.14 235)'

interface EditableIconProps {
  defaultIcon: React.ComponentType<IconProps>
  color?: string
  image?: string
  fallbackImage?: string
  features?: EditableIconFeature[]
  size?: number
  minSize?: number
  maxSize?: number
  sizeStep?: number
  onColorChange?: (color: string | undefined) => void
  onImageChange?: (image: string | undefined) => void
  onSizeChange?: (size: number) => void
}

export function EditableIcon({
  defaultIcon: DefaultIcon,
  color,
  image,
  fallbackImage,
  features = ['zoom', 'color', 'image'],
  minSize = 32,
  maxSize = 80,
  sizeStep = 12,
  size,
  onColorChange,
  onImageChange,
  onSizeChange,
}: EditableIconProps) {
  const [open, setOpen] = useState(false)
  const [localSize, setLocalSize] = useState(size ?? minSize)
  const { pickerCoords, wrapRef } = usePickerBehavior(open, setOpen)

  const hasZoom = features.includes('zoom')
  const hasColor = features.includes('color')
  const hasImage = features.includes('image')
  const hasPicker = hasColor || hasImage
  const iconColor = color ?? DEFAULT_ICON_COLOR

  function updateSize(delta: number) {
    const next = Math.max(minSize, Math.min(maxSize, localSize + delta))
    setLocalSize(next)
    onSizeChange?.(next)
  }

  return (
    <div ref={wrapRef} className="ei-wrap">
      {hasZoom && (
        <button className="ei-btn ei-plus" disabled={localSize >= maxSize} onClick={() => updateSize(sizeStep)}>
          +
        </button>
      )}
      {hasZoom && (
        <button className="ei-btn ei-minus" disabled={localSize <= minSize} onClick={() => updateSize(-sizeStep)}>
          −
        </button>
      )}

      <IconBody size={localSize} color={iconColor} image={image} fallbackImage={fallbackImage} DefaultIcon={DefaultIcon} />

      {hasPicker && (
        <button className="ei-btn ei-pencil" title={open ? 'Close' : 'Customise'} onClick={() => setOpen((prev) => !prev)}>
          <IconPencil size={10} />
        </button>
      )}

      {open && (
        <IconPicker
          color={color}
          image={image}
          hasColor={hasColor}
          hasImage={hasImage}
          coords={pickerCoords}
          onColorChange={onColorChange}
          onImageChange={onImageChange}
        />
      )}
    </div>
  )
}
