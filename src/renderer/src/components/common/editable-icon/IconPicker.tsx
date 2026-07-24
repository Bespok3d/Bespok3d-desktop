import { useRef } from 'react'
import { Button } from '../Button'
import { HueRing } from './HueRing'

function parseHue(color: string | undefined): number {
  if (!color) return 235
  const match = color.match(/oklch\([^)]+\s+([\d.]+)\)/)

  return match ? parseFloat(match[1]) : 235
}

interface IconPickerProps {
  color?: string
  image?: string
  hasColor: boolean
  hasImage: boolean
  coords: { x: number; y: number }
  onColorChange?: (color: string | undefined) => void
  onImageChange?: (image: string | undefined) => void
}

export function IconPicker({ color, image, hasColor, hasImage, coords, onColorChange, onImageChange }: IconPickerProps) {
  const fileRef = useRef<HTMLInputElement>(null)

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => onImageChange?.(reader.result as string)
    reader.readAsDataURL(file)
    event.target.value = ''
  }

  return (
    <div
      className="ei-picker"
      style={{ position: 'fixed', top: coords.y, left: coords.x, zIndex: 100 }}
    >
      {hasColor && (
        <HueRing
          hue={parseHue(color)}
          onChange={(hue) => onColorChange?.(`oklch(55% 0.14 ${Math.round(hue)})`)}
        />
      )}
      {hasImage && (
        <div className="ei-picker-actions">
          <input ref={fileRef} type="file" className="u-hidden" onChange={handleFileChange} />
          {image ? (
            <Button variant="ghost" size="sm" onClick={() => onImageChange?.(undefined)}>
              ↺ Revert to icon
            </Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => fileRef.current?.click()}>
              Upload image
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
