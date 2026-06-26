import * as React from 'react'
import type { ColorValue } from '../types'
import { formatColorValue } from '../ui/color-utils'
import { ColorPickerPopover, ColorPickerGroup } from '../ui/color-picker'
import { parseFillLayers, serializeFillLayers } from '../fill-utils'
import { CollapsibleSection, Tip, useEchoGuardedInput } from './shared'
import { Button } from '../ui/button'
import { LocateFixed, Plus, Minus } from 'lucide-react'
import { TokenChip } from './token-chip'
import {
  getColorTokenIndex,
  resolveColorToken,
  getTokenAliasChain,
} from '../utils/design-tokens'

const MAX_LAYER_COUNT = 16

interface ColorInputProps {
  id?: string
  value: ColorValue
  onChange: (value: ColorValue) => void
  className?: string
  /** Bound CSS variable name (e.g. '--color-primary'); when set, shows a token chip. */
  token?: string | null
  /** Ordered alias chain for the popover, from getTokenAliasChain(). */
  aliasChain?: string[]
}

export function ColorInput({ id, value, onChange, className, token, aliasChain }: ColorInputProps) {
  const hex = useEchoGuardedInput(value.hex)
  const alpha = useEchoGuardedInput(value.alpha.toString())

  const handleHexChange = (newHex: string) => {
    // Remove # if present and convert to uppercase
    const cleaned = newHex.replace('#', '').toUpperCase()
    hex.setLocalValue(cleaned)

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
    alpha.setLocalValue(newAlpha)

    const numAlpha = parseInt(newAlpha)
    if (!isNaN(numAlpha) && numAlpha >= 0 && numAlpha <= 100) {
      onChange({
        hex: value.hex,
        alpha: numAlpha,
        raw: formatColorValue({ hex: value.hex, alpha: numAlpha, raw: '' }),
      })
    }
  }

  const hexAlphaInputs = (
    <>
      {/* Hex input */}
      <input
        type="text"
        value={hex.localValue}
        onChange={(e) => handleHexChange(e.target.value)}
        onFocus={hex.handleFocus}
        onBlur={hex.handleBlur}
        className="h-full w-[68px] bg-transparent px-2 font-mono text-xs uppercase outline-none"
        maxLength={6}
        placeholder="FFFFFF"
      />

      {/* Separator */}
      <span className="text-xs text-muted-foreground">/</span>

      {/* Opacity input */}
      <input
        type="number"
        value={alpha.localValue}
        onChange={(e) => handleAlphaChange(e.target.value)}
        onFocus={alpha.handleFocus}
        onBlur={alpha.handleBlur}
        className="h-full w-10 bg-transparent px-1 text-center text-xs tabular-nums outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [appearance:textfield]"
        min={0}
        max={100}
      />
      <span className="pr-2 text-xs text-muted-foreground">%</span>
    </>
  )

  // No bound token: render exactly today's row.
  if (!token) {
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
          {hexAlphaInputs}
        </div>
      </div>
    )
  }

  // Token mode: swatch still opens the HSV picker; chip shows the bound variable
  // and opens a popover with the alias chain + the same hex/alpha editors.
  return (
    <div className={className}>
      <div className="flex items-center gap-1">
        <ColorPickerPopover id={id} value={value} onChange={onChange}>
          <div
            className="size-5 shrink-0 cursor-pointer rounded-sm shadow-[inset_0_0_0_1px_rgba(0,0,0,0.1)]"
            style={{ backgroundColor: `#${value.hex}` }}
          />
        </ColorPickerPopover>
        <TokenChip label={token} swatchHex={value.hex}>
          <div className="space-y-2">
            {aliasChain && aliasChain.length > 1 && (
              <div className="font-mono text-muted-foreground">
                {aliasChain.join(' → ')}
              </div>
            )}
            <div className="flex h-7 items-center rounded-md border-0 bg-muted">
              {hexAlphaInputs}
            </div>
          </div>
        </TokenChip>
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
  classList?: string[]
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
  classList,
}: FillSectionProps) {
  const showDetectedColorInputs = selectionColors.length > 0 && onSelectionColorChange

  const index = getColorTokenIndex()
  const tokenFor = (cssProperty: string, value: ColorValue) => {
    const name = classList ? resolveColorToken(cssProperty, classList, value, index) : null
    return name
      ? { token: name, aliasChain: getTokenAliasChain(name) }
      : { token: null, aliasChain: undefined }
  }

  return (
    <ColorPickerGroup>
      <div className="space-y-2">
        {selectionColors.length > 0 && (
          <div className="space-y-2">
            <div className="space-y-2">
              {selectionColors.map((color, index) => (
                <div
                  key={`${color.hex}-${color.alpha}-${index}`}
                  className="flex items-center gap-2"
                >
                  <div className="min-w-0 flex-1">
                    <ColorInput
                      id={`selection-color-${index}`}
                      value={color}
                      onChange={(next) => onSelectionColorChange?.(color, next)}
                      {...tokenFor('', color)}
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
            {...tokenFor('color', textColor)}
          />
        )}

        {!showDetectedColorInputs && showBorderColor && borderColor && onBorderColorChange && (
          <ColorInput
            id="fill-border"
            value={borderColor}
            onChange={onBorderColorChange}
            {...tokenFor('border-color', borderColor)}
          />
        )}

        {!showDetectedColorInputs && showOutlineColor && outlineColor && onOutlineColorChange && (
          <ColorInput
            id="fill-outline"
            value={outlineColor}
            onChange={onOutlineColorChange}
            {...tokenFor('outline-color', outlineColor)}
          />
        )}
      </div>
    </ColorPickerGroup>
  )
}

const DEFAULT_FILL: ColorValue = { hex: 'DDDDDD', alpha: 100, raw: '#DDDDDD' }

interface BackgroundFillSectionProps {
  backgroundColor: ColorValue
  onSetCSS?: (properties: Record<string, string>) => void
  onCommitFillLayers?: (layers: ColorValue[]) => void
  pendingStyles: Record<string, string>
  classList?: string[]
}

export function BackgroundFillSection({
  backgroundColor,
  onSetCSS,
  onCommitFillLayers,
  pendingStyles,
  classList,
}: BackgroundFillSectionProps) {
  const effectiveBgColor = pendingStyles['background-color'] ?? backgroundColor.raw
  const effectiveBgShorthand = pendingStyles['background'] ?? ''
  const parsedLayers = React.useMemo(
    () => parseFillLayers(effectiveBgColor, effectiveBgShorthand),
    [effectiveBgColor, effectiveBgShorthand]
  )
  const [layers, setLayers] = React.useState<ColorValue[]>(parsedLayers)
  const hasFill = layers.length > 0
  const committedRef = React.useRef<string | null>(null)

  React.useEffect(() => {
    const incoming = JSON.stringify(parsedLayers)
    if (committedRef.current === null) {
      setLayers(parsedLayers)
    } else if (committedRef.current === incoming) {
      committedRef.current = null
      setLayers(parsedLayers)
    }
  }, [parsedLayers])

  const commitLayers = (nextLayers: ColorValue[]) => {
    committedRef.current = JSON.stringify(nextLayers)
    setLayers(nextLayers)
    if (onCommitFillLayers) {
      onCommitFillLayers(nextLayers)
    } else if (onSetCSS) {
      const { properties } = serializeFillLayers(nextLayers)
      onSetCSS(properties)
    }
  }

  const atLayerCap = layers.length >= MAX_LAYER_COUNT

  // Only a single solid fill layer maps cleanly to one background-color token.
  const singleLayerToken =
    classList && layers.length === 1
      ? resolveColorToken('background-color', classList, layers[0], getColorTokenIndex())
      : null
  const singleLayerAliasChain = singleLayerToken ? getTokenAliasChain(singleLayerToken) : undefined

  const addLayer = () => {
    if (atLayerCap) return
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
      <Tip
        label={
          atLayerCap ? `Maximum ${MAX_LAYER_COUNT} layers` : hasFill ? 'Add fill layer' : 'Add fill'
        }
      >
        <Button
          variant="ghost"
          size="icon"
          className="size-7 text-muted-foreground"
          onClick={addLayer}
          disabled={atLayerCap}
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
                    token={layers.length === 1 ? singleLayerToken : null}
                    aliasChain={layers.length === 1 ? singleLayerAliasChain : undefined}
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
