import * as React from 'react'
import {
  SelectTrigger,
  SelectIcon,
} from '../ui/select'
import { SimpleSelect } from '../ui/simple-select'
import { cn } from '../cn'
import type { BorderPropertyKey, BorderProperties, BorderStyle, CSSPropertyValue, ColorValue, BorderStyleControlPreference } from '../types'
import { ColorPickerGroup } from '../ui/color-picker'
import { NumberInput, Tip, CollapsibleSection } from './shared'
import { ColorInput } from './fill-section'
import { Button } from '../ui/button'
import {
  ChevronDown,
  Square,
  Settings2,
  Grid2x2,
  Plus,
  Minus,
} from 'lucide-react'

export const BORDER_STYLE_OPTIONS: Array<{ value: BorderStyle; label: string }> = [
  { value: 'solid', label: 'Solid' },
  { value: 'dashed', label: 'Dashed' },
  { value: 'dotted', label: 'Dotted' },
]

export type BorderPosition = 'border' | 'outline'
export const BORDER_POSITION_OPTIONS: Array<{ value: BorderPosition; label: string }> = [
  { value: 'border', label: 'Border' },
  { value: 'outline', label: 'Outline' },
]

export const BORDER_SIDES = ['Top', 'Right', 'Bottom', 'Left'] as const

export const BORDER_SIDE_OPTIONS = ['All', 'Top', 'Right', 'Bottom', 'Left', 'Custom'] as const
export type BorderSideOption = typeof BORDER_SIDE_OPTIONS[number]

export function BorderSideIcon({ side, className }: { side: 'Top' | 'Right' | 'Bottom' | 'Left'; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={cn('size-3', className)}>
      {/* Top */}
      <line x1="3" y1="3" x2="21" y2="3"
        stroke="currentColor"
        strokeWidth={side === 'Top' ? 2.5 : 1.5}
        strokeDasharray={side === 'Top' ? 'none' : '3 2'}
        strokeOpacity={side === 'Top' ? 1 : 0.35}
      />
      {/* Right */}
      <line x1="21" y1="3" x2="21" y2="21"
        stroke="currentColor"
        strokeWidth={side === 'Right' ? 2.5 : 1.5}
        strokeDasharray={side === 'Right' ? 'none' : '3 2'}
        strokeOpacity={side === 'Right' ? 1 : 0.35}
      />
      {/* Bottom */}
      <line x1="3" y1="21" x2="21" y2="21"
        stroke="currentColor"
        strokeWidth={side === 'Bottom' ? 2.5 : 1.5}
        strokeDasharray={side === 'Bottom' ? 'none' : '3 2'}
        strokeOpacity={side === 'Bottom' ? 1 : 0.35}
      />
      {/* Left */}
      <line x1="3" y1="3" x2="3" y2="21"
        stroke="currentColor"
        strokeWidth={side === 'Left' ? 2.5 : 1.5}
        strokeDasharray={side === 'Left' ? 'none' : '3 2'}
        strokeOpacity={side === 'Left' ? 1 : 0.35}
      />
    </svg>
  )
}

interface BorderInputsProps {
  border: BorderProperties
  borderColor?: ColorValue
  outlineColor?: ColorValue
  onChange: (key: BorderPropertyKey, value: BorderProperties[BorderPropertyKey]) => void
  onBatchChange: (changes: Array<[BorderPropertyKey, BorderProperties[BorderPropertyKey]]>) => void
  onBorderColorChange?: (value: ColorValue) => void
  onOutlineColorChange?: (value: ColorValue) => void
  onSetCSS?: (properties: Record<string, string>) => void
  borderPosition: BorderPosition
  borderStyleControlPreference: BorderStyleControlPreference
  onPositionChange: (position: BorderPosition) => void
  outlineStyle?: BorderStyle
  outlineWidth?: number
}

