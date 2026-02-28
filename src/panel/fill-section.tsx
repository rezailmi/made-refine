import * as React from 'react'
import type { ColorValue } from '../types'
import { formatColorValue } from '../ui/color-utils'
import { ColorPickerPopover, ColorPickerGroup } from '../ui/color-picker'
import { parseFillLayers, serializeFillLayers } from '../fill-utils'
import { CollapsibleSection, Tip } from './shared'
import { Button } from '../ui/button'
import {
  LocateFixed,
  Plus,
  Minus,
} from 'lucide-react'

interface ColorInputProps {
  id?: string
  value: ColorValue
  onChange: (value: ColorValue) => void
  className?: string
}

export function ColorInput({ id, value, onChange, className }: ColorInputProps) {
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
    <div className={className}>
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
  textColor: ColorValue
  borderColor?: ColorValue
  outlineColor?: ColorValue
  selectionColors?: ColorValue[]
  onSelectionColorChange?: (from: ColorValue, to: ColorValue) => void
  onSelectionColorTarget?: (color: ColorValue) => void
  onTextChange: (value: ColorValue) => void
  onBorderColorChange?: (value: ColorValue) => void
  onOutlineColorChange?: (value: ColorValue) => void
  hasTextContent: boolean
  showBorderColor?: boolean
  showOutlineColor?: boolean
}

export function FillSection({
  textColor,
  borderColor,
  outlineColor,
  selectionColors = [],
  onSelectionColorChange,
  onSelectionColorTarget,
  onTextChange,
  onBorderColorChange,
  onOutlineColorChange,
  hasTextContent,
  showBorderColor,
  showOutlineColor,
}: FillSectionProps) {
  const showDetectedColorInputs = selectionColors.length > 0 && onSelectionColorChange

  return (
    <ColorPickerGroup>
      <div className="space-y-2">
        {selectionColors.length > 0 && (
          <div className="space-y-2">
            <div className="space-y-2">
              {selectionColors.map((color, index) => (
                <div key={`${color.hex}-${color.alpha}-${index}`} className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <ColorInput
                      id={`selection-color-${index}`}
                      value={color}
                      onChange={(next) => onSelectionColorChange?.(color, next)}
                    />
                  </div>
                  {onSelectionColorTarget && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 shrink-0 text-muted-foreground"
                      onClick={() => onSelectionColorTarget(color)}
                      aria-label={`Select element with #${color.hex}`}
                      title={`Select element with #${color.hex}`}
                    >
                      <LocateFixed />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {!showDetectedColorInputs && hasTextContent && (
          <ColorInput
            id="fill-text"
            value={textColor}
            onChange={onTextChange}
          />
        )}

        {!showDetectedColorInputs && showBorderColor && borderColor && onBorderColorChange && (
          <ColorInput
            id="fill-border"
            value={borderColor}
            onChange={onBorderColorChange}
          />
        )}

        {!showDetectedColorInputs && showOutlineColor && outlineColor && onOutlineColorChange && (
          <ColorInput
            id="fill-outline"
            value={outlineColor}
            onChange={onOutlineColorChange}
          />
        )}
      </div>
    </ColorPickerGroup>
  )
}

const DEFAULT_FILL: ColorValue = { hex: 'DDDDDD', alpha: 100, raw: '#DDDDDD' }

interface BackgroundFillSectionProps {
  backgroundColor: ColorValue
  onSetCSS: (properties: Record<string, string>) => void
  pendingStyles: Record<string, string>
}

export function BackgroundFillSection({ backgroundColor, onSetCSS, pendingStyles }: BackgroundFillSectionProps) {
  const effectiveBgColor = pendingStyles['background-color'] ?? backgroundColor.raw
  const effectiveBgShorthand = pendingStyles['background'] ?? ''
  const parsedLayers = React.useMemo(
    () => parseFillLayers(effectiveBgColor, effectiveBgShorthand),
    [effectiveBgColor, effectiveBgShorthand],
  )
  const [layers, setLayers] = React.useState<ColorValue[]>(parsedLayers)
  const hasFill = layers.length > 0

  React.useEffect(() => {
    setLayers(parsedLayers)
  }, [parsedLayers])

  const commitLayers = (nextLayers: ColorValue[]) => {
    setLayers(nextLayers)
    const { properties } = serializeFillLayers(nextLayers)
    onSetCSS(properties)
  }

  const addLayer = () => {
    commitLayers([...layers, DEFAULT_FILL])
  }

  const removeLayer = (index: number) => {
    commitLayers(layers.filter((_, i) => i !== index))
  }

  const updateLayer = (index: number, color: ColorValue) => {
    commitLayers(layers.map((l, i) => (i === index ? color : l)))
  }

  const headerActions = (
    <div className="flex items-center gap-2">
      <Tip label={hasFill ? 'Add fill layer' : 'Add fill'}>
        <Button
          variant="ghost"
          size="icon"
          className="size-7 text-muted-foreground"
          onClick={addLayer}
        >
          <Plus />
        </Button>
      </Tip>
    </div>
  )

  return (
    <CollapsibleSection title="Fill" actions={headerActions}>
      {hasFill ? (
        <ColorPickerGroup>
          <div className="space-y-2">
            {layers.map((layer, index) => (
              <div key={`fill-layer-${index}`} className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <ColorInput
                    id={`fill-bg-${index}`}
                    value={layer}
                    onChange={(next) => updateLayer(index, next)}
                  />
                </div>
                <Tip label="Remove fill layer">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 shrink-0 text-muted-foreground"
                    onClick={() => removeLayer(index)}
                  >
                    <Minus />
                  </Button>
                </Tip>
              </div>
            ))}
          </div>
        </ColorPickerGroup>
      ) : null}
    </CollapsibleSection>
  )
}
