import * as React from 'react'
import { createPortal } from 'react-dom'
import { usePortalContainer } from './portal-container'
import { useDirectEdit } from './provider'
import { Button } from './ui/button'
import { Input } from './ui/input'
import {
  Tooltip,
  TooltipProvider,
  TooltipTrigger,
  TooltipContent,
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
import type { SpacingPropertyKey, BorderRadiusPropertyKey, BorderPropertyKey, BorderProperties, BorderStyle, CSSPropertyValue, SizingValue, SizingMode, SizingPropertyKey, ColorValue, ColorPropertyKey, TypographyPropertyKey, TypographyProperties } from './types'
import { formatColorValue } from './ui/color-utils'
import { ColorPickerPopover, ColorPickerGroup } from './ui/color-picker'
import { Slider } from './ui/slider'
import { useMeasurement } from './use-measurement'
import { MeasurementOverlay } from './measurement-overlay'
import { useMove } from './use-move'
import { getStoredGuidelines } from './use-guidelines'
import {
  calculateGuidelineMeasurements, isTextElement,
  resolveElementTarget, computeHoverHighlight,
  elementFromPointWithoutOverlays, findChildAtPoint,
} from './utils'
import { MoveOverlay } from './move-overlay'
import { SelectionOverlay } from './selection-overlay'
import { CommentOverlay } from './comment-overlay'
import {
  X,
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
  ChevronsLeftRightEllipsis,
  Grid2x2,
  Columns2,
  ChevronsUpDown,
  Paintbrush,
  Square,
  Focus,
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
  Plus,
  Minus,
  Send,
  Link,
  Unlink,
} from 'lucide-react'

const STORAGE_KEY = 'direct-edit-panel-position'
const PANEL_WIDTH = 300
const PANEL_HEIGHT = 420

const selectOnFocus = (e: React.FocusEvent<HTMLInputElement>) => e.target.select()

interface NumberInputProps extends Omit<React.ComponentProps<typeof Input>, 'value' | 'onChange' | 'type'> {
  value: number
  onValueChange: (value: number) => void
}

function NumberInput({ value: propValue, onValueChange, ...props }: NumberInputProps) {
  const [localValue, setLocalValue] = React.useState(String(propValue))

  React.useEffect(() => {
    setLocalValue(String(propValue))
  }, [propValue])

  return (
    <Input
      {...props}
      type="number"
      value={localValue}
      onChange={(e) => {
        setLocalValue(e.target.value)
        const parsed = parseFloat(e.target.value)
        if (!isNaN(parsed)) onValueChange(parsed)
      }}
      onBlur={() => {
        if (localValue === '' || isNaN(parseFloat(localValue))) {
          setLocalValue(String(propValue))
        }
      }}
      onFocus={selectOnFocus}
    />
  )
}

function Tip({ children, label, side = 'top' }: { children: React.ReactElement; label: React.ReactNode; side?: 'top' | 'bottom' | 'left' | 'right' }) {
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipContent side={side}>{label}</TooltipContent>
    </Tooltip>
  )
}

interface Position {
  x: number
  y: number
}

function getInitialPosition(): Position {
  if (typeof window === 'undefined') {
    return { x: 0, y: 0 }
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      return JSON.parse(stored)
    }
  } catch {
    // Fall through to default
  }

  return {
    x: window.innerWidth - PANEL_WIDTH - 20,
    y: window.innerHeight - PANEL_HEIGHT - 20,
  }
}

