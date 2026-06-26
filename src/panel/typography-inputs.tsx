import * as React from 'react'
import { Button } from '../ui/button'
import { SimpleSelect } from '../ui/simple-select'
import type { TypographyPropertyKey, TypographyProperties, CSSPropertyValue } from '../types'
import { NumberInput, Tip } from './shared'
import { typographyTokenForProperty } from '../utils/design-tokens'
import { TokenChip } from './token-chip'
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
  Italic,
  Underline,
  Strikethrough,
  CaseUpper,
  CaseLower,
  CaseSensitive,
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
  classList?: string[]
}

/**
 * Renders the raw control inline when no Tailwind utility is attributed, or a
 * token chip whose popover contains that same raw control when one is.
 */
function TypographyField({
  token,
  children,
}: {
  token: string | null
  children: React.ReactNode
}) {
  if (!token) return <>{children}</>
  return (
    <TokenChip label={token}>
      <div className="space-y-2">{children}</div>
    </TokenChip>
  )
}

export function TypographyInputs({ typography, onUpdate, classList }: TypographyInputsProps) {
  const cl = classList ?? []
  const fontSizeToken = typographyTokenForProperty('font-size', cl)
  const lineHeightToken = typographyTokenForProperty('line-height', cl)
  const letterSpacingToken = typographyTokenForProperty('letter-spacing', cl)
  const fontWeightToken = typographyTokenForProperty('font-weight', cl)

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
    <div className="space-y-2">
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

      <TypographyField token={fontWeightToken}>
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
      </TypographyField>

      <div className="flex gap-2">
        <TypographyField token={fontSizeToken}>
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
        </TypographyField>
        <TypographyField token={lineHeightToken}>
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
        </TypographyField>
        <TypographyField token={letterSpacingToken}>
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
        </TypographyField>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex gap-1">
          <Tip label="Align Left">
            <Button
              variant="ghost"
              size="icon"
              className={
                typography.textAlign === 'left' || typography.textAlign === 'start'
                  ? 'size-7 bg-muted text-foreground'
                  : 'size-7 text-muted-foreground'
              }
              onClick={() => onUpdate('textAlign', 'left')}
            >
              <AlignLeft />
            </Button>
          </Tip>
          <Tip label="Align Center">
            <Button
              variant="ghost"
              size="icon"
              className={
                typography.textAlign === 'center'
                  ? 'size-7 bg-muted text-foreground'
                  : 'size-7 text-muted-foreground'
              }
              onClick={() => onUpdate('textAlign', 'center')}
            >
              <AlignCenter />
            </Button>
          </Tip>
          <Tip label="Align Right">
            <Button
              variant="ghost"
              size="icon"
              className={
                typography.textAlign === 'right' || typography.textAlign === 'end'
                  ? 'size-7 bg-muted text-foreground'
                  : 'size-7 text-muted-foreground'
              }
              onClick={() => onUpdate('textAlign', 'right')}
            >
              <AlignRight />
            </Button>
          </Tip>
        </div>

        <div className="flex gap-1">
          <Tip label="Align Top">
            <Button
              variant="ghost"
              size="icon"
              className={
                typography.textVerticalAlign === 'flex-start'
                  ? 'size-7 bg-muted text-foreground'
                  : 'size-7 text-muted-foreground'
              }
              onClick={() => onUpdate('textVerticalAlign', 'flex-start')}
            >
              <AlignVerticalJustifyStart />
            </Button>
          </Tip>
          <Tip label="Align Middle">
            <Button
              variant="ghost"
              size="icon"
              className={
                typography.textVerticalAlign === 'center'
                  ? 'size-7 bg-muted text-foreground'
                  : 'size-7 text-muted-foreground'
              }
              onClick={() => onUpdate('textVerticalAlign', 'center')}
            >
              <AlignVerticalJustifyCenter />
            </Button>
          </Tip>
          <Tip label="Align Bottom">
            <Button
              variant="ghost"
              size="icon"
              className={
                typography.textVerticalAlign === 'flex-end'
                  ? 'size-7 bg-muted text-foreground'
                  : 'size-7 text-muted-foreground'
              }
              onClick={() => onUpdate('textVerticalAlign', 'flex-end')}
            >
              <AlignVerticalJustifyEnd />
            </Button>
          </Tip>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex gap-1">
          <Tip label="Italic">
            <Button
              variant="ghost"
              size="icon"
              className={
                typography.fontStyle === 'italic'
                  ? 'size-7 bg-muted text-foreground'
                  : 'size-7 text-muted-foreground'
              }
              onClick={() =>
                onUpdate('fontStyle', typography.fontStyle === 'italic' ? 'normal' : 'italic')
              }
            >
              <Italic />
            </Button>
          </Tip>
          <Tip label="Underline">
            <Button
              variant="ghost"
              size="icon"
              className={
                typography.textDecoration === 'underline'
                  ? 'size-7 bg-muted text-foreground'
                  : 'size-7 text-muted-foreground'
              }
              onClick={() =>
                onUpdate(
                  'textDecoration',
                  typography.textDecoration === 'underline' ? 'none' : 'underline'
                )
              }
            >
              <Underline />
            </Button>
          </Tip>
          <Tip label="Strikethrough">
            <Button
              variant="ghost"
              size="icon"
              className={
                typography.textDecoration === 'line-through'
                  ? 'size-7 bg-muted text-foreground'
                  : 'size-7 text-muted-foreground'
              }
              onClick={() =>
                onUpdate(
                  'textDecoration',
                  typography.textDecoration === 'line-through' ? 'none' : 'line-through'
                )
              }
            >
              <Strikethrough />
            </Button>
          </Tip>
        </div>

        <div className="flex gap-1">
          <Tip label="Uppercase">
            <Button
              variant="ghost"
              size="icon"
              className={
                typography.textTransform === 'uppercase'
                  ? 'size-7 bg-muted text-foreground'
                  : 'size-7 text-muted-foreground'
              }
              onClick={() =>
                onUpdate(
                  'textTransform',
                  typography.textTransform === 'uppercase' ? 'none' : 'uppercase'
                )
              }
            >
              <CaseUpper />
            </Button>
          </Tip>
          <Tip label="Lowercase">
            <Button
              variant="ghost"
              size="icon"
              className={
                typography.textTransform === 'lowercase'
                  ? 'size-7 bg-muted text-foreground'
                  : 'size-7 text-muted-foreground'
              }
              onClick={() =>
                onUpdate(
                  'textTransform',
                  typography.textTransform === 'lowercase' ? 'none' : 'lowercase'
                )
              }
            >
              <CaseLower />
            </Button>
          </Tip>
          <Tip label="Capitalize">
            <Button
              variant="ghost"
              size="icon"
              className={
                typography.textTransform === 'capitalize'
                  ? 'size-7 bg-muted text-foreground'
                  : 'size-7 text-muted-foreground'
              }
              onClick={() =>
                onUpdate(
                  'textTransform',
                  typography.textTransform === 'capitalize' ? 'none' : 'capitalize'
                )
              }
            >
              <CaseSensitive />
            </Button>
          </Tip>
        </div>
      </div>
    </div>
  )
}
