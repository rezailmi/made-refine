import * as React from 'react'
import { Button } from '../ui/button'
import type { SpacingPropertyKey, CSSPropertyValue } from '../types'
import { NumberInput, Tip } from './shared'
import {
  ArrowRight,
  ArrowDown,
  ArrowUp,
  ArrowLeft,
  MoveHorizontal,
  MoveVertical,
  Columns2,
  Grid2x2,
} from 'lucide-react'

interface SpacingInputsProps {
  prefix: 'padding' | 'margin'
  values: {
    top: CSSPropertyValue
    right: CSSPropertyValue
    bottom: CSSPropertyValue
    left: CSSPropertyValue
  }
  onChange: (key: SpacingPropertyKey, value: CSSPropertyValue) => void
}

export function SpacingInputs({ prefix, values, onChange }: SpacingInputsProps) {
  const [individual, setIndividual] = React.useState(false)
  const allowNegative = prefix === 'margin'

  const handleChange = (sides: ('top' | 'right' | 'bottom' | 'left')[], numericValue: number) => {
    const clamped = allowNegative ? numericValue : Math.max(0, numericValue)
    const newValue: CSSPropertyValue = {
      numericValue: clamped,
      unit: 'px',
      raw: `${clamped}px`,
    }

    for (const side of sides) {
      const key = `${prefix}${side.charAt(0).toUpperCase() + side.slice(1)}` as SpacingPropertyKey
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