const DISTRIBUTE_MODES = ['fixed', 'space-between', 'space-around', 'space-evenly'] as const
type DistributeMode = typeof DISTRIBUTE_MODES[number]
const DISTRIBUTE_LABELS: Record<DistributeMode, string> = {
  fixed: 'Fixed',
  'space-between': 'Between',
  'space-around': 'Around',
  'space-evenly': 'Evenly',
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
          <Tip label="Left">
            <div className="relative flex-1">
              <ArrowLeft className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <NumberInput
                value={values.left?.numericValue ?? 0}
                onValueChange={(val) => handleChange(['left'], val)}
                className="h-7 pl-7 pr-2 text-center text-xs tabular-nums"
              />
            </div>
          </Tip>
          <Tip label="Top">
            <div className="relative flex-1">
              <ArrowUp className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <NumberInput
                value={values.top?.numericValue ?? 0}
                onValueChange={(val) => handleChange(['top'], val)}
                className="h-7 pl-7 pr-2 text-center text-xs tabular-nums"
              />
            </div>
          </Tip>
          <Tip label="Combined mode">
            <Button
              variant="secondary"
              size="icon"
              className="size-7 shrink-0"
              onClick={() => setIndividual(false)}
            >
              <Columns2 className="size-3.5" />
            </Button>
          </Tip>
        </div>
        <div className="flex items-center gap-1.5">
          <Tip label="Right">
            <div className="relative flex-1">
              <ArrowRight className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <NumberInput
                value={values.right?.numericValue ?? 0}
                onValueChange={(val) => handleChange(['right'], val)}
                className="h-7 pl-7 pr-2 text-center text-xs tabular-nums"
              />
            </div>
          </Tip>
          <Tip label="Bottom">
            <div className="relative flex-1">
              <ArrowDown className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <NumberInput
                value={values.bottom?.numericValue ?? 0}
                onValueChange={(val) => handleChange(['bottom'], val)}
                className="h-7 pl-7 pr-2 text-center text-xs tabular-nums"
              />
            </div>
          </Tip>
          <div className="size-7 shrink-0" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1.5">
      <Tip label="Horizontal (left & right)">
        <div className="relative flex-1">
          <MoveHorizontal className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <NumberInput
            value={horizontalValue}
            onValueChange={(val) => handleChange(['left', 'right'], val)}
            className="h-7 pl-7 pr-2 text-center text-xs tabular-nums"
          />
        </div>
      </Tip>
      <Tip label="Vertical (top & bottom)">
        <div className="relative flex-1">
          <MoveVertical className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <NumberInput
            value={verticalValue}
            onValueChange={(val) => handleChange(['top', 'bottom'], val)}
            className="h-7 pl-7 pr-2 text-center text-xs tabular-nums"
          />
        </div>
      </Tip>
      <Tip label="Individual mode">
        <Button
          variant="ghost"
          size="icon"
          className="size-7 shrink-0 text-muted-foreground"
          onClick={() => setIndividual(true)}
        >
          <Grid2x2 className="size-3.5" />
        </Button>
      </Tip>
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
          <Tip label="Left">
            <div className="relative flex-1">
              <ArrowLeft className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <NumberInput
                value={values.left?.numericValue ?? 0}
                onValueChange={(val) => handleChange(['left'], val)}
                className="h-7 pl-7 pr-2 text-center text-xs tabular-nums"
              />
            </div>
          </Tip>
          <Tip label="Top">
            <div className="relative flex-1">
              <ArrowUp className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <NumberInput
                value={values.top?.numericValue ?? 0}
                onValueChange={(val) => handleChange(['top'], val)}
                className="h-7 pl-7 pr-2 text-center text-xs tabular-nums"
              />
            </div>
          </Tip>
          <Tip label="Combined mode">
            <Button
              variant="secondary"
              size="icon"
              className="size-7 shrink-0"
              onClick={() => setIndividual(false)}
            >
              <Columns2 className="size-3.5" />
            </Button>
          </Tip>
        </div>
        <div className="flex items-center gap-1.5">
          <Tip label="Right">
            <div className="relative flex-1">
              <ArrowRight className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <NumberInput
                value={values.right?.numericValue ?? 0}
                onValueChange={(val) => handleChange(['right'], val)}
                className="h-7 pl-7 pr-2 text-center text-xs tabular-nums"
              />
            </div>
          </Tip>
          <Tip label="Bottom">
            <div className="relative flex-1">
              <ArrowDown className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <NumberInput
                value={values.bottom?.numericValue ?? 0}
                onValueChange={(val) => handleChange(['bottom'], val)}
                className="h-7 pl-7 pr-2 text-center text-xs tabular-nums"
              />
            </div>
          </Tip>
          <div className="size-7 shrink-0" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1.5">
      <Tip label="Horizontal (left & right)">
        <div className="relative flex-1">
          <MoveHorizontal className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <NumberInput
            value={horizontalValue}
            onValueChange={(val) => handleChange(['left', 'right'], val)}
            className="h-7 pl-7 pr-2 text-center text-xs tabular-nums"
          />
        </div>
      </Tip>
      <Tip label="Vertical (top & bottom)">
        <div className="relative flex-1">
          <MoveVertical className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <NumberInput
            value={verticalValue}
            onValueChange={(val) => handleChange(['top', 'bottom'], val)}
            className="h-7 pl-7 pr-2 text-center text-xs tabular-nums"
          />
        </div>
      </Tip>
      <Tip label="Individual mode">
        <Button
          variant="ghost"
          size="icon"
          className="size-7 shrink-0 text-muted-foreground"
          onClick={() => setIndividual(true)}
        >
          <Grid2x2 className="size-3.5" />
        </Button>
      </Tip>
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

function RadiusCornerIcon({ corner, className }: { corner: 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight'; className?: string }) {
  const paths: Record<string, string> = {
    topLeft: 'M5 19V8a3 3 0 0 1 3-3h11',
    topRight: 'M19 19V8a3 3 0 0 0-3-3H5',
    bottomLeft: 'M5 5v11a3 3 0 0 0 3 3h11',
    bottomRight: 'M19 5v11a3 3 0 0 1-3 3H5',
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={cn('size-3', className)}>
      <path d={paths[corner]} />
    </svg>
  )
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
          <Tip label="Top Left">
            <div className="relative flex-1">
              <RadiusCornerIcon corner="topLeft" className="absolute left-1.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <NumberInput
                value={values.topLeft?.numericValue ?? 0}
                onValueChange={(val) => handleChange(['topLeft'], val)}
                className="h-7 pl-6 pr-1 text-center text-xs tabular-nums"
              />
            </div>
          </Tip>
          <Tip label="Top Right">
            <div className="relative flex-1">
              <RadiusCornerIcon corner="topRight" className="absolute left-1.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <NumberInput
                value={values.topRight?.numericValue ?? 0}
                onValueChange={(val) => handleChange(['topRight'], val)}
                className="h-7 pl-6 pr-1 text-center text-xs tabular-nums"
              />
            </div>
          </Tip>
          <Tip label="Combined mode">
            <Button
              variant="secondary"
              size="icon"
              className="size-7 shrink-0"
              onClick={() => setIndividual(false)}
            >
              <Columns2 className="size-3.5" />
            </Button>
          </Tip>
        </div>
        <div className="flex items-center gap-1.5">
          <Tip label="Bottom Left">
            <div className="relative flex-1">
              <RadiusCornerIcon corner="bottomLeft" className="absolute left-1.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <NumberInput
                value={values.bottomLeft?.numericValue ?? 0}
                onValueChange={(val) => handleChange(['bottomLeft'], val)}
                className="h-7 pl-6 pr-1 text-center text-xs tabular-nums"
              />
            </div>
          </Tip>
          <Tip label="Bottom Right">
            <div className="relative flex-1">
              <RadiusCornerIcon corner="bottomRight" className="absolute left-1.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <NumberInput
                value={values.bottomRight?.numericValue ?? 0}
                onValueChange={(val) => handleChange(['bottomRight'], val)}
                className="h-7 pl-6 pr-1 text-center text-xs tabular-nums"
              />
            </div>
          </Tip>
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
      <Tip label="Individual mode">
        <Button
          variant="ghost"
          size="icon"
          className="size-7 shrink-0 text-muted-foreground"
          onClick={() => setIndividual(true)}
        >
          <Grid2x2 className="size-3.5" />
        </Button>
      </Tip>
    </div>
  )
}

function BorderSideIcon({ side, className }: { side: 'Top' | 'Right' | 'Bottom' | 'Left'; className?: string }) {
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

const BORDER_STYLE_OPTIONS: Array<{ value: BorderStyle; label: string }> = [
  { value: 'solid', label: 'Solid' },
  { value: 'dashed', label: 'Dashed' },
  { value: 'dotted', label: 'Dotted' },
]

type BorderPosition = 'border' | 'outline'
const BORDER_POSITION_OPTIONS: Array<{ value: BorderPosition; label: string }> = [
  { value: 'border', label: 'Border' },
  { value: 'outline', label: 'Outline' },
]

const BORDER_SIDES = ['Top', 'Right', 'Bottom', 'Left'] as const

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
  onPositionChange: (position: BorderPosition) => void
  outlineStyle?: BorderStyle
  outlineWidth?: number
}

const BORDER_SIDE_OPTIONS = ['All', 'Top', 'Right', 'Bottom', 'Left', 'Custom'] as const
type BorderSideOption = typeof BORDER_SIDE_OPTIONS[number]

function BorderInputs({ border, borderColor, outlineColor, onChange, onBatchChange, onBorderColorChange, onOutlineColorChange, onSetCSS, borderPosition, onPositionChange, outlineStyle, outlineWidth }: BorderInputsProps) {
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

  return (
    <div className="space-y-2">
      {/* Row 1: Color */}
      {activeColor && activeColorChange && (
        <ColorInput
          id={isOutline ? 'outline-color' : 'border-color'}
          label={isOutline ? 'Outline' : 'Border'}
          icon={isOutline ? <Focus className="size-3.5" /> : <Square className="size-3.5" />}
          value={activeColor}
          onChange={activeColorChange}
        />
      )}

      {/* Row 2: Position + Style + Width + Side — all on one row */}
      <div className="flex items-center gap-1.5">
        <Select value={borderPosition} onValueChange={(val) => val && onPositionChange(val as BorderPosition)}>
          <SelectTrigger className="flex h-7 flex-1 items-center justify-between rounded-md border-0 bg-muted px-2 text-xs hover:bg-muted-foreground/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
            <span>{BORDER_POSITION_OPTIONS.find((o) => o.value === borderPosition)?.label}</span>
            <SelectIcon>
              <ChevronDown className="size-3.5 text-muted-foreground" />
            </SelectIcon>
          </SelectTrigger>
          <SelectPortal>
            <SelectPositioner sideOffset={4} className="z-[99999]">
              <SelectPopup className="min-w-[100px] overflow-hidden rounded-xl outline outline-1 outline-foreground/10 bg-background p-1 text-popover-foreground shadow-lg animate-in fade-in-0 zoom-in-95">
                {BORDER_POSITION_OPTIONS.map((option) => (
                  <SelectItem
                    key={option.value}
                    value={option.value}
                    className="relative flex cursor-default select-none items-center rounded-md py-1.5 pl-6 pr-2 text-xs outline-none hover:bg-muted data-[highlighted]:bg-muted"
                  >
                    <SelectItemIndicator className="absolute left-1.5 flex items-center justify-center">
                      <Check className="size-3.5" />
                    </SelectItemIndicator>
                    <SelectItemText>{option.label}</SelectItemText>
                  </SelectItem>
                ))}
              </SelectPopup>
            </SelectPositioner>
          </SelectPortal>
        </Select>

        <Select value={currentStyle} onValueChange={(val) => val && handleStyleChange(val as BorderStyle)}>
          <SelectTrigger className="flex h-7 flex-1 items-center justify-between rounded-md border-0 bg-muted px-2 text-xs hover:bg-muted-foreground/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
            <span className="flex items-center gap-1.5">
              <Square className="size-3.5 text-muted-foreground" />
              <span>{BORDER_STYLE_OPTIONS.find((o) => o.value === currentStyle)?.label ?? currentStyle}</span>
            </span>
            <SelectIcon>
              <ChevronDown className="size-3.5 text-muted-foreground" />
            </SelectIcon>
          </SelectTrigger>
          <SelectPortal>
            <SelectPositioner sideOffset={4} className="z-[99999]">
              <SelectPopup className="min-w-[100px] overflow-hidden rounded-xl outline outline-1 outline-foreground/10 bg-background p-1 text-popover-foreground shadow-lg animate-in fade-in-0 zoom-in-95">
                {BORDER_STYLE_OPTIONS.map((option) => (
                  <SelectItem
                    key={option.value}
                    value={option.value}
                    className="relative flex cursor-default select-none items-center rounded-md py-1.5 pl-6 pr-2 text-xs outline-none hover:bg-muted data-[highlighted]:bg-muted"
                  >
                    <SelectItemIndicator className="absolute left-1.5 flex items-center justify-center">
                      <Check className="size-3.5" />
                    </SelectItemIndicator>
                    <SelectItemText>{option.label}</SelectItemText>
                  </SelectItem>
                ))}
              </SelectPopup>
            </SelectPositioner>
          </SelectPortal>
        </Select>

        <Tip label={isOutline ? 'Outline width' : 'Border width'}>
          <div>
            <NumberInput
              min={0}
              step={0.5}
              value={typeof currentWidth === 'number' ? Math.round(currentWidth * 100) / 100 : 0}
              placeholder={currentWidth === null ? '–' : undefined}
              onValueChange={handleAllWidthChange}
              className="h-7 w-11 px-2 text-center text-xs tabular-nums"
            />
          </div>
        </Tip>

        {!isOutline && (
          <Select value={selectedSide} onValueChange={(val) => val && setSelectedSide(val as BorderSideOption)}>
            <Tip label={`Sides: ${selectedSide}`}>
              <SelectTrigger className="flex size-7 shrink-0 items-center justify-center rounded-md border-0 bg-muted text-muted-foreground hover:bg-muted-foreground/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                {selectedSide === 'Custom' ? (
                  <Grid2x2 className="size-3.5" strokeWidth={1} />
                ) : selectedSide === 'All' ? (
                  <Square className="size-3.5" />
                ) : (
                  <BorderSideIcon side={selectedSide} className="" />
                )}
              </SelectTrigger>
            </Tip>
            <SelectPortal>
              <SelectPositioner sideOffset={4} className="z-[99999]">
                <SelectPopup className="min-w-[90px] overflow-hidden rounded-xl outline outline-1 outline-foreground/10 bg-background p-1 text-popover-foreground shadow-lg animate-in fade-in-0 zoom-in-95">
                  {BORDER_SIDE_OPTIONS.map((side) => (
                    <SelectItem
                      key={side}
                      value={side}
                      className="relative flex cursor-default select-none items-center rounded-md py-1.5 pl-6 pr-2 text-xs outline-none hover:bg-muted data-[highlighted]:bg-muted"
                    >
                      <SelectItemIndicator className="absolute left-1.5 flex items-center justify-center">
                        <Check className="size-3.5" />
                      </SelectItemIndicator>
                      <SelectItemText>{side}</SelectItemText>
                    </SelectItem>
                  ))}
                </SelectPopup>
              </SelectPositioner>
            </SelectPortal>
          </Select>
        )}
      </div>

      {!isOutline && selectedSide === 'Custom' && (
        <div className="grid grid-cols-2 gap-1.5">
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
    </div>
  )
}

interface BorderSectionProps {
  border: BorderProperties
  borderColor?: ColorValue
  outlineColor?: ColorValue
  onChange: (key: BorderPropertyKey, value: BorderProperties[BorderPropertyKey]) => void
  onBatchChange: (changes: Array<[BorderPropertyKey, BorderProperties[BorderPropertyKey]]>) => void
  onBorderColorChange?: (value: ColorValue) => void
  onOutlineColorChange?: (value: ColorValue) => void
  onSetCSS?: (properties: Record<string, string>) => void
  pendingStyles?: Record<string, string>
}

function BorderSection({ border, borderColor, outlineColor, onChange, onBatchChange, onBorderColorChange, onOutlineColorChange, onSetCSS, pendingStyles }: BorderSectionProps) {
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
      <button
        type="button"
        className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-muted-foreground/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        onClick={hasBorder ? handleRemoveBorder : handleAddBorder}
      >
        {hasBorder ? <Minus className="size-3.5" /> : <Plus className="size-3.5" />}
      </button>
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
            onPositionChange={handlePositionChange}
            outlineStyle={outlineStyleValue}
            outlineWidth={outlineWidthValue}
          />
        </ColorPickerGroup>
      ) : null}
    </CollapsibleSection>
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
      <div className="grid grid-cols-3 gap-0.5 rounded-md bg-muted p-0.5">
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
                      'flex size-7 items-center justify-center rounded transition-all',
                      isActive
                        ? 'bg-background shadow-sm'
                        : 'hover:bg-muted-foreground/10'
                    )}
                    onClick={() => onChange(justify, align)}
                  >
                    {isActive ? (
                      <div
                        className="flex size-full gap-[2px] p-1"
                        style={{ justifyContent: justify, alignItems: align }}
                      >
                        <span className="h-2 w-[1.5px] rounded-full bg-blue-500" />
                        <span className="h-2 w-[1.5px] rounded-full bg-blue-500" />
                        <span className="h-2 w-[1.5px] rounded-full bg-blue-500" />
                      </div>
                    ) : (
                      <span className="size-1 rounded-full bg-muted-foreground/30" />
                    )}
                  </button>
                }
              />
            )
          })
        )}
      </div>
      <Tooltip handle={tooltipHandle}>
        {({ payload }) => (
          <TooltipContent side="bottom" sideOffset={8} className="flex flex-col">
            justify: {payload?.justify}, align: {payload?.align}
          </TooltipContent>
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

function SizingFixedInput({ value, onValueChange }: { value: number; onValueChange: (v: number) => void }) {
  const [localValue, setLocalValue] = React.useState(String(value))

  React.useEffect(() => {
    setLocalValue(String(value))
  }, [value])

  return (
    <input
      type="number"
      value={localValue}
      onChange={(e) => {
        setLocalValue(e.target.value)
        const parsed = parseFloat(e.target.value)
        if (!isNaN(parsed)) onValueChange(parsed)
      }}
      onBlur={() => {
        if (localValue === '' || isNaN(parseFloat(localValue))) {
          setLocalValue(String(value))
        }
      }}
      onFocus={selectOnFocus}
      className="w-full min-w-0 flex-1 bg-transparent text-xs tabular-nums outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [appearance:textfield]"
    />
  )
}

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

  return (
    <div className="flex h-7 flex-1 items-center overflow-hidden rounded-md border-0 bg-muted text-xs focus-within:outline-none focus-within:ring-1 focus-within:ring-inset focus-within:ring-ring">
      <span className="flex flex-1 items-center gap-1.5 px-2">
        <span className="text-muted-foreground">{label}</span>
        {value.mode === 'fixed' ? (
          <SizingFixedInput
            value={Math.round(value.value.numericValue)}
            onValueChange={handleFixedValueChange}
          />
        ) : (
          <span className="flex flex-1 items-center gap-1">
            <span className="tabular-nums text-muted-foreground">{Math.round(value.value.numericValue)}</span>
            <span>{value.mode === 'fill' ? 'Fill' : 'Fit'}</span>
          </span>
        )}
      </span>
      <Select value={value.mode} onValueChange={(val) => {
        if (val) onChange({ mode: val as SizingMode, value: value.value })
      }}>
        <SelectTrigger className="flex h-full items-center justify-center border-l border-border/30 px-1.5 hover:bg-muted-foreground/10 focus-visible:outline-none">
          <ChevronsUpDown className="size-3.5 text-muted-foreground" />
        </SelectTrigger>
        <SelectPortal>
          <SelectPositioner side="bottom" sideOffset={4} alignItemWithTrigger={false} className="z-[99999]">
            <SelectPopup className="min-w-[100px] overflow-hidden rounded-xl outline outline-1 outline-foreground/10 bg-background p-1 text-popover-foreground shadow-lg animate-in fade-in-0 zoom-in-95">
              {SIZING_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value} className="relative flex cursor-default select-none items-center rounded-md py-1.5 pl-6 pr-2 text-xs outline-none hover:bg-muted data-[highlighted]:bg-muted">
                  <SelectItemIndicator className="absolute left-1.5 flex items-center justify-center">
                    <Check className="size-3.5" />
                  </SelectItemIndicator>
                  <SelectItemText>{option.label}</SelectItemText>
                </SelectItem>
              ))}
            </SelectPopup>
          </SelectPositioner>
        </SelectPortal>
      </Select>
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
  const { selectedElement } = useDirectEdit()
  const [locked, setLocked] = React.useState(false)
  const ratioRef = React.useRef<number>(1)

  React.useEffect(() => {
    setLocked(false)
  }, [selectedElement])

  const canLock = width.mode === 'fixed' && height.mode === 'fixed' && height.value.numericValue > 0 && width.value.numericValue > 0

  const handleLockToggle = () => {
    if (!locked && canLock) {
      ratioRef.current = width.value.numericValue / height.value.numericValue
    }
    setLocked(!locked)
  }

  const handleWidthChange = (value: SizingValue) => {
    onWidthChange(value)
    if (locked && value.mode === 'fixed' && height.mode === 'fixed' && ratioRef.current > 0) {
      const newHeight = Math.round(value.value.numericValue / ratioRef.current)
      onHeightChange({
        mode: 'fixed',
        value: { numericValue: newHeight, unit: height.value.unit, raw: `${newHeight}${height.value.unit}` },
      })
    }
  }

  const handleHeightChange = (value: SizingValue) => {
    onHeightChange(value)
    if (locked && value.mode === 'fixed' && width.mode === 'fixed' && ratioRef.current > 0) {
      const newWidth = Math.round(value.value.numericValue * ratioRef.current)
      onWidthChange({
        mode: 'fixed',
        value: { numericValue: newWidth, unit: width.value.unit, raw: `${newWidth}${width.value.unit}` },
      })
    }
  }

  return (
    <div className="flex items-center gap-2">
      <SizingDropdown label="W" value={width} onChange={handleWidthChange} />
      <SizingDropdown label="H" value={height} onChange={handleHeightChange} />
      <Tip label={locked ? 'Unlock aspect ratio' : 'Lock aspect ratio'}>
        <Button
          variant={locked ? 'secondary' : 'ghost'}
          size="icon"
          className="size-7 shrink-0"
          onClick={handleLockToggle}
          disabled={!canLock}
        >
          {locked ? <Link className="size-3.5" /> : <Unlink className="size-3.5" />}
        </Button>
      </Tip>
    </div>
  )
}

