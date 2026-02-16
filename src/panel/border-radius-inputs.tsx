import * as React from 'react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Slider } from '../ui/slider'
import { cn } from '../cn'
import type { BorderRadiusPropertyKey, CSSPropertyValue } from '../types'
import { NumberInput, Tip, selectOnFocus } from './shared'
import {
  Columns2,
  Grid2x2,
} from 'lucide-react'

export const BORDER_RADIUS_FULL = 9999
export const BORDER_RADIUS_SLIDER_MAX = 49

// Slider position 0-48 maps to 0-48px, position 49 maps to 9999 (Full)
export function sliderToValue(sliderPos: number): number {
  return sliderPos >= BORDER_RADIUS_SLIDER_MAX ? BORDER_RADIUS_FULL : sliderPos
}

export function valueToSlider(value: number): number {
  return value >= BORDER_RADIUS_FULL ? BORDER_RADIUS_SLIDER_MAX : Math.min(value, BORDER_RADIUS_SLIDER_MAX - 1)
}

export function RadiusCornerIcon({ corner, className }: { corner: 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight'; className?: string }) {
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

interface BorderRadiusInputsProps {
  values: {
    topLeft: CSSPropertyValue
    topRight: CSSPropertyValue
    bottomRight: CSSPropertyValue
    bottomLeft: CSSPropertyValue
  }
  onChange: (key: BorderRadiusPropertyKey, value: CSSPropertyValue) => void
}

export function BorderRadiusInputs({ values, onChange }: BorderRadiusInputsProps) {
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
  const combinedValue = values.topLeft.numericValue

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

  const isMixed = !allSame
  const isFull = !isMixed && combinedValue >= BORDER_RADIUS_FULL
  const displayValue = isMixed ? 'mixed' : (isFull ? 'Full' : String(combinedValue))
  const sliderValue = valueToSlider(combinedValue)

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