export function BorderInputs({ border, borderColor, outlineColor, onChange, onBatchChange, onBorderColorChange, onOutlineColorChange, onSetCSS, borderPosition, borderStyleControlPreference, onPositionChange, outlineStyle, outlineWidth }: BorderInputsProps) {
  const [selectedSide, setSelectedSide] = React.useState<BorderSideOption>('All')

  const isOutline = borderPosition === 'outline'

  const activeSides = selectedSide === 'All' || selectedSide === 'Custom'
    ? BORDER_SIDES
    : [selectedSide] as const

  const stylesMatch = activeSides.every(
    (s) => (border[`border${s}Style` as keyof BorderProperties] as BorderStyle) === (border[`border${activeSides[0]}Style` as keyof BorderProperties] as BorderStyle),
  )
  const widthsMatch = activeSides.every((s) => {
    const w = border[`border${s}Width` as keyof BorderProperties] as CSSPropertyValue
    const first = border[`border${activeSides[0]}Width` as keyof BorderProperties] as CSSPropertyValue
    return w.numericValue === first.numericValue
  })

  const currentStyle = isOutline
    ? (outlineStyle || 'solid')
    : (stylesMatch ? (border[`border${activeSides[0]}Style` as keyof BorderProperties] as BorderStyle) || 'solid' : 'solid')
  const currentWidth = isOutline
    ? (outlineWidth ?? 0)
    : (widthsMatch ? (border[`border${activeSides[0]}Width` as keyof BorderProperties] as CSSPropertyValue)?.numericValue ?? 0 : null)

  const handleStyleChange = (style: BorderStyle) => {
    if (isOutline && onSetCSS) {
      const props: Record<string, string> = { 'outline-style': style }
      if ((outlineWidth ?? 0) <= 0) {
        props['outline-width'] = '1px'
      }
      onSetCSS(props)
      return
    }
    const changes: Array<[BorderPropertyKey, BorderProperties[BorderPropertyKey]]> = []
    for (const s of activeSides) {
      const w = border[`border${s}Width` as keyof BorderProperties] as CSSPropertyValue
      if (w.numericValue <= 0) {
        changes.push([`border${s}Width` as BorderPropertyKey, { numericValue: 1, unit: 'px', raw: '1px' }])
      }
      changes.push([`border${s}Style` as BorderPropertyKey, style])
    }
    onBatchChange(changes)
  }

  const handleAllWidthChange = (numericValue: number) => {
    const clamped = Math.max(0, numericValue)
    if (isOutline && onSetCSS) {
      onSetCSS({ 'outline-width': `${clamped}px` })
      return
    }
    const value: CSSPropertyValue = { numericValue: clamped, unit: 'px', raw: `${clamped}px` }
    const changes: Array<[BorderPropertyKey, BorderProperties[BorderPropertyKey]]> = []
    for (const s of activeSides) {
      changes.push([`border${s}Width` as BorderPropertyKey, value])
    }
    onBatchChange(changes)
  }

  const handleSideChange = (newSide: BorderSideOption) => {
    setSelectedSide(newSide)

    if (newSide === 'Custom') return

    if (newSide === 'All') {
      // Set all sides to the max width across all sides
      const maxWidth = Math.max(
        ...BORDER_SIDES.map((s) => (border[`border${s}Width` as keyof BorderProperties] as CSSPropertyValue).numericValue),
      )
      const value: CSSPropertyValue = { numericValue: maxWidth, unit: 'px', raw: `${maxWidth}px` }
      const changes: Array<[BorderPropertyKey, BorderProperties[BorderPropertyKey]]> = []
      for (const s of BORDER_SIDES) {
        changes.push([`border${s}Width` as BorderPropertyKey, value])
      }
      onBatchChange(changes)
      return
    }

    // Specific side: set that side to currentWidth, zero out the rest
    const sideWidth = (border[`border${newSide}Width` as keyof BorderProperties] as CSSPropertyValue).numericValue
    const width = currentWidth ?? sideWidth ?? 1
    const changes: Array<[BorderPropertyKey, BorderProperties[BorderPropertyKey]]> = []
    for (const s of BORDER_SIDES) {
      const value: CSSPropertyValue = s === newSide
        ? { numericValue: width, unit: 'px', raw: `${width}px` }
        : { numericValue: 0, unit: 'px', raw: '0px' }
      changes.push([`border${s}Width` as BorderPropertyKey, value])
    }
    onBatchChange(changes)
  }

  const handleSideWidthChange = (side: string, numericValue: number) => {
    const clamped = Math.max(0, numericValue)
    onChange(`border${side}Width` as BorderPropertyKey, {
      numericValue: clamped,
      unit: 'px',
      raw: `${clamped}px`,
    })
  }

  const activeColor = isOutline ? outlineColor : borderColor
  const activeColorChange = isOutline ? onOutlineColorChange : onBorderColorChange
  const currentStyleLabel = BORDER_STYLE_OPTIONS.find((o) => o.value === currentStyle)?.label ?? currentStyle

  return (
    <div className="space-y-2">
      {/* Row 1: Position + Style + Width + Side */}
      <div className="flex items-center gap-2">
        <SimpleSelect
          value={borderPosition}
          onValueChange={(val) => onPositionChange(val as BorderPosition)}
          options={BORDER_POSITION_OPTIONS}
          triggerClassName="min-w-0 flex-1"
        />

        <Tip label={isOutline ? 'Outline width' : 'Border width'}>
          <div className={cn(borderStyleControlPreference === 'icon' && 'min-w-0 flex-1')}>
            <NumberInput
              min={0}
              step={0.5}
              value={typeof currentWidth === 'number' ? Math.round(currentWidth * 100) / 100 : null}
              placeholder={currentWidth === null ? 'mixed' : undefined}
              onValueChange={handleAllWidthChange}
              className={cn(
                'h-7 px-2 text-center text-xs tabular-nums',
                borderStyleControlPreference === 'icon' ? 'w-full' : 'w-11',
              )}
            />
          </div>
        </Tip>

        <SimpleSelect
          value={currentStyle}
          onValueChange={(val) => handleStyleChange(val as BorderStyle)}
          options={BORDER_STYLE_OPTIONS}
          popupMinWidth="120px"
        >
          {borderStyleControlPreference === 'icon' ? (
            <Tip label={`Border style: ${currentStyleLabel}`}>
              <SelectTrigger
                className={cn(
                  'flex size-7 shrink-0 items-center justify-center rounded-md border-0 text-xs text-muted-foreground hover:bg-muted-foreground/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                )}
              >
                <Settings2 className="size-3.5" />
              </SelectTrigger>
            </Tip>
          ) : (
            <SelectTrigger className="flex h-7 flex-1 items-center justify-between rounded-md border-0 bg-muted px-2 text-xs hover:bg-muted-foreground/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
              <span className="flex items-center gap-2">
                <Square className="size-3.5 text-muted-foreground" />
                <span>{currentStyleLabel}</span>
              </span>
              <SelectIcon>
                <ChevronDown className="size-3.5 text-muted-foreground" />
              </SelectIcon>
            </SelectTrigger>
          )}
        </SimpleSelect>

        {!isOutline && (
          <SimpleSelect
            value={selectedSide}
            onValueChange={(val) => handleSideChange(val as BorderSideOption)}
            options={BORDER_SIDE_OPTIONS.map((side) => ({ value: side, label: side }))}
            popupMinWidth="90px"
          >
            <Tip label={`Sides: ${selectedSide}`}>
              <SelectTrigger className="flex size-7 shrink-0 items-center justify-center rounded-md border-0 text-xs text-muted-foreground hover:bg-muted-foreground/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                {selectedSide === 'Custom' ? (
                  <Grid2x2 className="size-3.5 text-muted-foreground" strokeWidth={1} />
                ) : selectedSide === 'All' ? (
                  <Square className="size-3.5 text-muted-foreground" />
                ) : (
                  <BorderSideIcon side={selectedSide} className="text-muted-foreground" />
                )}
              </SelectTrigger>
            </Tip>
          </SimpleSelect>
        )}
      </div>

      {!isOutline && selectedSide === 'Custom' && (
        <div className="grid grid-cols-2 gap-2">
          {BORDER_SIDES.map((side) => {
            const w = border[`border${side}Width` as keyof BorderProperties] as CSSPropertyValue
            return (
              <Tip label={`Border ${side.toLowerCase()} width`} key={side}>
                <div className="relative">
                  <BorderSideIcon side={side} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <NumberInput
                    min={0}
                    step={0.5}
                    value={Math.round(w.numericValue * 100) / 100}
                    onValueChange={(val) => handleSideWidthChange(side, val)}
                    className="h-7 pl-7 pr-2 text-xs tabular-nums"
                  />
                </div>
              </Tip>
            )
          })}
        </div>
      )}

      {/* Row 2: Color */}
      {activeColor && activeColorChange && (
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <ColorInput
              id={isOutline ? 'outline-color' : 'border-color'}
              value={activeColor}
              onChange={activeColorChange}
            />
          </div>
          {borderStyleControlPreference === 'icon' && <div className="size-7 shrink-0" />}
          {!isOutline && <div className="size-7 shrink-0" />}
        </div>
      )}
    </div>
  )
}

