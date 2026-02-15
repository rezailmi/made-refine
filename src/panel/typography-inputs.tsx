import * as React from 'react'
import { Button } from '../ui/button'
import { SimpleSelect } from '../ui/simple-select'
import type { TypographyPropertyKey, TypographyProperties, CSSPropertyValue } from '../types'
import { NumberInput, Tip } from './shared'
import {
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

export const FONT_FAMILIES = [
  { value: 'system-ui, sans-serif', label: 'System Sans-Serif' },
  { value: 'Georgia, serif', label: 'System Serif' },
  { value: 'ui-monospace, monospace', label: 'System Mono' },
  { value: 'Inter, sans-serif', label: 'Inter' },
  { value: 'Roboto, sans-serif', label: 'Roboto' },
  { value: 'Arial, sans-serif', label: 'Arial' },
]

export const FONT_WEIGHTS = [
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

export function TypographyInputs({ typography, onUpdate }: TypographyInputsProps) {
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
      <SimpleSelect
        value={typography.fontFamily}
        onValueChange={(val) => onUpdate('fontFamily', val)}
        options={FONT_FAMILIES}
        label={getFontFamilyLabel(typography.fontFamily)}
        icon={<Type className="size-3.5 text-muted-foreground" />}
        triggerClassName="w-full"
        popupMinWidth="180px"
        itemClassName="relative flex cursor-default select-none items-center rounded-md py-2 pl-7 pr-2 text-xs outline-none hover:bg-muted hover:text-foreground data-[highlighted]:bg-muted data-[highlighted]:text-foreground"
      />

      <SimpleSelect
        value={typography.fontWeight}
        onValueChange={(val) => onUpdate('fontWeight', val)}
        options={FONT_WEIGHTS}
        label={getFontWeightLabel(typography.fontWeight)}
        icon={<ALargeSmall className="size-3.5 text-muted-foreground" />}
        triggerClassName="w-full"
        popupMinWidth="140px"
        itemClassName="relative flex cursor-default select-none items-center rounded-md py-2 pl-7 pr-2 text-xs outline-none hover:bg-muted hover:text-foreground data-[highlighted]:bg-muted data-[highlighted]:text-foreground"
      />

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