interface ColorInputProps {
  id?: string
  label: string
  icon: React.ReactNode
  value: ColorValue
  onChange: (value: ColorValue) => void
}

function ColorInput({ id, label, icon, value, onChange }: ColorInputProps) {
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
        <SelectTrigger className="flex h-7 w-full items-center justify-between rounded-md border-0 bg-muted px-2 text-xs hover:bg-muted-foreground/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
          <span className="flex items-center gap-2">
            <Type className="size-3.5 text-muted-foreground" />
            <span>{getFontFamilyLabel(typography.fontFamily)}</span>
          </span>
          <SelectIcon>
            <ChevronDown className="size-3.5 text-muted-foreground" />
          </SelectIcon>
        </SelectTrigger>
        <SelectPortal>
          <SelectPositioner sideOffset={4} className="z-[99999]">
            <SelectPopup className="min-w-[180px] overflow-hidden rounded-xl outline outline-1 outline-foreground/10 bg-background p-1 text-popover-foreground shadow-lg animate-in fade-in-0 zoom-in-95">
              {FONT_FAMILIES.map((option) => (
                <SelectItem
                  key={option.value}
                  value={option.value}
                  className="relative flex cursor-default select-none items-center rounded-md py-2 pl-7 pr-2 text-xs outline-none hover:bg-muted hover:text-foreground data-[highlighted]:bg-muted data-[highlighted]:text-foreground"
                >
                  <SelectItemIndicator className="absolute left-2 flex items-center justify-center">
                    <Check className="size-3.5" />
                  </SelectItemIndicator>
                  <SelectItemText>{option.label}</SelectItemText>
                </SelectItem>
              ))}
            </SelectPopup>
          </SelectPositioner>
        </SelectPortal>
      </Select>

      <Select value={typography.fontWeight} onValueChange={(val) => val && onUpdate('fontWeight', val)}>
        <SelectTrigger className="flex h-7 w-full items-center justify-between rounded-md border-0 bg-muted px-2 text-xs hover:bg-muted-foreground/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
          <span className="flex items-center gap-2">
            <ALargeSmall className="size-3.5 text-muted-foreground" />
            <span>{getFontWeightLabel(typography.fontWeight)}</span>
          </span>
          <SelectIcon>
            <ChevronDown className="size-3.5 text-muted-foreground" />
          </SelectIcon>
        </SelectTrigger>
        <SelectPortal>
          <SelectPositioner sideOffset={4} className="z-[99999]">
            <SelectPopup className="min-w-[140px] overflow-hidden rounded-xl outline outline-1 outline-foreground/10 bg-background p-1 text-popover-foreground shadow-lg animate-in fade-in-0 zoom-in-95">
              {FONT_WEIGHTS.map((option) => (
                <SelectItem
                  key={option.value}
                  value={option.value}
                  className="relative flex cursor-default select-none items-center rounded-md py-2 pl-7 pr-2 text-xs outline-none hover:bg-muted hover:text-foreground data-[highlighted]:bg-muted data-[highlighted]:text-foreground"
                >
                  <SelectItemIndicator className="absolute left-2 flex items-center justify-center">
                    <Check className="size-3.5" />
                  </SelectItemIndicator>
                  <SelectItemText>{option.label}</SelectItemText>
                </SelectItem>
              ))}
            </SelectPopup>
          </SelectPositioner>
        </SelectPortal>
      </Select>

      <div className="flex gap-2">
        <Tip label="Font Size">
          <div className="relative flex-1">
            <AArrowUp className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <NumberInput
              value={Math.round(typography.fontSize.numericValue)}
              onValueChange={handleFontSizeChange}
              className="h-7 pl-7 pr-2 text-center text-xs tabular-nums"
            />
          </div>
        </Tip>
        <Tip label="Line Height">
          <div className="relative flex-1">
            <WrapText className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <NumberInput
              value={Math.round(typography.lineHeight.numericValue)}
              onValueChange={handleLineHeightChange}
              className="h-7 pl-7 pr-2 text-center text-xs tabular-nums"
            />
          </div>
        </Tip>
        <Tip label="Letter Spacing (em)">
          <div className="relative flex-1">
            <LetterText className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <NumberInput
              step="0.01"
              value={Math.round(typography.letterSpacing.numericValue * 100) / 100}
              onValueChange={handleLetterSpacingChange}
              className="h-7 pl-7 pr-2 text-center text-xs tabular-nums"
            />
          </div>
        </Tip>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex gap-1">
          <Tip label="Align Left">
            <Button
              variant="ghost"
              size="icon"
              className={typography.textAlign === 'left' || typography.textAlign === 'start' ? 'size-7 bg-muted text-foreground' : 'size-7 text-muted-foreground'}
              onClick={() => onUpdate('textAlign', 'left')}
            >
              <AlignLeft className="size-3.5" />
            </Button>
          </Tip>
          <Tip label="Align Center">
            <Button
              variant="ghost"
              size="icon"
              className={typography.textAlign === 'center' ? 'size-7 bg-muted text-foreground' : 'size-7 text-muted-foreground'}
              onClick={() => onUpdate('textAlign', 'center')}
            >
              <AlignCenter className="size-3.5" />
            </Button>
          </Tip>
          <Tip label="Align Right">
            <Button
              variant="ghost"
              size="icon"
              className={typography.textAlign === 'right' || typography.textAlign === 'end' ? 'size-7 bg-muted text-foreground' : 'size-7 text-muted-foreground'}
              onClick={() => onUpdate('textAlign', 'right')}
            >
              <AlignRight className="size-3.5" />
            </Button>
          </Tip>
        </div>

        <div className="flex gap-1">
          <Tip label="Align Top">
            <Button
              variant="ghost"
              size="icon"
              className={typography.textVerticalAlign === 'flex-start' ? 'size-7 bg-muted text-foreground' : 'size-7 text-muted-foreground'}
              onClick={() => onUpdate('textVerticalAlign', 'flex-start')}
            >
              <AlignVerticalJustifyStart className="size-3.5" />
            </Button>
          </Tip>
          <Tip label="Align Middle">
            <Button
              variant="ghost"
              size="icon"
              className={typography.textVerticalAlign === 'center' ? 'size-7 bg-muted text-foreground' : 'size-7 text-muted-foreground'}
              onClick={() => onUpdate('textVerticalAlign', 'center')}
            >
              <AlignVerticalJustifyCenter className="size-3.5" />
            </Button>
          </Tip>
          <Tip label="Align Bottom">
            <Button
              variant="ghost"
              size="icon"
              className={typography.textVerticalAlign === 'flex-end' ? 'size-7 bg-muted text-foreground' : 'size-7 text-muted-foreground'}
              onClick={() => onUpdate('textVerticalAlign', 'flex-end')}
            >
              <AlignVerticalJustifyEnd className="size-3.5" />
            </Button>
          </Tip>
        </div>
      </div>
    </div>
  )
}