interface BorderSectionProps {
  border: BorderProperties
  borderColor?: ColorValue
  outlineColor?: ColorValue
  borderStyleControlPreference: BorderStyleControlPreference
  onChange: (key: BorderPropertyKey, value: BorderProperties[BorderPropertyKey]) => void
  onBatchChange: (changes: Array<[BorderPropertyKey, BorderProperties[BorderPropertyKey]]>) => void
  onBorderColorChange?: (value: ColorValue) => void
  onOutlineColorChange?: (value: ColorValue) => void
  onSetCSS?: (properties: Record<string, string>) => void
  pendingStyles?: Record<string, string>
}

export function BorderSection({ border, borderColor, outlineColor, borderStyleControlPreference, onChange, onBatchChange, onBorderColorChange, onOutlineColorChange, onSetCSS, pendingStyles }: BorderSectionProps) {
  // Auto-detect initial position from pending styles
  const hasOutlinePending = Boolean(
    pendingStyles?.['outline-style'] || pendingStyles?.['outline-width']
  )
  const [borderPosition, setBorderPosition] = React.useState<BorderPosition>(
    hasOutlinePending ? 'outline' : 'border'
  )

  const isOutline = borderPosition === 'outline'

  // Derive outline values from pending styles or computed
  const outlineStyleValue = (pendingStyles?.['outline-style'] as BorderStyle) || 'none'
  const outlineWidthValue = pendingStyles?.['outline-width']
    ? parseFloat(pendingStyles['outline-width'])
    : 0

  const hasBorder = isOutline
    ? (outlineStyleValue !== 'none' && outlineWidthValue > 0)
    : BORDER_SIDES.some((s) => {
        const style = border[`border${s}Style` as keyof BorderProperties] as BorderStyle
        const width = border[`border${s}Width` as keyof BorderProperties] as CSSPropertyValue
        return style !== 'none' && width.numericValue > 0
      })

  const handleAddBorder = () => {
    if (isOutline && onSetCSS) {
      onSetCSS({ 'outline-style': 'solid', 'outline-width': '1px' })
      return
    }
    const changes: Array<[BorderPropertyKey, BorderProperties[BorderPropertyKey]]> = []
    for (const s of BORDER_SIDES) {
      changes.push([`border${s}Style` as BorderPropertyKey, 'solid'])
      const w = border[`border${s}Width` as keyof BorderProperties] as CSSPropertyValue
      if (w.numericValue <= 0) {
        changes.push([`border${s}Width` as BorderPropertyKey, { numericValue: 1, unit: 'px', raw: '1px' }])
      }
    }
    onBatchChange(changes)
  }

  const handleRemoveBorder = () => {
    if (isOutline && onSetCSS) {
      onSetCSS({ 'outline-style': 'none', 'outline-width': '0px' })
      return
    }
    const changes: Array<[BorderPropertyKey, BorderProperties[BorderPropertyKey]]> = []
    for (const s of BORDER_SIDES) {
      changes.push([`border${s}Style` as BorderPropertyKey, 'none'])
      changes.push([`border${s}Width` as BorderPropertyKey, { numericValue: 0, unit: 'px', raw: '0px' }])
    }
    onBatchChange(changes)
  }

  const handlePositionChange = (newPosition: BorderPosition) => {
    if (newPosition === borderPosition) return

    if (newPosition === 'outline' && onSetCSS) {
      // Transfer border values to outline
      const firstSideStyle = border.borderTopStyle !== 'none' ? border.borderTopStyle : 'solid'
      const firstSideWidth = border.borderTopWidth.numericValue > 0 ? border.borderTopWidth.numericValue : 1

      // Clear border props
      const clearChanges: Array<[BorderPropertyKey, BorderProperties[BorderPropertyKey]]> = []
      for (const s of BORDER_SIDES) {
        clearChanges.push([`border${s}Style` as BorderPropertyKey, 'none'])
        clearChanges.push([`border${s}Width` as BorderPropertyKey, { numericValue: 0, unit: 'px', raw: '0px' }])
      }
      onBatchChange(clearChanges)

      // Set outline props
      if (hasBorder) {
        onSetCSS({
          'outline-style': firstSideStyle,
          'outline-width': `${firstSideWidth}px`,
        })
        // Transfer border color to outline color
        if (borderColor && onOutlineColorChange) {
          onOutlineColorChange(borderColor)
        }
      }
    } else if (newPosition === 'border' && onSetCSS) {
      // Transfer outline values to border
      const style = outlineStyleValue !== 'none' ? outlineStyleValue : 'solid'
      const width = outlineWidthValue > 0 ? outlineWidthValue : 1

      // Clear outline props
      onSetCSS({ 'outline-style': 'none', 'outline-width': '0px' })

      // Set border props
      if (hasBorder) {
        const changes: Array<[BorderPropertyKey, BorderProperties[BorderPropertyKey]]> = []
        for (const s of BORDER_SIDES) {
          changes.push([`border${s}Style` as BorderPropertyKey, style])
          changes.push([`border${s}Width` as BorderPropertyKey, { numericValue: width, unit: 'px', raw: `${width}px` }])
        }
        onBatchChange(changes)
        // Transfer outline color to border color
        if (outlineColor && onBorderColorChange) {
          onBorderColorChange(outlineColor)
        }
      }
    }

    setBorderPosition(newPosition)
  }

  const headerActions = (
    <Tip label={hasBorder ? 'Remove border' : 'Add border'}>
      <Button
        variant="ghost"
        size="icon"
        className="size-7 text-muted-foreground"
        onClick={hasBorder ? handleRemoveBorder : handleAddBorder}
      >
        {hasBorder ? <Minus /> : <Plus />}
      </Button>
    </Tip>
  )

  return (
    <CollapsibleSection title="Border" actions={headerActions}>
      {hasBorder ? (
        <ColorPickerGroup>
          <BorderInputs
            border={border}
            borderColor={borderColor}
            outlineColor={outlineColor}
            onChange={onChange}
            onBatchChange={onBatchChange}
            onBorderColorChange={onBorderColorChange}
            onOutlineColorChange={onOutlineColorChange}
            onSetCSS={onSetCSS}
            borderPosition={borderPosition}
            borderStyleControlPreference={borderStyleControlPreference}
            onPositionChange={handlePositionChange}
            outlineStyle={outlineStyleValue}
            outlineWidth={outlineWidthValue}
          />
        </ColorPickerGroup>
      ) : null}
    </CollapsibleSection>
  )
}
