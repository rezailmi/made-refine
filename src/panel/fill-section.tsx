import * as React from 'react'
import type { ColorValue } from '../types'
import { formatColorValue } from '../ui/color-utils'
import { ColorPickerPopover, ColorPickerGroup } from '../ui/color-picker'
import {
  Paintbrush,
  Square,
  Focus,
  Type,
  LocateFixed,
} from 'lucide-react'

interface ColorInputProps {
  id?: string
  label: string
  icon: React.ReactNode
  value: ColorValue
  onChange: (value: ColorValue) => void
}

export function ColorInput({ id, label, icon, value, onChange }: ColorInputProps) {
  const [hexInput, setHexInput] = React.useState(value.hex)
  const [alphaInput, setAlphaInput] = React.useState(value.alpha.toString())

  // Sync internal state when value changes externally
  React.useEffect(() => {
    setHexInput(value.hex)
    setAlphaInput(value.alpha.toString())
  }, [value.hex, value.alpha])

  const handleHexChange = (newHex: string) => {
    // Remove # if present and convert to uppercase
    const cleaned = newHex.replace('#', '').toUpperCase()
    setHexInput(cleaned)

    // Only update if valid 6-character hex
    if (/^[0-9A-F]{6}$/.test(cleaned)) {
      onChange({
        hex: cleaned,
        alpha: value.alpha,
        raw: formatColorValue({ hex: cleaned, alpha: value.alpha, raw: '' }),
      })
    }
  }

  const handleAlphaChange = (newAlpha: string) => {
    setAlphaInput(newAlpha)

    const numAlpha = parseInt(newAlpha)
    if (!isNaN(numAlpha) && numAlpha >= 0 && numAlpha <= 100) {
      onChange({
        hex: value.hex,
        alpha: numAlpha,
        raw: formatColorValue({ hex: value.hex, alpha: numAlpha, raw: '' }),
      })
    }
  }

  return (
    <div>
      <div className="flex h-7 items-center rounded-md border-0 bg-muted">
        {/* Color swatch with popover picker */}
        <div className="ml-1">
          <ColorPickerPopover id={id} value={value} onChange={onChange}>
            <div
              className="size-5 cursor-pointer rounded-sm shadow-[inset_0_0_0_1px_rgba(0,0,0,0.1)]"
              style={{ backgroundColor: `#${value.hex}` }}
            />
          </ColorPickerPopover>
        </div>

        {/* Hex input */}
        <input
          type="text"
          value={hexInput}
          onChange={(e) => handleHexChange(e.target.value)}
          onBlur={() => setHexInput(value.hex)}
          className="h-full w-[68px] bg-transparent px-2 font-mono text-xs uppercase outline-none"
          maxLength={6}
          placeholder="FFFFFF"
        />

        {/* Separator */}
        <span className="text-xs text-muted-foreground">/</span>

        {/* Opacity input */}
        <input
          type="number"
          value={alphaInput}
          onChange={(e) => handleAlphaChange(e.target.value)}
          onBlur={() => setAlphaInput(value.alpha.toString())}
          className="h-full w-10 bg-transparent px-1 text-center text-xs tabular-nums outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [appearance:textfield]"
          min={0}
          max={100}
        />
        <span className="pr-2 text-xs text-muted-foreground">%</span>
      </div>
    </div>
  )
}

interface FillSectionProps {
  backgroundColor: ColorValue
  textColor: ColorValue
  borderColor?: ColorValue
  outlineColor?: ColorValue
  selectionColors?: ColorValue[]
  onSelectionColorChange?: (from: ColorValue, to: ColorValue) => void
  onSelectionColorTarget?: (color: ColorValue) => void
  onBackgroundChange: (value: ColorValue) => void
  onTextChange: (value: ColorValue) => void
  onBorderColorChange?: (value: ColorValue) => void
  onOutlineColorChange?: (value: ColorValue) => void
  hasTextContent: boolean
  showBackgroundColor?: boolean
  showBorderColor?: boolean
  showOutlineColor?: boolean
}

export function FillSection({
  backgroundColor,
  textColor,
  borderColor,
  outlineColor,
  selectionColors = [],
  onSelectionColorChange,
  onSelectionColorTarget,
  onBackgroundChange,
  onTextChange,
  onBorderColorChange,
  onOutlineColorChange,
  hasTextContent,
  showBackgroundColor,
  showBorderColor,
  showOutlineColor,
}: FillSectionProps) {
  const showDetectedColorInputs = selectionColors.length > 0 && onSelectionColorChange

  return (
    <ColorPickerGroup>
      <div className="space-y-3">
        {selectionColors.length > 0 && (
          <div className="space-y-2">
            <div className="space-y-2">
              {selectionColors.map((color, index) => (
                <div key={`${color.hex}-${color.alpha}-${index}`} className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <ColorInput
                      id={`selection-color-${index}`}
                      label={`Selection color ${index + 1}`}
                      icon={<Paintbrush className="size-3.5" />}
                      value={color}
                      onChange={(next) => onSelectionColorChange?.(color, next)}
                    />
                  </div>
                  {onSelectionColorTarget && (
                    <button
                      type="button"
                      className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      onClick={() => onSelectionColorTarget(color)}
                      aria-label={`Select element with #${color.hex}`}
                      title={`Select element with #${color.hex}`}
                    >
                      <LocateFixed className="size-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {!showDetectedColorInputs && showBackgroundColor && (
          <ColorInput
            id="fill-bg"
            label="Fill"
            icon={<Paintbrush className="size-3.5" />}
            value={backgroundColor}
            onChange={onBackgroundChange}
          />
        )}

        {!showDetectedColorInputs && hasTextContent && (
          <ColorInput
            id="fill-text"
            label="Text"
            icon={<Type className="size-3.5" />}
            value={textColor}
            onChange={onTextChange}
          />
        )}

        {!showDetectedColorInputs && showBorderColor && borderColor && onBorderColorChange && (
          <ColorInput
            id="fill-border"
            label="Border"
            icon={<Square className="size-3.5" />}
            value={borderColor}
            onChange={onBorderColorChange}
          />
        )}

        {!showDetectedColorInputs && showOutlineColor && outlineColor && onOutlineColorChange && (
          <ColorInput
            id="fill-outline"
            label="Outline"
            icon={<Focus className="size-3.5" />}
            value={outlineColor}
            onChange={onOutlineColorChange}
          />
        )}
      </div>
    </ColorPickerGroup>
  )
}
