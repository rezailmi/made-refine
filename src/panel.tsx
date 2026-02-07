import * as React from 'react'
import { createPortal } from 'react-dom'
import { usePortalContainer } from './portal-container'
import { useDirectEdit } from './provider'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible'
import {
  Tooltip,
  TooltipProvider,
  TooltipTrigger,
  TooltipPortal,
  TooltipPositioner,
  TooltipPopup,
  createTooltipHandle,
} from './ui/tooltip'
import {
  Select,
  SelectTrigger,
  SelectIcon,
  SelectPortal,
  SelectPositioner,
  SelectPopup,
  SelectItem,
  SelectItemIndicator,
  SelectItemText,
} from './ui/select'
import { cn } from './cn'
import type { SpacingPropertyKey, BorderRadiusPropertyKey, CSSPropertyValue, SizingValue, SizingMode, SizingPropertyKey, ColorValue, ColorPropertyKey, TypographyPropertyKey, TypographyProperties } from './types'
import { formatColorValue } from './utils'
import { Slider } from './ui/slider'
import { useMeasurement } from './use-measurement'
import { MeasurementOverlay } from './measurement-overlay'
import { useMove } from './use-move'
import { getStoredGuidelines } from './use-guidelines'
import { calculateGuidelineMeasurements } from './utils'
import { MoveOverlay } from './move-overlay'
import { SelectionOverlay } from './selection-overlay'
import {
  X,
  GripVertical,
  RotateCcw,
  Copy,
  Check,
  ChevronUp,
  ChevronDown,
  ArrowRight,
  ArrowDown,
  ArrowUp,
  ArrowLeft,
  MoveHorizontal,
  MoveVertical,
  CornerUpLeft,
  CornerUpRight,
  CornerDownLeft,
  CornerDownRight,
  ChevronsLeftRightEllipsis,
  Grid2x2,
  Columns2,
  ChevronsUpDown,
  Paintbrush,
  Type,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignVerticalJustifyStart,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  ALargeSmall,
  WrapText,
  AArrowUp,
  LetterText,
} from 'lucide-react'

const STORAGE_KEY = 'direct-edit-panel-position'
const SECTIONS_KEY = 'direct-edit-sections-state'
const PANEL_WIDTH = 300
const PANEL_HEIGHT = 560

const selectOnFocus = (e: React.FocusEvent<HTMLInputElement>) => e.target.select()

interface Position {
  x: number
  y: number
}

function getInitialPosition(): Position {
  if (typeof window === 'undefined') {
    return { x: 0, y: 0 }
  }

  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored) {
    try {
      return JSON.parse(stored)
    } catch {
      // Fall through to default
    }
  }

  return {
    x: window.innerWidth - PANEL_WIDTH - 20,
    y: window.innerHeight - PANEL_HEIGHT - 20,
  }
}

const DEFAULT_SECTIONS = { layout: true, fill: true, radius: true, text: true }
const DISTRIBUTE_MODES = ['fixed', 'space-between', 'space-around', 'space-evenly'] as const
type DistributeMode = typeof DISTRIBUTE_MODES[number]
const DISTRIBUTE_LABELS: Record<DistributeMode, string> = {
  fixed: 'Fixed',
  'space-between': 'Between',
  'space-around': 'Around',
  'space-evenly': 'Evenly',
}

function useSectionsState() {
  const [sections, setSections] = React.useState<Record<string, boolean>>(DEFAULT_SECTIONS)

  React.useEffect(() => {
    const stored = localStorage.getItem(SECTIONS_KEY)
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as Record<string, boolean>
        if (parsed && typeof parsed === 'object') {
          setSections({ ...DEFAULT_SECTIONS, ...parsed })
        }
      } catch {}
    }
  }, [])

  const toggleSection = React.useCallback((key: string) => {
    setSections((prev) => {
      const defaultValue = key in DEFAULT_SECTIONS
        ? DEFAULT_SECTIONS[key as keyof typeof DEFAULT_SECTIONS]
        : true
      const currentValue = prev[key] ?? defaultValue
      const newSections = { ...prev, [key]: !currentValue }
      localStorage.setItem(SECTIONS_KEY, JSON.stringify(newSections))
      return newSections
    })
  }, [])

  return { sections, toggleSection }
}

interface PaddingInputsProps {
  values: {
    top: CSSPropertyValue
    right: CSSPropertyValue
    bottom: CSSPropertyValue
    left: CSSPropertyValue
  }
  onChange: (key: SpacingPropertyKey, value: CSSPropertyValue) => void
}