interface FillSectionProps {
  backgroundColor: ColorValue
  textColor: ColorValue
  borderColor?: ColorValue
  outlineColor?: ColorValue
  onBackgroundChange: (value: ColorValue) => void
  onTextChange: (value: ColorValue) => void
  onBorderColorChange?: (value: ColorValue) => void
  onOutlineColorChange?: (value: ColorValue) => void
  hasTextContent: boolean
  showBackgroundColor?: boolean
  showBorderColor?: boolean
  showOutlineColor?: boolean
}

function FillSection({
  backgroundColor,
  textColor,
  borderColor,
  outlineColor,
  onBackgroundChange,
  onTextChange,
  onBorderColorChange,
  onOutlineColorChange,
  hasTextContent,
  showBackgroundColor,
  showBorderColor,
  showOutlineColor,
}: FillSectionProps) {
  return (
    <ColorPickerGroup>
      <div className="space-y-3">
        {showBackgroundColor && (
          <ColorInput
            id="fill-bg"
            label="Fill"
            icon={<Paintbrush className="size-3.5" />}
            value={backgroundColor}
            onChange={onBackgroundChange}
          />
        )}

        {hasTextContent && (
          <ColorInput
            id="fill-text"
            label="Text"
            icon={<Type className="size-3.5" />}
            value={textColor}
            onChange={onTextChange}
          />
        )}

        {showBorderColor && borderColor && onBorderColorChange && (
          <ColorInput
            id="fill-border"
            label="Border"
            icon={<Square className="size-3.5" />}
            value={borderColor}
            onChange={onBorderColorChange}
          />
        )}

        {showOutlineColor && outlineColor && onOutlineColorChange && (
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
interface CollapsibleSectionProps {
  title: string
  actions?: React.ReactNode
  children: React.ReactNode
}

function CollapsibleSection({ title, actions, children }: CollapsibleSectionProps) {
  return (
    <div>
      <div className="flex w-full items-center justify-between border-b border-border/50 px-3 py-2.5 text-xs font-medium text-foreground">
        <span>{title}</span>
        {actions}
      </div>
      {children != null && <div className="px-3 py-3.5">{children}</div>}
    </div>
  )
}

type SectionKey = 'layout' | 'radius' | 'border' | 'colors' | 'text'

const SECTION_LABELS: Record<SectionKey, string> = {
  layout: 'Layout',
  radius: 'Radius',
  border: 'Border',
  colors: 'Colors',
  text: 'Text',
}

function useSectionNav(sectionRefs: Record<SectionKey, React.RefObject<HTMLDivElement | null>>) {
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const [activeSection, setActiveSection] = React.useState<SectionKey>('layout')

  React.useEffect(() => {
    const scrollEl = scrollRef.current
    if (!scrollEl) return

    const handleScroll = () => {
      const keys = Object.keys(sectionRefs) as SectionKey[]
      let closest: SectionKey = 'layout'
      let closestDist = Infinity

      for (const key of keys) {
        const el = sectionRefs[key].current
        if (!el) continue
        const dist = Math.abs(el.getBoundingClientRect().top - scrollEl.getBoundingClientRect().top)
        if (dist < closestDist) {
          closestDist = dist
          closest = key
        }
      }

      setActiveSection(closest)
    }

    scrollEl.addEventListener('scroll', handleScroll, { passive: true })
    return () => scrollEl.removeEventListener('scroll', handleScroll)
  }, [sectionRefs])

  return { scrollRef, activeSection }
}

function SectionNav({
  scrollRef,
  activeSection,
  showColors,
  showText,
  sectionRefs,
}: {
  scrollRef: React.RefObject<HTMLDivElement | null>
  activeSection: SectionKey
  showColors: boolean
  showText: boolean
  sectionRefs: Record<SectionKey, React.RefObject<HTMLDivElement | null>>
}) {
  const sections: SectionKey[] = ['layout', 'radius', 'border']
  if (showText) sections.push('text')
  if (showColors) sections.push('colors')

  const handleClick = (key: SectionKey) => {
    const scrollEl = scrollRef.current
    if (!scrollEl) return
    if (key === 'layout') {
      scrollEl.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    const el = sectionRefs[key].current
    if (!el) return
    const top = el.offsetTop - scrollEl.offsetTop
    scrollEl.scrollTo({ top, behavior: 'smooth' })
  }

  return (
    <div className="flex shrink-0 gap-0.5 border-b border-border/50 px-2 py-1 bg-background">
      {sections.map((key) => (
        <button
          key={key}
          type="button"
          className={cn(
            'rounded-md px-2 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
            activeSection === key
              ? 'bg-muted text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          )}
          onClick={() => handleClick(key)}
        >
          {SECTION_LABELS[key]}
        </button>
      ))}
    </div>
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
  computedBorder: BorderProperties
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
    borderColor: ColorValue
    outlineColor: ColorValue
  } | null
  computedTypography: TypographyProperties | null
  pendingStyles: Record<string, string>
  onClose?: () => void
  onSelectParent?: () => void
  onSelectChild?: () => void
  onUpdateSpacing: (key: SpacingPropertyKey, value: CSSPropertyValue) => void
  onUpdateBorderRadius: (key: BorderRadiusPropertyKey, value: CSSPropertyValue) => void
  onUpdateBorder: (key: BorderPropertyKey, value: BorderProperties[BorderPropertyKey]) => void
  onBatchUpdateBorder: (changes: Array<[BorderPropertyKey, BorderProperties[BorderPropertyKey]]>) => void
  onSetCSS: (properties: Record<string, string>) => void
  onUpdateFlex: (key: 'flexDirection' | 'justifyContent' | 'alignItems', value: string) => void
  onToggleFlex: () => void
  onUpdateSizing: (key: SizingPropertyKey, value: SizingValue) => void
  onUpdateColor: (key: ColorPropertyKey, value: ColorValue) => void
  onUpdateTypography: (key: TypographyPropertyKey, value: CSSPropertyValue | string) => void
  onReset: () => void
  onExportEdits: () => Promise<boolean>
  onSendToAgent: () => Promise<boolean>
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
  computedBorder,
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
  onUpdateBorder,
  onBatchUpdateBorder,
  onSetCSS,
  onUpdateFlex,
  onToggleFlex,
  onUpdateSizing,
  onUpdateColor,
  onUpdateTypography,
  onReset,
  onExportEdits,
  onSendToAgent,
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
  const [sendStatus, setSendStatus] = React.useState<'idle' | 'sending' | 'sent' | 'offline'>('idle')
  const distributeMode: DistributeMode =
    computedFlex?.justifyContent === 'space-between' ||
    computedFlex?.justifyContent === 'space-around' ||
    computedFlex?.justifyContent === 'space-evenly'
      ? computedFlex.justifyContent
      : 'fixed'
  const isDistributeValue = distributeMode !== 'fixed'

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

  const handleSendToAgent = async () => {
    if (sendStatus === 'sending') return
    setSendStatus('sending')
    const success = await onSendToAgent()
    if (success) {
      setSendStatus('sent')
      setTimeout(() => setSendStatus('idle'), 2000)
    } else {
      setSendStatus('offline')
      setTimeout(() => setSendStatus('idle'), 2000)
    }
  }

  const hasPendingChanges = Object.keys(pendingStyles).length > 0
  const isDraggable = onHeaderPointerDown !== undefined
  const panelBarBaseClass = 'flex h-11 shrink-0 items-center border-border/50 bg-background pl-3 pr-2'

  const sectionRefs = {
    layout: React.useRef<HTMLDivElement>(null),
    radius: React.useRef<HTMLDivElement>(null),
    border: React.useRef<HTMLDivElement>(null),
    colors: React.useRef<HTMLDivElement>(null),
    text: React.useRef<HTMLDivElement>(null),
  }
  const { scrollRef, activeSection } = useSectionNav(sectionRefs)

  return (
    <TooltipProvider delayDuration={200}>
    <div
      ref={panelRef}
      data-direct-edit="panel"
      className={cn(
        'flex flex-col overflow-hidden rounded-xl outline outline-1 outline-foreground/10 shadow-lg',
        isDragging && 'cursor-grabbing select-none',
        className
      )}
      style={{ width: PANEL_WIDTH, ...style }}
    >
      <div
        className={cn(
          panelBarBaseClass,
          'gap-2 border-b',
          isDraggable && 'cursor-grab active:cursor-grabbing'
        )}
        onPointerDown={onHeaderPointerDown}
        onPointerMove={onHeaderPointerMove}
        onPointerUp={onHeaderPointerUp}
      >
        <div className="min-w-0 flex-1">
          <code className="text-xs font-medium text-foreground">
            &lt;{elementInfo.tagName}&gt;
          </code>
          {elementInfo.id && (
            <span className="ml-1.5 text-xs text-muted-foreground">#{elementInfo.id}</span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {onSelectParent && (
            <Tip label="Select Parent">
              <Button
                variant="ghost"
                size="icon"
                onClick={onSelectParent}
                disabled={!elementInfo.parentElement}
                className="size-7"
              >
                <ChevronUp className="size-3.5" />
              </Button>
            </Tip>
          )}
          {onSelectChild && (
            <Tip label="Select Child">
              <Button
                variant="ghost"
                size="icon"
                onClick={onSelectChild}
                disabled={!elementInfo.hasChildren}
                className="size-7"
              >
                <ChevronDown className="size-3.5" />
              </Button>
            </Tip>
          )}
          {onClose && (
            <>
              <div className="mx-0.5 h-4 w-px bg-border" />
              <Button variant="ghost" size="icon" className="size-7" onClick={onClose}>
                <X className="size-3.5" />
              </Button>
            </>
          )}
        </div>
      </div>

      <SectionNav
        scrollRef={scrollRef}
        activeSection={activeSection}
        showColors={!!computedColor}
        showText={elementInfo.isTextElement && !!computedTypography}
        sectionRefs={sectionRefs}
      />

      <div className="flex-1 overflow-y-auto backdrop-blur-xl bg-background/85" ref={scrollRef}>
        <CollapsibleSection title="Layout" actions={
          <Tip label={elementInfo.isFlexContainer ? 'Remove flex (Shift+A)' : 'Add flex (Shift+A)'}>
            <button
              type="button"
              className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-muted-foreground/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              onClick={onToggleFlex}
            >
              {elementInfo.isFlexContainer ? <Minus className="size-3.5" /> : <Plus className="size-3.5" />}
            </button>
          </Tip>
        }>
          <div className="space-y-3" ref={sectionRefs.layout}>
            {elementInfo.isFlexContainer && (
              <div>
                <div className="mb-2 text-xs font-medium text-muted-foreground">Flex</div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-2">
                    <div className="flex h-7 gap-0.5 rounded-lg bg-muted p-0.5">
                      <Tip label="Row">
                        <button
                          type="button"
                          className={cn(
                            'flex flex-1 items-center justify-center rounded-md transition-all',
                            computedFlex.flexDirection === 'row'
                              ? 'bg-background text-blue-500 shadow-sm'
                              : 'text-muted-foreground hover:text-foreground'
                          )}
                          onClick={() => onUpdateFlex('flexDirection', 'row')}
                        >
                          <ArrowRight className="size-3.5" />
                        </button>
                      </Tip>
                      <Tip label="Column">
                        <button
                          type="button"
                          className={cn(
                            'flex flex-1 items-center justify-center rounded-md transition-all',
                            computedFlex.flexDirection === 'column'
                              ? 'bg-background text-blue-500 shadow-sm'
                              : 'text-muted-foreground hover:text-foreground'
                          )}
                          onClick={() => onUpdateFlex('flexDirection', 'column')}
                        >
                          <ArrowDown className="size-3.5" />
                        </button>
                      </Tip>
                    </div>

                    <div className="flex h-7 items-center overflow-hidden rounded-md border-0 bg-muted text-xs focus-within:outline-none focus-within:ring-1 focus-within:ring-inset focus-within:ring-ring">
                      <span className="flex flex-1 items-center gap-1.5 px-2">
                        <MoveHorizontal className="size-3.5 shrink-0 text-muted-foreground" />
                        {isDistributeValue ? (
                          <span className="flex-1 truncate">{DISTRIBUTE_LABELS[distributeMode]}</span>
                        ) : (
                          <SizingFixedInput
                            value={computedSpacing.gap.numericValue}
                            onValueChange={(numericValue) => {
                              const unit = computedSpacing.gap.unit === 'em' || computedSpacing.gap.unit === '' ? 'px' : computedSpacing.gap.unit
                              onUpdateSpacing('gap', {
                                numericValue,
                                unit,
                                raw: `${numericValue}${unit}`,
                              })
                            }}
                          />
                        )}
                      </span>
                      <Select value={distributeMode} onValueChange={(val) => {
                        if (val) onUpdateFlex('justifyContent', val === 'fixed' ? 'flex-start' : val)
                      }}>
                        <SelectTrigger className="flex h-full items-center justify-center border-l border-border/30 px-1.5 hover:bg-muted-foreground/10 focus-visible:outline-none">
                          <ChevronsUpDown className="size-3.5 text-muted-foreground" />
                        </SelectTrigger>
                        <SelectPortal>
                          <SelectPositioner side="bottom" sideOffset={4} alignItemWithTrigger={false} className="z-[99999]">
                            <SelectPopup className="min-w-[120px] overflow-hidden rounded-xl outline outline-1 outline-foreground/10 bg-background p-1 text-popover-foreground shadow-lg animate-in fade-in-0 zoom-in-95">
                              {DISTRIBUTE_MODES.map((mode) => (
                                <SelectItem key={mode} value={mode} className="relative flex cursor-default select-none items-center rounded-md py-1.5 pl-6 pr-2 text-xs outline-none hover:bg-muted data-[highlighted]:bg-muted">
                                  <SelectItemIndicator className="absolute left-1.5 flex items-center justify-center">
                                    <Check className="size-3.5" />
                                  </SelectItemIndicator>
                                  <SelectItemText>{DISTRIBUTE_LABELS[mode]}</SelectItemText>
                                </SelectItem>
                              ))}
                            </SelectPopup>
                          </SelectPositioner>
                        </SelectPortal>
                      </Select>
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
                <div className="mb-2 text-xs font-medium text-muted-foreground">Sizing</div>
                <SizingInputs
                  width={computedSizing.width}
                  height={computedSizing.height}
                  onWidthChange={(value) => onUpdateSizing('width', value)}
                  onHeightChange={(value) => onUpdateSizing('height', value)}
                />
              </div>
            )}

            <div>
              <div className="mb-2 text-xs font-medium text-muted-foreground">Padding</div>
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
              <div className="mb-2 text-xs font-medium text-muted-foreground">Margin</div>
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

        <div ref={sectionRefs.radius}>
          <CollapsibleSection title="Radius">
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
        </div>

        <div ref={sectionRefs.border}>
          <BorderSection
            border={computedBorder}
            borderColor={computedColor?.borderColor}
            outlineColor={computedColor?.outlineColor}
            onChange={onUpdateBorder}
            onBatchChange={onBatchUpdateBorder}
            onBorderColorChange={(value) => onUpdateColor('borderColor', value)}
            onOutlineColorChange={(value) => onUpdateColor('outlineColor', value)}
            onSetCSS={onSetCSS}
            pendingStyles={pendingStyles}
          />
        </div>

        {elementInfo.isTextElement && computedTypography && (
          <div ref={sectionRefs.text}>
            <CollapsibleSection title="Text">
              <TypographyInputs
                typography={computedTypography}
                onUpdate={onUpdateTypography}
              />
            </CollapsibleSection>
          </div>
        )}

        {computedColor && (
          <div ref={sectionRefs.colors}>
            <CollapsibleSection title="Selection colors">
              <FillSection
                backgroundColor={computedColor.backgroundColor}
                textColor={computedColor.color}
                borderColor={computedColor.borderColor}
                outlineColor={computedColor.outlineColor}
                onBackgroundChange={(value) => onUpdateColor('backgroundColor', value)}
                onTextChange={(value) => onUpdateColor('color', value)}
                onBorderColorChange={(value) => onUpdateColor('borderColor', value)}
                onOutlineColorChange={(value) => onUpdateColor('outlineColor', value)}
                hasTextContent={elementInfo.isTextElement}
                showBackgroundColor={computedColor.backgroundColor.alpha > 0}
                showBorderColor={false}
                showOutlineColor={computedColor.outlineColor.alpha > 0}
              />
            </CollapsibleSection>
          </div>
        )}
      </div>

      <div
        className={cn(
          panelBarBaseClass,
          'gap-1 border-t',
          isDraggable && 'cursor-grab active:cursor-grabbing'
        )}
        onPointerDown={onHeaderPointerDown}
        onPointerMove={onHeaderPointerMove}
        onPointerUp={onHeaderPointerUp}
      >
        <div className="flex-1" />
        <Tip label="Copy edits">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleCopy}
            className="size-7"
          >
            {copyError ? (
              <X className="size-3.5 text-red-500" />
            ) : copied ? (
              <Check className="size-3.5 text-green-500" />
            ) : (
              <Copy className="size-3.5" />
            )}
          </Button>
        </Tip>
        <Tip label="Apply changes via agent">
          <Button
            variant="outline"
            size="icon"
            onClick={handleSendToAgent}
            disabled={!hasPendingChanges || sendStatus === 'sending'}
            className="size-7"
          >
            {sendStatus === 'offline' ? (
              <X className="size-3.5 text-red-500" />
            ) : sendStatus === 'sent' ? (
              <Check className="size-3.5 text-green-500" />
            ) : sendStatus === 'sending' ? (
              <Send className="size-3.5 animate-pulse" />
            ) : (
              <Send className="size-3.5" />
            )}
          </Button>
        </Tip>
      </div>
    </div>
    </TooltipProvider>
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
    computedBorder,
    computedFlex,
    computedSizing,
    computedColor,
    computedTypography,
    updateSpacingProperty,
    updateBorderRadiusProperty,
    updateBorderProperty,
    updateBorderProperties,
    updateRawCSS,
    updateFlexProperty,
    toggleFlexLayout,
    updateSizingProperty,
    updateColorProperty,
    updateTypographyProperty,
    resetToOriginal,
    exportEdits,
    sendEditToAgent,
    pendingStyles,
    selectParent,
    selectChild,
    selectElement,
    editModeActive,
    selectedElement,
    handleMoveComplete,
    activeTool,
    setActiveTool,
    comments,
    activeCommentId,
    addComment,
    updateCommentText,
    addCommentReply,
    deleteComment,
    exportComment,
    sendCommentToAgent,
    setActiveCommentId,
    startTextEditing,
    commitTextEditing,
    textEditingElement,
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

    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(position)) } catch {}
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
    onMoveComplete: handleMoveComplete,
  })

  const overlay = editModeActive && container ? createPortal(
    <>
      <div
        data-direct-edit="overlay"
        className={cn('fixed inset-0 z-[99990] cursor-default')}
        style={{ pointerEvents: textEditingElement ? 'none' : 'auto' }}
        onDoubleClick={(e) => {
          e.preventDefault()
          if (activeTool !== 'select') return
          const elementUnder = elementFromPointWithoutOverlays(e.clientX, e.clientY)
          if (elementUnder && elementUnder !== document.body && elementUnder !== document.documentElement) {
            const resolved = resolveElementTarget(elementUnder, selectedElement)
            if (isTextElement(resolved)) {
              if (selectedElement !== resolved) selectElement(resolved)
              startTextEditing(resolved)
            }
          }
        }}
        onMouseMove={(e) => {
          const elementUnder = elementFromPointWithoutOverlays(e.clientX, e.clientY)
          setHoverHighlight(computeHoverHighlight(elementUnder, selectedElement))
        }}
        onMouseLeave={() => setHoverHighlight(null)}
        onClick={(e) => {
          e.preventDefault()
          setHoverHighlight(null)
          if (activeCommentId) { setActiveCommentId(null); return }
          const elementUnder = elementFromPointWithoutOverlays(e.clientX, e.clientY)
          if (elementUnder && elementUnder !== document.body && elementUnder !== document.documentElement) {
            const resolved = resolveElementTarget(elementUnder, selectedElement)
            if (activeTool === 'comment') addComment(resolved, { x: e.clientX, y: e.clientY })
            else selectElement(resolved)
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

  const commentOverlay = editModeActive && comments.length > 0 && container ? createPortal(
    <CommentOverlay
      comments={comments}
      activeCommentId={activeCommentId}
      onSetActiveComment={setActiveCommentId}
      onUpdateText={updateCommentText}
      onAddReply={addCommentReply}
      onDelete={deleteComment}
      onExport={exportComment}
      onSendToAgent={sendCommentToAgent}
    />,
    container
  ) : null

  if (!isOpen || !computedSpacing || !elementInfo || !computedBorderRadius || !computedBorder || !computedFlex || !computedSizing || !computedColor || !computedTypography || !container) return <>{overlay}{commentOverlay}</>

  const handleMoveStart = (e: React.PointerEvent) => {
    if (selectedElement) {
      startDrag(e, selectedElement)
    }
  }

  return createPortal(
    <>
      {overlay}
      {commentOverlay}

      {selectedElement && (
        <SelectionOverlay
          selectedElement={selectedElement}
          isDragging={dragState.isDragging}
          ghostPosition={dragState.ghostPosition}
          onMoveStart={handleMoveStart}
          isTextEditing={Boolean(textEditingElement)}
          onDoubleClick={(clientX, clientY) => {
            if (!selectedElement) return
            if (isTextElement(selectedElement)) {
              startTextEditing(selectedElement)
              return
            }
            const elementUnder = elementFromPointWithoutOverlays(clientX, clientY)
            if (elementUnder && elementUnder !== selectedElement && selectedElement.contains(elementUnder)) {
              const resolved = resolveElementTarget(elementUnder, selectedElement)
              if (isTextElement(resolved)) {
                selectElement(resolved)
                startTextEditing(resolved)
              }
            }
          }}
          onHoverElement={(element) => {
            setHoverHighlight(computeHoverHighlight(element, selectedElement))
          }}
          onClickThrough={(clientX, clientY) => {
            if (!selectedElement) return
            const elementUnder = elementFromPointWithoutOverlays(clientX, clientY)
            if (!elementUnder) return
            if (elementUnder !== selectedElement && selectedElement.contains(elementUnder)) {
              const resolved = resolveElementTarget(elementUnder, selectedElement)
              selectElement(resolved)
              return
            }
            const child = findChildAtPoint(selectedElement, clientX, clientY)
            if (child) {
              selectElement(child)
            }
          }}
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
        computedBorder={computedBorder}
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
        onUpdateBorder={updateBorderProperty}
        onBatchUpdateBorder={updateBorderProperties}
        onSetCSS={updateRawCSS}
        onUpdateFlex={updateFlexProperty}
        onToggleFlex={toggleFlexLayout}
        onUpdateSizing={updateSizingProperty}
        onUpdateColor={updateColorProperty}
        onUpdateTypography={updateTypographyProperty}
        onReset={resetToOriginal}
        onExportEdits={exportEdits}
        onSendToAgent={sendEditToAgent}
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