function PaddingInputs({ values, onChange }: PaddingInputsProps) {
  const [individual, setIndividual] = React.useState(false)

  const handleChange = (sides: ('top' | 'right' | 'bottom' | 'left')[], numericValue: number) => {
    const newValue: CSSPropertyValue = {
      numericValue,
      unit: 'px',
      raw: `${numericValue}px`,
    }

    for (const side of sides) {
      const key = `padding${side.charAt(0).toUpperCase() + side.slice(1)}` as SpacingPropertyKey
      onChange(key, newValue)
    }
  }

  const horizontalValue =
    values.left.numericValue === values.right.numericValue
      ? values.left.numericValue
      : values.left.numericValue
  const verticalValue =
    values.top.numericValue === values.bottom.numericValue
      ? values.top.numericValue
      : values.top.numericValue

  if (individual) {
    return (
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5">
          <div className="relative flex-1">
            <ArrowUp className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              type="number"
              value={values.top?.numericValue ?? 0}
              onChange={(e) => handleChange(['top'], parseFloat(e.target.value) || 0)}
              onFocus={selectOnFocus}
              className="h-7 pl-7 pr-2 text-center text-xs tabular-nums"
              title="Top"
            />
          </div>
          <div className="relative flex-1">
            <ArrowRight className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              type="number"
              value={values.right?.numericValue ?? 0}
              onChange={(e) => handleChange(['right'], parseFloat(e.target.value) || 0)}
              onFocus={selectOnFocus}
              className="h-7 pl-7 pr-2 text-center text-xs tabular-nums"
              title="Right"
            />
          </div>
          <Button
            variant="secondary"
            size="icon"
            className="size-7 shrink-0"
            onClick={() => setIndividual(false)}
            title="Combined mode"
          >
            <Columns2 className="size-3" />
          </Button>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="relative flex-1">
            <ArrowDown className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              type="number"
              value={values.bottom?.numericValue ?? 0}
              onChange={(e) => handleChange(['bottom'], parseFloat(e.target.value) || 0)}
              onFocus={selectOnFocus}
              className="h-7 pl-7 pr-2 text-center text-xs tabular-nums"
              title="Bottom"
            />
          </div>
          <div className="relative flex-1">
            <ArrowLeft className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              type="number"
              value={values.left?.numericValue ?? 0}
              onChange={(e) => handleChange(['left'], parseFloat(e.target.value) || 0)}
              onFocus={selectOnFocus}
              className="h-7 pl-7 pr-2 text-center text-xs tabular-nums"
              title="Left"
            />
          </div>
          <div className="size-7 shrink-0" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1.5">
      <div className="relative flex-1">
        <MoveHorizontal className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
        <Input
          type="number"
          value={horizontalValue}
          onChange={(e) => handleChange(['left', 'right'], parseFloat(e.target.value) || 0)}
          onFocus={selectOnFocus}
          className="h-7 pl-7 pr-2 text-center text-xs tabular-nums"
          title="Horizontal (left & right)"
        />
      </div>
      <div className="relative flex-1">
        <MoveVertical className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
        <Input
          type="number"
          value={verticalValue}
          onChange={(e) => handleChange(['top', 'bottom'], parseFloat(e.target.value) || 0)}
          onFocus={selectOnFocus}
          className="h-7 pl-7 pr-2 text-center text-xs tabular-nums"
          title="Vertical (top & bottom)"
        />
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="size-7 shrink-0"
        onClick={() => setIndividual(true)}
        title="Individual mode"
      >
        <Grid2x2 className="size-3" />
      </Button>
    </div>
  )
}

interface MarginInputsProps {
  values: {
    top: CSSPropertyValue
    right: CSSPropertyValue
    bottom: CSSPropertyValue
    left: CSSPropertyValue
  }
  onChange: (key: SpacingPropertyKey, value: CSSPropertyValue) => void
}

function MarginInputs({ values, onChange }: MarginInputsProps) {
  const [individual, setIndividual] = React.useState(false)

  const handleChange = (sides: ('top' | 'right' | 'bottom' | 'left')[], numericValue: number) => {
    const newValue: CSSPropertyValue = {
      numericValue,
      unit: 'px',
      raw: `${numericValue}px`,
    }

    for (const side of sides) {
      const key = `margin${side.charAt(0).toUpperCase() + side.slice(1)}` as SpacingPropertyKey
      onChange(key, newValue)
    }
  }

  const horizontalValue =
    values.left.numericValue === values.right.numericValue
      ? values.left.numericValue
      : values.left.numericValue
  const verticalValue =
    values.top.numericValue === values.bottom.numericValue
      ? values.top.numericValue
      : values.top.numericValue

  if (individual) {
    return (
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5">
          <div className="relative flex-1">
            <ArrowUp className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              type="number"
              value={values.top?.numericValue ?? 0}
              onChange={(e) => handleChange(['top'], parseFloat(e.target.value) || 0)}
              onFocus={selectOnFocus}
              className="h-7 pl-7 pr-2 text-center text-xs tabular-nums"
              title="Top"
            />
          </div>
          <div className="relative flex-1">
            <ArrowRight className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              type="number"
              value={values.right?.numericValue ?? 0}
              onChange={(e) => handleChange(['right'], parseFloat(e.target.value) || 0)}
              onFocus={selectOnFocus}
              className="h-7 pl-7 pr-2 text-center text-xs tabular-nums"
              title="Right"
            />
          </div>
          <Button
            variant="secondary"
            size="icon"
            className="size-7 shrink-0"
            onClick={() => setIndividual(false)}
            title="Combined mode"
          >
            <Columns2 className="size-3" />
          </Button>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="relative flex-1">
            <ArrowDown className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              type="number"
              value={values.bottom?.numericValue ?? 0}
              onChange={(e) => handleChange(['bottom'], parseFloat(e.target.value) || 0)}
              onFocus={selectOnFocus}
              className="h-7 pl-7 pr-2 text-center text-xs tabular-nums"
              title="Bottom"
            />
          </div>
          <div className="relative flex-1">
            <ArrowLeft className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              type="number"
              value={values.left?.numericValue ?? 0}
              onChange={(e) => handleChange(['left'], parseFloat(e.target.value) || 0)}
              onFocus={selectOnFocus}
              className="h-7 pl-7 pr-2 text-center text-xs tabular-nums"
              title="Left"
            />
          </div>
          <div className="size-7 shrink-0" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1.5">
      <div className="relative flex-1">
        <MoveHorizontal className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
        <Input
          type="number"
          value={horizontalValue}
          onChange={(e) => handleChange(['left', 'right'], parseFloat(e.target.value) || 0)}
          onFocus={selectOnFocus}
          className="h-7 pl-7 pr-2 text-center text-xs tabular-nums"
          title="Horizontal (left & right)"
        />
      </div>
      <div className="relative flex-1">
        <MoveVertical className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
        <Input
          type="number"
          value={verticalValue}
          onChange={(e) => handleChange(['top', 'bottom'], parseFloat(e.target.value) || 0)}
          onFocus={selectOnFocus}
          className="h-7 pl-7 pr-2 text-center text-xs tabular-nums"
          title="Vertical (top & bottom)"
        />
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="size-7 shrink-0"
        onClick={() => setIndividual(true)}
        title="Individual mode"
      >
        <Grid2x2 className="size-3" />
      </Button>
    </div>
  )
}

interface BorderRadiusInputsProps {
  values: {
    topLeft: CSSPropertyValue
    topRight: CSSPropertyValue
    bottomRight: CSSPropertyValue
    bottomLeft: CSSPropertyValue
  }
  onChange: (key: BorderRadiusPropertyKey, value: CSSPropertyValue) => void
}

const BORDER_RADIUS_FULL = 9999
const BORDER_RADIUS_SLIDER_MAX = 49

// Slider position 0-48 maps to 0-48px, position 49 maps to 9999 (Full)
function sliderToValue(sliderPos: number): number {
  return sliderPos >= BORDER_RADIUS_SLIDER_MAX ? BORDER_RADIUS_FULL : sliderPos
}

function valueToSlider(value: number): number {
  return value >= BORDER_RADIUS_FULL ? BORDER_RADIUS_SLIDER_MAX : Math.min(value, BORDER_RADIUS_SLIDER_MAX - 1)
}

function BorderRadiusInputs({ values, onChange }: BorderRadiusInputsProps) {
  const [individual, setIndividual] = React.useState(false)

  const handleChange = (
    corners: ('topLeft' | 'topRight' | 'bottomRight' | 'bottomLeft')[],
    numericValue: number
  ) => {
    const newValue: CSSPropertyValue = {
      numericValue,
      unit: 'px',
      raw: `${numericValue}px`,
    }

    for (const corner of corners) {
      const key = `border${corner.charAt(0).toUpperCase() + corner.slice(1)}Radius` as BorderRadiusPropertyKey
      onChange(key, newValue)
    }
  }

  const handleTextInputChange = (
    corners: ('topLeft' | 'topRight' | 'bottomRight' | 'bottomLeft')[],
    inputValue: string
  ) => {
    if (inputValue.toLowerCase() === 'full') {
      handleChange(corners, BORDER_RADIUS_FULL)
    } else {
      const numericValue = parseFloat(inputValue) || 0
      handleChange(corners, numericValue)
    }
  }

  const allSame =
    values.topLeft.numericValue === values.topRight.numericValue &&
    values.topRight.numericValue === values.bottomRight.numericValue &&
    values.bottomRight.numericValue === values.bottomLeft.numericValue
  const uniformValue = allSame ? values.topLeft.numericValue : values.topLeft.numericValue

  if (individual) {
    return (
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5">
          <div className="relative flex-1">
            <CornerUpLeft className="absolute left-1.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              type="number"
              value={values.topLeft?.numericValue ?? 0}
              onChange={(e) => handleChange(['topLeft'], parseFloat(e.target.value) || 0)}
              onFocus={selectOnFocus}
              className="h-7 pl-6 pr-1 text-center text-xs tabular-nums"
              title="Top Left"
            />
          </div>
          <div className="relative flex-1">
            <CornerUpRight className="absolute left-1.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              type="number"
              value={values.topRight?.numericValue ?? 0}
              onChange={(e) => handleChange(['topRight'], parseFloat(e.target.value) || 0)}
              onFocus={selectOnFocus}
              className="h-7 pl-6 pr-1 text-center text-xs tabular-nums"
              title="Top Right"
            />
          </div>
          <Button
            variant="secondary"
            size="icon"
            className="size-7 shrink-0"
            onClick={() => setIndividual(false)}
            title="Combined mode"
          >
            <Columns2 className="size-3" />
          </Button>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="relative flex-1">
            <CornerDownLeft className="absolute left-1.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              type="number"
              value={values.bottomLeft?.numericValue ?? 0}
              onChange={(e) => handleChange(['bottomLeft'], parseFloat(e.target.value) || 0)}
              onFocus={selectOnFocus}
              className="h-7 pl-6 pr-1 text-center text-xs tabular-nums"
              title="Bottom Left"
            />
          </div>
          <div className="relative flex-1">
            <CornerDownRight className="absolute left-1.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              type="number"
              value={values.bottomRight?.numericValue ?? 0}
              onChange={(e) => handleChange(['bottomRight'], parseFloat(e.target.value) || 0)}
              onFocus={selectOnFocus}
              className="h-7 pl-6 pr-1 text-center text-xs tabular-nums"
              title="Bottom Right"
            />
          </div>
          <div className="size-7 shrink-0" />
        </div>
      </div>
    )
  }

  const isFull = uniformValue >= BORDER_RADIUS_FULL
  const displayValue = isFull ? 'Full' : String(uniformValue)
  const sliderValue = valueToSlider(uniformValue)

  return (
    <div className="flex items-center gap-1.5">
      <Slider
        value={sliderValue}
        onValueChange={(val) => {
          const sliderPos = typeof val === 'number' ? val : val[0]
          handleChange(
            ['topLeft', 'topRight', 'bottomRight', 'bottomLeft'],
            sliderToValue(sliderPos)
          )
        }}
        max={BORDER_RADIUS_SLIDER_MAX}
        step={1}
        className="flex-1"
      />
      <Input
        type="text"
        value={displayValue}
        onChange={(e) =>
          handleTextInputChange(
            ['topLeft', 'topRight', 'bottomRight', 'bottomLeft'],
            e.target.value
          )
        }
        onFocus={selectOnFocus}
        className="h-7 w-14 px-2 text-center text-xs tabular-nums"
      />
      <Button
        variant="ghost"
        size="icon"
        className="size-7 shrink-0"
        onClick={() => setIndividual(true)}
        title="Individual mode"
      >
        <Grid2x2 className="size-3" />
      </Button>
    </div>
  )
}

interface AlignmentGridProps {
  justifyContent: string
  alignItems: string
  onChange: (justify: string, align: string) => void
}

function AlignmentGrid({ justifyContent, alignItems, onChange }: AlignmentGridProps) {
  const justifyValues = ['flex-start', 'center', 'flex-end']
  const alignValues = ['flex-start', 'center', 'flex-end']

  const normalizeJustify = (val: string) => {
    if (val === 'start') return 'flex-start'
    if (val === 'end') return 'flex-end'
    return val
  }

  const normalizeAlign = (val: string) => {
    if (val === 'start') return 'flex-start'
    if (val === 'end') return 'flex-end'
    return val
  }

  const currentJustify = normalizeJustify(justifyContent)
  const currentAlign = normalizeAlign(alignItems)

  const tooltipHandle = createTooltipHandle<{ justify: string; align: string }>()

  return (
    <TooltipProvider delayDuration={300} closeDelay={150}>
      <div className="grid grid-cols-3 gap-1 rounded-md border bg-muted/30 p-1.5">
        {alignValues.map((align) =>
          justifyValues.map((justify) => {
            const isActive = currentJustify === justify && currentAlign === align
            return (
              <TooltipTrigger
                key={`${justify}-${align}`}
                handle={tooltipHandle}
                payload={{ justify, align }}
                render={
                  <button
                    type="button"
                    className={cn(
                      'flex size-6 items-center justify-center rounded transition-colors',
                      isActive
                        ? 'bg-blue-500 text-white'
                        : 'bg-background hover:bg-muted-foreground/10'
                    )}
                    onClick={() => onChange(justify, align)}
                  >
                    <span
                      className={cn(
                        'size-1.5 rounded-full',
                        isActive ? 'bg-white' : 'bg-muted-foreground/40'
                      )}
                    />
                  </button>
                }
              />
            )
          })
        )}
      </div>
      <Tooltip handle={tooltipHandle}>
        {({ payload }) => (
          <TooltipPortal>
            <TooltipPositioner side="bottom" sideOffset={8} className="fixed z-[99999]">
              <TooltipPopup className="overflow-hidden rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground animate-in fade-in-0 zoom-in-95 data-[closed]:animate-out data-[closed]:fade-out-0 data-[closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2">
                justify: {payload?.justify}, align: {payload?.align}
              </TooltipPopup>
            </TooltipPositioner>
          </TooltipPortal>
        )}
      </Tooltip>
    </TooltipProvider>
  )
}

const SIZING_OPTIONS: { value: SizingMode; label: string }[] = [
  { value: 'fixed', label: 'Fixed' },
  { value: 'fill', label: 'Fill container' },
  { value: 'fit', label: 'Fit content' },
]

interface SizingDropdownProps {
  label: string
  value: SizingValue
  onChange: (value: SizingValue) => void
}

function SizingDropdown({ label, value, onChange }: SizingDropdownProps) {
  const handleFixedValueChange = (numericValue: number) => {
    onChange({
      mode: 'fixed',
      value: {
        numericValue,
        unit: 'px',
        raw: `${numericValue}px`,
      },
    })
  }

  const cycleMode = () => {
    const modes: SizingMode[] = ['fixed', 'fill', 'fit']
    const currentIndex = modes.indexOf(value.mode)
    const nextMode = modes[(currentIndex + 1) % modes.length]
    onChange({ mode: nextMode, value: value.value })
  }

  const getDisplayText = () => {
    if (value.mode === 'fill') return 'Fill'
    return 'Fit'
  }

  return (
    <div className="flex h-8 flex-1 items-center rounded-md border bg-background text-xs">
      <span className="flex flex-1 items-center gap-1.5 px-2">
        <span className="text-muted-foreground">{label}</span>
        {value.mode === 'fixed' ? (
          <input
            type="number"
            value={Math.round(value.value.numericValue)}
            onChange={(e) => handleFixedValueChange(parseFloat(e.target.value) || 0)}
            onFocus={selectOnFocus}
            className="w-full min-w-0 flex-1 bg-transparent tabular-nums outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [appearance:textfield]"
          />
        ) : (
          <span className="flex-1">{getDisplayText()}</span>
        )}
      </span>
      <button
        type="button"
        className="flex h-full items-center justify-center border-l px-1.5 hover:bg-muted/50"
        onClick={cycleMode}
        title={`Mode: ${value.mode} (click to cycle)`}
      >
        <ChevronsUpDown className="size-3 text-muted-foreground" />
      </button>
    </div>
  )
}

interface SizingInputsProps {
  width: SizingValue
  height: SizingValue
  onWidthChange: (value: SizingValue) => void
  onHeightChange: (value: SizingValue) => void
}

function SizingInputs({ width, height, onWidthChange, onHeightChange }: SizingInputsProps) {
  return (
    <div className="flex items-center gap-2">
      <SizingDropdown label="W" value={width} onChange={onWidthChange} />
      <SizingDropdown label="H" value={height} onChange={onHeightChange} />
    </div>
  )
}

interface ColorInputProps {
  label: string
  icon: React.ReactNode
  value: ColorValue
  onChange: (value: ColorValue) => void
}

function ColorInput({ label, icon, value, onChange }: ColorInputProps) {
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

  // Native color picker change handler
  const handleNativeColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const hex = e.target.value.replace('#', '').toUpperCase()
    setHexInput(hex)
    onChange({
      hex,
      alpha: value.alpha,
      raw: formatColorValue({ hex, alpha: value.alpha, raw: '' }),
    })
  }

  return (
    <div>
      <div className="flex h-8 items-center rounded-md border border-input bg-background">
        {/* Color swatch with native picker */}
        <div className="relative ml-1.5">
          <div
            className="size-5 cursor-pointer overflow-hidden rounded-sm border"
            style={{ backgroundColor: `#${value.hex}` }}
          >
            <input
              type="color"
              value={`#${value.hex}`}
              onChange={handleNativeColorChange}
              className="absolute inset-0 cursor-pointer opacity-0"
            />
          </div>
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

const FONT_FAMILIES = [
  { value: 'system-ui, sans-serif', label: 'System Sans-Serif' },
  { value: 'Georgia, serif', label: 'System Serif' },
  { value: 'ui-monospace, monospace', label: 'System Mono' },
  { value: 'Inter, sans-serif', label: 'Inter' },
  { value: 'Roboto, sans-serif', label: 'Roboto' },
  { value: 'Arial, sans-serif', label: 'Arial' },
]

const FONT_WEIGHTS = [
  { value: '100', label: 'Thin' },
  { value: '200', label: 'Extra Light' },
  { value: '300', label: 'Light' },
  { value: '400', label: 'Regular' },
  { value: '500', label: 'Medium' },
  { value: '600', label: 'Semibold' },
  { value: '700', label: 'Bold' },
  { value: '800', label: 'Extra Bold' },
  { value: '900', label: 'Black' },
]

interface TypographyInputsProps {
  typography: TypographyProperties
  onUpdate: (key: TypographyPropertyKey, value: CSSPropertyValue | string) => void
}

function TypographyInputs({ typography, onUpdate }: TypographyInputsProps) {
  const handleFontSizeChange = (value: number) => {
    onUpdate('fontSize', { numericValue: value, unit: 'px', raw: `${value}px` })
  }

  const handleLineHeightChange = (value: number) => {
    onUpdate('lineHeight', { numericValue: value, unit: 'px', raw: `${value}px` })
  }

  const handleLetterSpacingChange = (value: number) => {
    onUpdate('letterSpacing', { numericValue: value, unit: 'em', raw: `${value}em` })
  }

  const getFontFamilyLabel = (value: string) => {
    const valueLower = value.toLowerCase()
    const family = FONT_FAMILIES.find((f) => {
      const familyName = f.value.split(',')[0].trim().toLowerCase()
      return valueLower.startsWith(familyName) || valueLower.startsWith(`"${familyName}"`)
    })
    return family?.label || 'Custom'
  }

  const getFontWeightLabel = (value: string) => {
    const weight = FONT_WEIGHTS.find((w) => w.value === value)
    return weight?.label || value
  }

  return (
    <div className="space-y-3">
      <Select value={typography.fontFamily} onValueChange={(val) => val && onUpdate('fontFamily', val)}>
        <SelectTrigger className="flex h-8 w-full items-center justify-between rounded-md border bg-background px-2 text-xs hover:bg-muted/50 focus:outline-none">
          <span className="flex items-center gap-2">
            <Type className="size-3.5 text-muted-foreground" />
            <span>{getFontFamilyLabel(typography.fontFamily)}</span>
          </span>
          <SelectIcon>
            <ChevronDown className="size-3 text-muted-foreground" />
          </SelectIcon>
        </SelectTrigger>
        <SelectPortal>
          <SelectPositioner sideOffset={4} className="z-[99999]">
            <SelectPopup className="min-w-[180px] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95">
              {FONT_FAMILIES.map((option) => (
                <SelectItem
                  key={option.value}
                  value={option.value}
                  className="relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-7 pr-2 text-xs outline-none hover:bg-accent hover:text-accent-foreground data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground"
                >
                  <SelectItemIndicator className="absolute left-2 flex items-center justify-center">
                    <Check className="size-3" />
                  </SelectItemIndicator>
                  <SelectItemText>{option.label}</SelectItemText>
                </SelectItem>
              ))}
            </SelectPopup>
          </SelectPositioner>
        </SelectPortal>
      </Select>

      <Select value={typography.fontWeight} onValueChange={(val) => val && onUpdate('fontWeight', val)}>
        <SelectTrigger className="flex h-8 w-full items-center justify-between rounded-md border bg-background px-2 text-xs hover:bg-muted/50 focus:outline-none">
          <span className="flex items-center gap-2">
            <ALargeSmall className="size-3.5 text-muted-foreground" />
            <span>{getFontWeightLabel(typography.fontWeight)}</span>
          </span>
          <SelectIcon>
            <ChevronDown className="size-3 text-muted-foreground" />
          </SelectIcon>
        </SelectTrigger>
        <SelectPortal>
          <SelectPositioner sideOffset={4} className="z-[99999]">
            <SelectPopup className="min-w-[140px] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95">
              {FONT_WEIGHTS.map((option) => (
                <SelectItem
                  key={option.value}
                  value={option.value}
                  className="relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-7 pr-2 text-xs outline-none hover:bg-accent hover:text-accent-foreground data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground"
                >
                  <SelectItemIndicator className="absolute left-2 flex items-center justify-center">
                    <Check className="size-3" />
                  </SelectItemIndicator>
                  <SelectItemText>{option.label}</SelectItemText>
                </SelectItem>
              ))}
            </SelectPopup>
          </SelectPositioner>
        </SelectPortal>
      </Select>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <AArrowUp className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="number"
            value={Math.round(typography.fontSize.numericValue)}
            onChange={(e) => handleFontSizeChange(parseFloat(e.target.value) || 0)}
            className="h-7 pl-7 pr-2 text-center text-xs tabular-nums"
            title="Font Size"
          />
        </div>
        <div className="relative flex-1">
          <WrapText className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="number"
            value={Math.round(typography.lineHeight.numericValue)}
            onChange={(e) => handleLineHeightChange(parseFloat(e.target.value) || 0)}
            className="h-7 pl-7 pr-2 text-center text-xs tabular-nums"
            title="Line Height"
          />
        </div>
        <div className="relative flex-1">
          <LetterText className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="number"
            step="0.01"
            value={Math.round(typography.letterSpacing.numericValue * 100) / 100}
            onChange={(e) => handleLetterSpacingChange(parseFloat(e.target.value) || 0)}
            className="h-7 pl-7 pr-2 text-center text-xs tabular-nums"
            title="Letter Spacing (em)"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex gap-1">
          <Button
            variant={typography.textAlign === 'left' || typography.textAlign === 'start' ? 'default' : 'outline'}
            size="icon"
            className="size-7"
            onClick={() => onUpdate('textAlign', 'left')}
            title="Align Left"
          >
            <AlignLeft className="size-3.5" />
          </Button>
          <Button
            variant={typography.textAlign === 'center' ? 'default' : 'outline'}
            size="icon"
            className="size-7"
            onClick={() => onUpdate('textAlign', 'center')}
            title="Align Center"
          >
            <AlignCenter className="size-3.5" />
          </Button>
          <Button
            variant={typography.textAlign === 'right' || typography.textAlign === 'end' ? 'default' : 'outline'}
            size="icon"
            className="size-7"
            onClick={() => onUpdate('textAlign', 'right')}
            title="Align Right"
          >
            <AlignRight className="size-3.5" />
          </Button>
        </div>

        <div className="flex gap-1">
          <Button
            variant={typography.textVerticalAlign === 'flex-start' ? 'default' : 'outline'}
            size="icon"
            className="size-7"
            onClick={() => onUpdate('textVerticalAlign', 'flex-start')}
            title="Align Top"
          >
            <AlignVerticalJustifyStart className="size-3.5" />
          </Button>
          <Button
            variant={typography.textVerticalAlign === 'center' ? 'default' : 'outline'}
            size="icon"
            className="size-7"
            onClick={() => onUpdate('textVerticalAlign', 'center')}
            title="Align Middle"
          >
            <AlignVerticalJustifyCenter className="size-3.5" />
          </Button>
          <Button
            variant={typography.textVerticalAlign === 'flex-end' ? 'default' : 'outline'}
            size="icon"
            className="size-7"
            onClick={() => onUpdate('textVerticalAlign', 'flex-end')}
            title="Align Bottom"
          >
            <AlignVerticalJustifyEnd className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  )
}

interface FillSectionProps {
  backgroundColor: ColorValue
  textColor: ColorValue
  onBackgroundChange: (value: ColorValue) => void
  onTextChange: (value: ColorValue) => void
  hasTextContent: boolean
}

function FillSection({
  backgroundColor,
  textColor,
  onBackgroundChange,
  onTextChange,
  hasTextContent,
}: FillSectionProps) {
  return (
    <div className="space-y-3">
      <ColorInput
        label="Fill"
        icon={<Paintbrush className="size-3.5" />}
        value={backgroundColor}
        onChange={onBackgroundChange}
      />

      {hasTextContent && (
        <ColorInput
          label="Text"
          icon={<Type className="size-3.5" />}
          value={textColor}
          onChange={onTextChange}
        />
      )}
    </div>
  )
}
interface CollapsibleSectionProps {
  title: string
  isOpen: boolean
  onToggle: () => void
  children: React.ReactNode
}

function CollapsibleSection({ title, isOpen, onToggle, children }: CollapsibleSectionProps) {
  return (
    <Collapsible open={isOpen} onOpenChange={onToggle}>
      <CollapsibleTrigger className="flex w-full items-center justify-between border-b px-3 py-2 text-xs font-medium text-foreground hover:bg-muted/50">
        {title}
        {isOpen ? (
          <ChevronDown className="size-3.5 text-muted-foreground" />
        ) : (
          <ChevronUp className="size-3.5 text-muted-foreground" />
        )}
      </CollapsibleTrigger>
      <CollapsibleContent className="overflow-hidden data-[ending-style]:animate-accordion-up data-[starting-style]:animate-accordion-down">
        <div className="px-3 py-3">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  )
}

export interface DirectEditPanelInnerProps {
  elementInfo: {
    tagName: string
    id: string | null
    classList: string[]
    isFlexContainer: boolean
    isFlexItem: boolean
    isTextElement: boolean
    parentElement: HTMLElement | null | boolean
    hasChildren: boolean
  }
  computedSpacing: {
    paddingTop: CSSPropertyValue
    paddingRight: CSSPropertyValue
    paddingBottom: CSSPropertyValue
    paddingLeft: CSSPropertyValue
    marginTop: CSSPropertyValue
    marginRight: CSSPropertyValue
    marginBottom: CSSPropertyValue
    marginLeft: CSSPropertyValue
    gap: CSSPropertyValue
  }
  computedBorderRadius: {
    borderTopLeftRadius: CSSPropertyValue
    borderTopRightRadius: CSSPropertyValue
    borderBottomRightRadius: CSSPropertyValue
    borderBottomLeftRadius: CSSPropertyValue
  }
  computedFlex: {
    flexDirection: 'row' | 'row-reverse' | 'column' | 'column-reverse'
    justifyContent: string
    alignItems: string
  }
  computedSizing: {
    width: SizingValue
    height: SizingValue
  } | null
  computedColor: {
    backgroundColor: ColorValue
    color: ColorValue
  } | null
  computedTypography: TypographyProperties | null
  pendingStyles: Record<string, string>
  onClose?: () => void
  onSelectParent?: () => void
  onSelectChild?: () => void
  onUpdateSpacing: (key: SpacingPropertyKey, value: CSSPropertyValue) => void
  onUpdateBorderRadius: (key: BorderRadiusPropertyKey, value: CSSPropertyValue) => void
  onUpdateFlex: (key: 'flexDirection' | 'justifyContent' | 'alignItems', value: string) => void
  onUpdateSizing: (key: SizingPropertyKey, value: SizingValue) => void
  onUpdateColor: (key: ColorPropertyKey, value: ColorValue) => void
  onUpdateTypography: (key: TypographyPropertyKey, value: CSSPropertyValue | string) => void
  onReset: () => void
  onExportEdits: () => Promise<boolean>
  className?: string
  style?: React.CSSProperties
  panelRef?: React.RefObject<HTMLDivElement>
  isDragging?: boolean
  onHeaderPointerDown?: (e: React.PointerEvent) => void
  onHeaderPointerMove?: (e: React.PointerEvent) => void
  onHeaderPointerUp?: (e: React.PointerEvent) => void
}

export function DirectEditPanelInner({
  elementInfo,
  computedSpacing,
  computedBorderRadius,
  computedFlex,
  computedSizing,
  computedColor,
  computedTypography,
  pendingStyles,
  onClose,
  onSelectParent,
  onSelectChild,
  onUpdateSpacing,
  onUpdateBorderRadius,
  onUpdateFlex,
  onUpdateSizing,
  onUpdateColor,
  onUpdateTypography,
  onReset,
  onExportEdits,
  className,
  style,
  panelRef,
  isDragging,
  onHeaderPointerDown,
  onHeaderPointerMove,
  onHeaderPointerUp,
}: DirectEditPanelInnerProps) {
  const [copied, setCopied] = React.useState(false)
  const [copyError, setCopyError] = React.useState(false)
  const { sections, toggleSection } = useSectionsState()

  const distributeMode: DistributeMode =
    computedFlex?.justifyContent === 'space-between' ||
    computedFlex?.justifyContent === 'space-around' ||
    computedFlex?.justifyContent === 'space-evenly'
      ? computedFlex.justifyContent
      : 'fixed'
  const isDistributeValue = distributeMode !== 'fixed'

  // Detect if element has significant text content
  const hasTextContent = React.useMemo(() => {
    if (!elementInfo) return false
    const textElements = ['p', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'a', 'button', 'label', 'li']
    return textElements.includes(elementInfo.tagName)
  }, [elementInfo])

  const handleCopy = async () => {
    const success = await onExportEdits()
    if (success) {
      setCopyError(false)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      return
    }
    setCopied(false)
    setCopyError(true)
    setTimeout(() => setCopyError(false), 2000)
  }

  const hasPendingChanges = Object.keys(pendingStyles).length > 0
  const isDraggable = onHeaderPointerDown !== undefined

  return (
    <div
      ref={panelRef}
      data-direct-edit="panel"
      className={cn(
        'flex flex-col overflow-hidden rounded-lg border bg-background shadow-xl',
        isDragging && 'cursor-grabbing select-none',
        className
      )}
      style={{ width: PANEL_WIDTH, ...style }}
    >
      <div
        className={cn(
          'flex shrink-0 items-center gap-2 border-b bg-muted/50 px-3 py-2',
          isDraggable && 'cursor-grab active:cursor-grabbing'
        )}
        onPointerDown={onHeaderPointerDown}
        onPointerMove={onHeaderPointerMove}
        onPointerUp={onHeaderPointerUp}
      >
        <GripVertical className="size-4 text-muted-foreground" />
        <span className="flex-1 text-sm font-medium">Direct Edit</span>
        {onClose && (
          <Button variant="ghost" size="icon" className="size-6" onClick={onClose}>
            <X className="size-4" />
          </Button>
        )}
      </div>

      <div className="shrink-0 border-b px-3 py-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <code className="text-sm font-semibold text-foreground">
              &lt;{elementInfo.tagName}&gt;
            </code>
            {elementInfo.id && (
              <div className="mt-0.5 truncate text-xs text-muted-foreground">#{elementInfo.id}</div>
            )}
            {elementInfo.classList.length > 0 && (
              <div className="mt-0.5 truncate text-xs text-muted-foreground">
                .{elementInfo.classList.slice(0, 3).join(' .')}
                {elementInfo.classList.length > 3 && ` +${elementInfo.classList.length - 3}`}
              </div>
            )}
          </div>
          <div className="flex shrink-0 gap-1">
            {onSelectParent && (
              <Button
                variant="outline"
                size="icon"
                onClick={onSelectParent}
                disabled={!elementInfo.parentElement}
                className="size-7"
                title="Select Parent"
              >
                <ChevronUp className="size-3.5" />
              </Button>
            )}
            {onSelectChild && (
              <Button
                variant="outline"
                size="icon"
                onClick={onSelectChild}
                disabled={!elementInfo.hasChildren}
                className="size-7"
                title="Select Child"
              >
                <ChevronDown className="size-3.5" />
              </Button>
            )}
          </div>
        </div>
        <div className="mt-1.5 flex gap-1.5">
          {elementInfo.isFlexContainer && (
            <span className="rounded bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-medium text-blue-600 dark:text-blue-400">
              Flex Container
            </span>
          )}
          {elementInfo.isFlexItem && (
            <span className="rounded bg-purple-500/10 px-1.5 py-0.5 text-[10px] font-medium text-purple-600 dark:text-purple-400">
              Flex Item
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <CollapsibleSection
          title="Layout"
          isOpen={sections.layout ?? true}
          onToggle={() => toggleSection('layout')}
        >
          <div className="space-y-3">
            {elementInfo.isFlexContainer && (
              <div>
                <div className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Flex</div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-2">
                    <div className="flex h-8 overflow-hidden rounded-md border">
                      <button
                        type="button"
                        className={cn(
                          'flex flex-1 items-center justify-center transition-colors',
                          computedFlex.flexDirection === 'row'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-background hover:bg-muted/50'
                        )}
                        onClick={() => onUpdateFlex('flexDirection', 'row')}
                        title="Row"
                      >
                        <ArrowRight className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        className={cn(
                          'flex flex-1 items-center justify-center border-l transition-colors',
                          computedFlex.flexDirection === 'column'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-background hover:bg-muted/50'
                        )}
                        onClick={() => onUpdateFlex('flexDirection', 'column')}
                        title="Column"
                      >
                        <ArrowDown className="size-3.5" />
                      </button>
                    </div>

                    <div className="flex h-8 items-center rounded-md border bg-background text-xs">
                      <span className="flex flex-1 items-center gap-1.5 px-2">
                        <MoveHorizontal className="size-3.5 shrink-0 text-muted-foreground" />
                        {isDistributeValue ? (
                          <span className="flex-1 truncate">{DISTRIBUTE_LABELS[distributeMode]}</span>
                        ) : (
                          <input
                            type="number"
                            value={computedSpacing.gap.numericValue}
                            onChange={(e) => {
                              const numericValue = parseFloat(e.target.value) || 0
                              const unit = computedSpacing.gap.unit === 'em' || computedSpacing.gap.unit === '' ? 'px' : computedSpacing.gap.unit
                              onUpdateSpacing('gap', {
                                numericValue,
                                unit,
                                raw: `${numericValue}${unit}`,
                              })
                            }}
                            onFocus={selectOnFocus}
                            className="h-full w-full min-w-0 flex-1 bg-transparent tabular-nums outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [appearance:textfield]"
                          />
                        )}
                      </span>
                      <button
                        type="button"
                        className="flex h-full items-center justify-center border-l px-1.5 hover:bg-muted/50"
                        onClick={() => {
                          const currentIndex = DISTRIBUTE_MODES.indexOf(distributeMode)
                          const nextMode = DISTRIBUTE_MODES[(currentIndex + 1) % DISTRIBUTE_MODES.length]
                          onUpdateFlex(
                            'justifyContent',
                            nextMode === 'fixed' ? 'flex-start' : nextMode
                          )
                        }}
                        title={`Distribution: ${DISTRIBUTE_LABELS[distributeMode]} (click to cycle)`}
                      >
                        <ChevronsUpDown className="size-3 text-muted-foreground" />
                      </button>
                    </div>
                  </div>

                  <AlignmentGrid
                    justifyContent={computedFlex.justifyContent}
                    alignItems={computedFlex.alignItems}
                    onChange={(justify, align) => {
                      onUpdateFlex('justifyContent', justify)
                      onUpdateFlex('alignItems', align)
                    }}
                  />
                </div>
              </div>
            )}

            {computedSizing && (
              <div>
                <div className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Sizing</div>
                <SizingInputs
                  width={computedSizing.width}
                  height={computedSizing.height}
                  onWidthChange={(value) => onUpdateSizing('width', value)}
                  onHeightChange={(value) => onUpdateSizing('height', value)}
                />
              </div>
            )}

            <div>
              <div className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Padding</div>
              <PaddingInputs
                values={{
                  top: computedSpacing.paddingTop,
                  right: computedSpacing.paddingRight,
                  bottom: computedSpacing.paddingBottom,
                  left: computedSpacing.paddingLeft,
                }}
                onChange={onUpdateSpacing}
              />
            </div>

            <div>
              <div className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Margin</div>
              <MarginInputs
                values={{
                  top: computedSpacing.marginTop,
                  right: computedSpacing.marginRight,
                  bottom: computedSpacing.marginBottom,
                  left: computedSpacing.marginLeft,
                }}
                onChange={onUpdateSpacing}
              />
            </div>
          </div>
        </CollapsibleSection>

        <CollapsibleSection
          title="Radius"
          isOpen={sections.radius ?? true}
          onToggle={() => toggleSection('radius')}
        >
          <BorderRadiusInputs
            values={{
              topLeft: computedBorderRadius.borderTopLeftRadius,
              topRight: computedBorderRadius.borderTopRightRadius,
              bottomRight: computedBorderRadius.borderBottomRightRadius,
              bottomLeft: computedBorderRadius.borderBottomLeftRadius,
            }}
            onChange={onUpdateBorderRadius}
          />
        </CollapsibleSection>

        {computedColor && (
          <CollapsibleSection
            title="Fill"
            isOpen={sections.fill ?? true}
            onToggle={() => toggleSection('fill')}
          >
            <FillSection
              backgroundColor={computedColor.backgroundColor}
              textColor={computedColor.color}
              onBackgroundChange={(value) => onUpdateColor('backgroundColor', value)}
              onTextChange={(value) => onUpdateColor('color', value)}
              hasTextContent={hasTextContent}
            />
          </CollapsibleSection>
        )}

        {elementInfo.isTextElement && computedTypography && (
          <CollapsibleSection
            title="Text"
            isOpen={sections.text ?? true}
            onToggle={() => toggleSection('text')}
          >
            <TypographyInputs
              typography={computedTypography}
              onUpdate={onUpdateTypography}
            />
          </CollapsibleSection>
        )}
      </div>

      <div className="flex shrink-0 items-center justify-between border-t bg-muted/30 px-3 py-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onReset}
          disabled={!hasPendingChanges}
          className="text-xs"
        >
          <RotateCcw className="mr-1 size-3" />
          Reset
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleCopy}
          disabled={!hasPendingChanges}
          className="text-xs"
        >
          {copyError ? (
            <>
              <X className="mr-1 size-3" />
              Copy failed
            </>
          ) : copied ? (
            <>
              <Check className="mr-1 size-3" />
              Copied! Paste to AI agent
            </>
          ) : (
            <>
              <Copy className="mr-1 size-3" />
              Export edits
            </>
          )}
        </Button>
      </div>
    </div>
  )
}

function DirectEditPanelContent() {
  const container = usePortalContainer()
  const {
    isOpen,
    closePanel,
    elementInfo,
    computedSpacing,
    computedBorderRadius,
    computedFlex,
    computedSizing,
    computedColor,
    computedTypography,
    updateSpacingProperty,
    updateBorderRadiusProperty,
    updateFlexProperty,
    updateSizingProperty,
    updateColorProperty,
    updateTypographyProperty,
    resetToOriginal,
    exportEdits,
    pendingStyles,
    selectParent,
    selectChild,
    selectElement,
    editModeActive,
    selectedElement,
  } = useDirectEdit()

  const [position, setPosition] = React.useState<Position>(getInitialPosition)
  const [isDragging, setIsDragging] = React.useState(false)
  const [dragOffset, setDragOffset] = React.useState<Position>({ x: 0, y: 0 })
  const [hoverHighlight, setHoverHighlight] = React.useState<{
    flexContainer: HTMLElement
    children: HTMLElement[]
  } | null>(null)
  const panelRef = React.useRef<HTMLDivElement>(null)

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!panelRef.current) return

    const rect = panelRef.current.getBoundingClientRect()
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    })
    setIsDragging(true)
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return

    const newX = Math.max(0, Math.min(window.innerWidth - PANEL_WIDTH, e.clientX - dragOffset.x))
    const newY = Math.max(0, Math.min(window.innerHeight - PANEL_HEIGHT, e.clientY - dragOffset.y))

    setPosition({ x: newX, y: newY })
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDragging) return

    setIsDragging(false)
    ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)

    localStorage.setItem(STORAGE_KEY, JSON.stringify(position))
  }

  React.useEffect(() => {
    function handleResize() {
      setPosition((prev) => ({
        x: Math.min(prev.x, window.innerWidth - PANEL_WIDTH - 20),
        y: Math.min(prev.y, window.innerHeight - PANEL_HEIGHT - 20),
      }))
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const { isActive: measurementActive, hoveredElement, measurements, mousePosition } = useMeasurement(
    isOpen ? selectedElement : null
  )

  const {
    dragState,
    dropIndicator,
    startDrag,
  } = useMove({
    onMoveComplete: selectElement,
  })

  const overlay = editModeActive && container ? createPortal(
    <>
      <div
        data-direct-edit="overlay"
        className="fixed inset-0 z-[99990] cursor-default"
        style={{ pointerEvents: 'auto' }}
        onMouseMove={(e) => {
          const el = e.currentTarget
          el.style.pointerEvents = 'none'
          const elementUnder = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null
          el.style.pointerEvents = 'auto'

          if (
            elementUnder &&
            elementUnder !== document.body &&
            elementUnder !== document.documentElement &&
            !elementUnder.closest('[data-direct-edit]') &&
            !elementUnder.closest('[data-direct-edit-host]') &&
            elementUnder !== selectedElement
          ) {
            // Check if elementUnder itself is a flex container
            const ownDisplay = getComputedStyle(elementUnder).display
            if (ownDisplay === 'flex' || ownDisplay === 'inline-flex') {
              setHoverHighlight({
                flexContainer: elementUnder,
                children: Array.from(elementUnder.children).filter(
                  (child): child is HTMLElement => child instanceof HTMLElement
                ),
              })
              return
            }

            // Walk up to find a flex parent
            let current: HTMLElement | null = elementUnder
            while (current && current !== document.body) {
              const parent: HTMLElement | null = current.parentElement
              if (parent) {
                const display = getComputedStyle(parent).display
                if (display === 'flex' || display === 'inline-flex') {
                  setHoverHighlight({
                    flexContainer: parent,
                    children: Array.from(parent.children).filter(
                      (child): child is HTMLElement => child instanceof HTMLElement
                    ),
                  })
                  return
                }
              }
              current = parent
            }
            setHoverHighlight({ flexContainer: elementUnder, children: [] })
          } else {
            setHoverHighlight(null)
          }
        }}
        onMouseLeave={() => setHoverHighlight(null)}
        onClick={(e) => {
          e.preventDefault()
          setHoverHighlight(null)
          const el = e.currentTarget
          el.style.pointerEvents = 'none'
          const elementUnder = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null
          el.style.pointerEvents = 'auto'

          if (elementUnder && elementUnder !== document.body && elementUnder !== document.documentElement) {
            let current: HTMLElement | null = elementUnder
            while (current && current !== document.body) {
              const parent: HTMLElement | null = current.parentElement
              if (parent) {
                const display = getComputedStyle(parent).display
                if (display === 'flex' || display === 'inline-flex') {
                  selectElement(current)
                  return
                }
              }
              current = parent
            }
            selectElement(elementUnder)
          }
        }}
      />
      {hoverHighlight && (() => {
        const cr = hoverHighlight.flexContainer.getBoundingClientRect()
        return (
          <svg
            data-direct-edit="hover-highlight"
            className="pointer-events-none fixed inset-0 z-[99991]"
            width="100%"
            height="100%"
            style={{ width: '100vw', height: '100vh' }}
          >
            <rect
              x={cr.left}
              y={cr.top}
              width={cr.width}
              height={cr.height}
              fill="transparent"
              stroke="#3b82f6"
              strokeWidth={1}
            />
            {hoverHighlight.children.map((child, i) => {
              const r = child.getBoundingClientRect()
              return (
                <rect
                  key={i}
                  x={r.left}
                  y={r.top}
                  width={r.width}
                  height={r.height}
                  fill="transparent"
                  stroke="#3b82f6"
                  strokeWidth={1}
                  strokeDasharray="4 2"
                />
              )
            })}
          </svg>
        )
      })()}
    </>,
    container
  ) : null

  if (!isOpen || !computedSpacing || !elementInfo || !computedBorderRadius || !computedFlex || !computedSizing || !computedColor || !computedTypography || !container) return overlay

  const handleMoveStart = (e: React.PointerEvent) => {
    if (selectedElement) {
      startDrag(e, selectedElement)
    }
  }

  return createPortal(
    <>
      {overlay}

      {selectedElement && (
        <SelectionOverlay
          selectedElement={selectedElement}
          isDragging={dragState.isDragging}
          ghostPosition={dragState.ghostPosition}
          onMoveStart={handleMoveStart}
        />
      )}

      {dragState.isDragging && (
        <MoveOverlay dropIndicator={dropIndicator} />
      )}

      {measurementActive && selectedElement && (
        <MeasurementOverlay
          selectedElement={selectedElement}
          hoveredElement={hoveredElement}
          measurements={[
            ...measurements,
            ...calculateGuidelineMeasurements(selectedElement, getStoredGuidelines(), mousePosition),
          ]}
        />
      )}

      <DirectEditPanelInner
        elementInfo={elementInfo}
        computedSpacing={computedSpacing}
        computedBorderRadius={computedBorderRadius}
        computedFlex={computedFlex}
        computedSizing={computedSizing}
        computedColor={computedColor}
        computedTypography={computedTypography}
        pendingStyles={pendingStyles}
        onClose={closePanel}
        onSelectParent={selectParent}
        onSelectChild={selectChild}
        onUpdateSpacing={updateSpacingProperty}
        onUpdateBorderRadius={updateBorderRadiusProperty}
        onUpdateFlex={updateFlexProperty}
        onUpdateSizing={updateSizingProperty}
        onUpdateColor={updateColorProperty}
        onUpdateTypography={updateTypographyProperty}
        onReset={resetToOriginal}
        onExportEdits={exportEdits}
        className="fixed z-[99999]"
        style={{
          left: position.x,
          top: position.y,
          maxHeight: PANEL_HEIGHT,
          pointerEvents: 'auto',
        }}
        panelRef={panelRef}
        isDragging={isDragging}
        onHeaderPointerDown={handlePointerDown}
        onHeaderPointerMove={handlePointerMove}
        onHeaderPointerUp={handlePointerUp}
      />
    </>,
    container
  )
}

export function DirectEditPanel() {
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return null
  }

  return <DirectEditPanelContent />
}
