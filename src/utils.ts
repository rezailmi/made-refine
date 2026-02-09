import type {
  CSSPropertyValue,
  SpacingProperties,
  BorderRadiusProperties,
  BorderStyle,
  BorderProperties,
  FlexProperties,
  SizingProperties,
  SizingValue,
  SizingMode,
  SpacingPropertyKey,
  BorderRadiusPropertyKey,
  BorderPropertyKey,
  FlexPropertyKey,
  SizingPropertyKey,
  TypographyPropertyKey,
  TypographyProperties,
  ElementInfo,
  ReactComponentFrame,
  ElementLocator,
  DomSourceLocation,
  ColorValue,
  ColorProperties,
  ColorPropertyKey,
  MeasurementLine,
  Guideline,
  DropIndicator,
} from './types'

declare global {
  interface Window {
    __DIRECT_EDIT_DEVTOOLS__?: {
      getFiberForElement: (element: HTMLElement) => unknown | null
      hasHook?: boolean
    }
  }
}

export function parsePropertyValue(value: string): CSSPropertyValue {
  const raw = value.trim()
  const match = raw.match(/^(-?\d*\.?\d+)(px|rem|em|%)?$/)

  if (match) {
    return {
      numericValue: parseFloat(match[1]),
      unit: (match[2] as CSSPropertyValue['unit']) || 'px',
      raw,
    }
  }

  return {
    numericValue: 0,
    unit: 'px',
    raw,
  }
}

export function formatPropertyValue(value: CSSPropertyValue): string {
  if (value.raw === 'auto' || value.raw === 'inherit' || value.raw === 'initial') {
    return value.raw
  }
  return `${value.numericValue}${value.unit}`
}

export function getComputedStyles(element: HTMLElement): {
  spacing: SpacingProperties
  borderRadius: BorderRadiusProperties
  flex: FlexProperties
} {
  const computed = window.getComputedStyle(element)

  return {
    spacing: {
      paddingTop: parsePropertyValue(computed.paddingTop),
      paddingRight: parsePropertyValue(computed.paddingRight),
      paddingBottom: parsePropertyValue(computed.paddingBottom),
      paddingLeft: parsePropertyValue(computed.paddingLeft),
      marginTop: parsePropertyValue(computed.marginTop),
      marginRight: parsePropertyValue(computed.marginRight),
      marginBottom: parsePropertyValue(computed.marginBottom),
      marginLeft: parsePropertyValue(computed.marginLeft),
      gap: parsePropertyValue(computed.gap || '0px'),
    },
    borderRadius: {
      borderTopLeftRadius: parsePropertyValue(computed.borderTopLeftRadius),
      borderTopRightRadius: parsePropertyValue(computed.borderTopRightRadius),
      borderBottomRightRadius: parsePropertyValue(computed.borderBottomRightRadius),
      borderBottomLeftRadius: parsePropertyValue(computed.borderBottomLeftRadius),
    },
    flex: {
      display: computed.display,
      flexDirection: computed.flexDirection as FlexProperties['flexDirection'],
      justifyContent: computed.justifyContent,
      alignItems: computed.alignItems,
    },
  }
}

export function getComputedBorderStyles(element: HTMLElement): BorderProperties {
  const computed = window.getComputedStyle(element)

  return {
    borderStyle: computed.borderTopStyle as BorderProperties['borderStyle'],
    borderWidth: parsePropertyValue(computed.borderTopWidth),
    borderTopStyle: computed.borderTopStyle as BorderStyle,
    borderTopWidth: parsePropertyValue(computed.borderTopWidth),
    borderRightStyle: computed.borderRightStyle as BorderStyle,
    borderRightWidth: parsePropertyValue(computed.borderRightWidth),
    borderBottomStyle: computed.borderBottomStyle as BorderStyle,
    borderBottomWidth: parsePropertyValue(computed.borderBottomWidth),
    borderLeftStyle: computed.borderLeftStyle as BorderStyle,
    borderLeftWidth: parsePropertyValue(computed.borderLeftWidth),
  }
}

export function getOriginalInlineStyles(element: HTMLElement): Record<string, string> {
  const styles: Record<string, string> = {}
  const relevantProps = [
    'padding-top',
    'padding-right',
    'padding-bottom',
    'padding-left',
    'padding',
    'margin-top',
    'margin-right',
    'margin-bottom',
    'margin-left',
    'margin',
    'gap',
    'border-radius',
    'border-top-left-radius',
    'border-top-right-radius',
    'border-bottom-right-radius',
    'border-bottom-left-radius',
    'border',
    'border-style',
    'border-width',
    'border-top-style',
    'border-top-width',
    'border-right-style',
    'border-right-width',
    'border-bottom-style',
    'border-bottom-width',
    'border-left-style',
    'border-left-width',
    'display',
    'flex-direction',
    'justify-content',
    'align-items',
    'width',
    'height',
    'background-color',
    'color',
    'border-color',
    'outline-color',
    'font-family',
    'font-weight',
    'font-size',
    'line-height',
    'letter-spacing',
    'text-align',
  ]

  for (const prop of relevantProps) {
    const value = element.style.getPropertyValue(prop)
    if (value) {
      styles[prop] = value
    }
  }

  return styles
}

const tailwindClassMap: Record<string, { prefix: string; scale: Record<number, string> }> = {
  'padding-top': {
    prefix: 'pt',
    scale: { 0: '0', 1: 'px', 2: '0.5', 4: '1', 8: '2', 12: '3', 16: '4', 20: '5', 24: '6', 32: '8' },
  },
  'padding-right': {
    prefix: 'pr',
    scale: { 0: '0', 1: 'px', 2: '0.5', 4: '1', 8: '2', 12: '3', 16: '4', 20: '5', 24: '6', 32: '8' },
  },
  'padding-bottom': {
    prefix: 'pb',
    scale: { 0: '0', 1: 'px', 2: '0.5', 4: '1', 8: '2', 12: '3', 16: '4', 20: '5', 24: '6', 32: '8' },
  },
  'padding-left': {
    prefix: 'pl',
    scale: { 0: '0', 1: 'px', 2: '0.5', 4: '1', 8: '2', 12: '3', 16: '4', 20: '5', 24: '6', 32: '8' },
  },
  'margin-top': {
    prefix: 'mt',
    scale: { 0: '0', 1: 'px', 2: '0.5', 4: '1', 8: '2', 12: '3', 16: '4', 20: '5', 24: '6', 32: '8' },
  },
  'margin-right': {
    prefix: 'mr',
    scale: { 0: '0', 1: 'px', 2: '0.5', 4: '1', 8: '2', 12: '3', 16: '4', 20: '5', 24: '6', 32: '8' },
  },
  'margin-bottom': {
    prefix: 'mb',
    scale: { 0: '0', 1: 'px', 2: '0.5', 4: '1', 8: '2', 12: '3', 16: '4', 20: '5', 24: '6', 32: '8' },
  },
  'margin-left': {
    prefix: 'ml',
    scale: { 0: '0', 1: 'px', 2: '0.5', 4: '1', 8: '2', 12: '3', 16: '4', 20: '5', 24: '6', 32: '8' },
  },
  gap: {
    prefix: 'gap',
    scale: { 0: '0', 1: 'px', 2: '0.5', 4: '1', 8: '2', 12: '3', 16: '4', 20: '5', 24: '6', 32: '8' },
  },
  'border-width': {
    prefix: 'border',
    scale: { 0: '0', 1: '', 2: '2', 4: '4', 8: '8' },
  },
  'border-top-width': {
    prefix: 'border-t',
    scale: { 0: '0', 1: '', 2: '2', 4: '4', 8: '8' },
  },
  'border-right-width': {
    prefix: 'border-r',
    scale: { 0: '0', 1: '', 2: '2', 4: '4', 8: '8' },
  },
  'border-bottom-width': {
    prefix: 'border-b',
    scale: { 0: '0', 1: '', 2: '2', 4: '4', 8: '8' },
  },
  'border-left-width': {
    prefix: 'border-l',
    scale: { 0: '0', 1: '', 2: '2', 4: '4', 8: '8' },
  },
  'border-radius': {
    prefix: 'rounded',
    scale: { 0: 'none', 2: 'sm', 4: '', 6: 'md', 8: 'lg', 12: 'xl', 16: '2xl', 24: '3xl', 9999: 'full' },
  },
  'border-top-left-radius': {
    prefix: 'rounded-tl',
    scale: { 0: 'none', 2: 'sm', 4: '', 6: 'md', 8: 'lg', 12: 'xl', 16: '2xl', 24: '3xl', 9999: 'full' },
  },
  'border-top-right-radius': {
    prefix: 'rounded-tr',
    scale: { 0: 'none', 2: 'sm', 4: '', 6: 'md', 8: 'lg', 12: 'xl', 16: '2xl', 24: '3xl', 9999: 'full' },
  },
  'border-bottom-right-radius': {
    prefix: 'rounded-br',
    scale: { 0: 'none', 2: 'sm', 4: '', 6: 'md', 8: 'lg', 12: 'xl', 16: '2xl', 24: '3xl', 9999: 'full' },
  },
  'border-bottom-left-radius': {
    prefix: 'rounded-bl',
    scale: { 0: 'none', 2: 'sm', 4: '', 6: 'md', 8: 'lg', 12: 'xl', 16: '2xl', 24: '3xl', 9999: 'full' },
  },
}

const flexDirectionMap: Record<string, string> = {
  row: 'flex-row',
  'row-reverse': 'flex-row-reverse',
  column: 'flex-col',
  'column-reverse': 'flex-col-reverse',
}

const justifyContentMap: Record<string, string> = {
  'flex-start': 'justify-start',
  'flex-end': 'justify-end',
  center: 'justify-center',
  'space-between': 'justify-between',
  'space-around': 'justify-around',
  'space-evenly': 'justify-evenly',
  start: 'justify-start',
  end: 'justify-end',
}

const alignItemsMap: Record<string, string> = {
  'flex-start': 'items-start',
  'flex-end': 'items-end',
  center: 'items-center',
  baseline: 'items-baseline',
  stretch: 'items-stretch',
  start: 'items-start',
  end: 'items-end',
}

function getExactScaleValue(value: number, scale: Record<number, string>): string | null {
  if (Object.prototype.hasOwnProperty.call(scale, value)) {
    return scale[value]
  }
  return null
}

export function stylesToTailwind(styles: Record<string, string>): string {
  const classes: string[] = []

  for (const [prop, value] of Object.entries(styles)) {
    if (tailwindClassMap[prop]) {
      const parsed = parsePropertyValue(value)
      const mapping = tailwindClassMap[prop]
      if (value === 'auto') {
        classes.push(`${mapping.prefix}-auto`)
        continue
      }
      if (parsed.unit === 'px') {
        const exactScale = getExactScaleValue(parsed.numericValue, mapping.scale)
        if (exactScale !== null) {
          if (exactScale === '') {
            classes.push(mapping.prefix)
          } else {
            classes.push(`${mapping.prefix}-${exactScale}`)
          }
          continue
        }
      }
      classes.push(`${mapping.prefix}-[${value}]`)
      continue
    }

    if (prop === 'flex-direction' && flexDirectionMap[value]) {
      classes.push(flexDirectionMap[value])
      continue
    }

    if (prop === 'justify-content' && justifyContentMap[value]) {
      classes.push(justifyContentMap[value])
      continue
    }

    if (prop === 'align-items' && alignItemsMap[value]) {
      classes.push(alignItemsMap[value])
      continue
    }

    if (prop === 'display') {
      if (value === 'flex') classes.push('flex')
      else if (value === 'inline-flex') classes.push('inline-flex')
      else if (value === 'grid') classes.push('grid')
      else if (value === 'block') classes.push('block')
      else if (value === 'inline-block') classes.push('inline-block')
      else if (value === 'none') classes.push('hidden')
      continue
    }

    if (prop === 'width') {
      if (value === '100%') classes.push('w-full')
      else if (value === 'fit-content') classes.push('w-fit')
      else if (value === 'auto') classes.push('w-auto')
      else classes.push(`w-[${value}]`)
      continue
    }

    if (prop === 'height') {
      if (value === '100%') classes.push('h-full')
      else if (value === 'fit-content') classes.push('h-fit')
      else if (value === 'auto') classes.push('h-auto')
      else classes.push(`h-[${value}]`)
      continue
    }

    if (prop === 'background-color') {
      const colorValue = parseColorValue(value)
      classes.push(colorToTailwind('backgroundColor', colorValue))
      continue
    }

    if (prop === 'color') {
      const colorValue = parseColorValue(value)
      classes.push(colorToTailwind('color', colorValue))
      continue
    }

    if (prop === 'border-color') {
      const colorValue = parseColorValue(value)
      classes.push(colorToTailwind('borderColor', colorValue))
      continue
    }

    if (prop === 'border-style') {
      const styleMap: Record<string, string> = {
        none: 'border-none',
        solid: 'border-solid',
        dashed: 'border-dashed',
        dotted: 'border-dotted',
        double: 'border-double',
      }
      classes.push(styleMap[value] || `border-[${value}]`)
      continue
    }

    // Tailwind has no per-side border-style utilities — consolidate when all sides match
    if (prop === 'border-top-style' || prop === 'border-right-style' || prop === 'border-bottom-style' || prop === 'border-left-style') {
      if (prop === 'border-top-style') {
        const allSame =
          styles['border-top-style'] === styles['border-right-style'] &&
          styles['border-top-style'] === styles['border-bottom-style'] &&
          styles['border-top-style'] === styles['border-left-style']
        if (allSame) {
          const styleMap: Record<string, string> = {
            none: 'border-none',
            solid: 'border-solid',
            dashed: 'border-dashed',
            dotted: 'border-dotted',
            double: 'border-double',
          }
          classes.push(styleMap[value] || `border-[${value}]`)
        }
      }
      continue
    }

    if (prop === 'outline-color') {
      const colorValue = parseColorValue(value)
      classes.push(colorToTailwind('outlineColor', colorValue))
      continue
    }

    if (prop === 'font-size') {
      classes.push(`text-[${value}]`)
      continue
    }

    if (prop === 'font-weight') {
      const weightMap: Record<string, string> = {
        '100': 'font-thin',
        '200': 'font-extralight',
        '300': 'font-light',
        '400': 'font-normal',
        '500': 'font-medium',
        '600': 'font-semibold',
        '700': 'font-bold',
        '800': 'font-extrabold',
        '900': 'font-black',
      }
      classes.push(weightMap[value] || `font-[${value}]`)
      continue
    }

    if (prop === 'line-height') {
      classes.push(`leading-[${value}]`)
      continue
    }

    if (prop === 'letter-spacing') {
      classes.push(`tracking-[${value}]`)
      continue
    }

    if (prop === 'text-align') {
      const alignMap: Record<string, string> = {
        left: 'text-left',
        center: 'text-center',
        right: 'text-right',
        justify: 'text-justify',
      }
      if (alignMap[value]) classes.push(alignMap[value])
      continue
    }

    if (prop === 'font-family') {
      classes.push(`font-[${value.replace(/\s+/g, '_')}]`)
      continue
    }
  }

  return classes.join(' ')
}

export const propertyToCSSMap: Record<SpacingPropertyKey, string> = {
  paddingTop: 'padding-top',
  paddingRight: 'padding-right',
  paddingBottom: 'padding-bottom',
  paddingLeft: 'padding-left',
  marginTop: 'margin-top',
  marginRight: 'margin-right',
  marginBottom: 'margin-bottom',
  marginLeft: 'margin-left',
  gap: 'gap',
}

export const borderRadiusPropertyToCSSMap: Record<BorderRadiusPropertyKey, string> = {
  borderTopLeftRadius: 'border-top-left-radius',
  borderTopRightRadius: 'border-top-right-radius',
  borderBottomRightRadius: 'border-bottom-right-radius',
  borderBottomLeftRadius: 'border-bottom-left-radius',
}

export const borderPropertyToCSSMap: Record<BorderPropertyKey, string> = {
  borderStyle: 'border-style',
  borderWidth: 'border-width',
  borderTopStyle: 'border-top-style',
  borderTopWidth: 'border-top-width',
  borderRightStyle: 'border-right-style',
  borderRightWidth: 'border-right-width',
  borderBottomStyle: 'border-bottom-style',
  borderBottomWidth: 'border-bottom-width',
  borderLeftStyle: 'border-left-style',
  borderLeftWidth: 'border-left-width',
}

export const flexPropertyToCSSMap: Record<FlexPropertyKey, string> = {
  display: 'display',
  flexDirection: 'flex-direction',
  justifyContent: 'justify-content',
  alignItems: 'align-items',
}

export const sizingPropertyToCSSMap: Record<SizingPropertyKey, string> = {
  width: 'width',
  height: 'height',
}

export const typographyPropertyToCSSMap: Record<TypographyPropertyKey, string> = {
  fontFamily: 'font-family',
  fontWeight: 'font-weight',
  fontSize: 'font-size',
  lineHeight: 'line-height',
  letterSpacing: 'letter-spacing',
  textAlign: 'text-align',
  textVerticalAlign: 'align-items',
}

const TEXT_ELEMENT_TAGS = new Set([
  'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'span', 'label', 'a', 'strong', 'em', 'small',
  'blockquote', 'li', 'td', 'th', 'caption', 'figcaption',
  'legend', 'dt', 'dd', 'abbr', 'cite', 'code', 'pre',
])

export function isTextElement(element: HTMLElement): boolean {
  const tagName = element.tagName.toLowerCase()
  if (TEXT_ELEMENT_TAGS.has(tagName)) {
    return true
  }
  if (element.children.length === 0 && element.textContent?.trim()) {
    return true
  }
  return false
}

export function getComputedTypography(element: HTMLElement): TypographyProperties {
  const computed = window.getComputedStyle(element)

  let textVerticalAlign: TypographyProperties['textVerticalAlign'] = 'flex-start'
  if (computed.display === 'flex' || computed.display === 'inline-flex') {
    const alignItems = computed.alignItems
    if (alignItems === 'center') textVerticalAlign = 'center'
    else if (alignItems === 'flex-end' || alignItems === 'end') textVerticalAlign = 'flex-end'
  }

  // Handle "normal" keyword for line-height (use font-size as approximation)
  const lineHeight = computed.lineHeight === 'normal'
    ? { numericValue: parseFloat(computed.fontSize) * 1.2, unit: 'px' as const, raw: `${Math.round(parseFloat(computed.fontSize) * 1.2)}px` }
    : parsePropertyValue(computed.lineHeight)

  // Handle letter-spacing: convert px to em for consistent editing
  const fontSize = parseFloat(computed.fontSize)
  let letterSpacing: CSSPropertyValue
  if (computed.letterSpacing === 'normal') {
    letterSpacing = { numericValue: 0, unit: 'em' as const, raw: '0em' }
  } else {
    const parsed = parsePropertyValue(computed.letterSpacing)
    if (parsed.unit === 'px' && fontSize > 0) {
      const emValue = Math.round((parsed.numericValue / fontSize) * 100) / 100
      letterSpacing = { numericValue: emValue, unit: 'em' as const, raw: `${emValue}em` }
    } else {
      letterSpacing = parsed
    }
  }

  return {
    fontFamily: computed.fontFamily,
    fontWeight: computed.fontWeight,
    fontSize: parsePropertyValue(computed.fontSize),
    lineHeight,
    letterSpacing,
    textAlign: computed.textAlign as TypographyProperties['textAlign'],
    textVerticalAlign,
  }
}

export function detectSizingMode(
  element: HTMLElement,
  dimension: 'width' | 'height'
): SizingMode {
  const computed = window.getComputedStyle(element)
  const inlineValue = element.style[dimension]

  if (inlineValue === '100%') return 'fill'
  if (inlineValue === 'auto' || inlineValue === 'fit-content') return 'fit'

  const computedValue = computed[dimension]

  if (computedValue === '100%') return 'fill'
  if (
    computedValue === 'auto' ||
    computedValue === 'fit-content' ||
    computedValue === 'max-content'
  ) {
    return 'fit'
  }

  const parent = element.parentElement
  if (parent) {
    const parentComputed = window.getComputedStyle(parent)
    if (parentComputed.display === 'flex' || parentComputed.display === 'inline-flex') {
      const flexGrow = computed.flexGrow
      if (flexGrow !== '0') {
        return 'fill'
      }
    }
  }

  if (dimension === 'width') {
    if (computed.display === 'block' && !inlineValue) {
      return 'fill'
    }
    if (
      computed.display === 'inline-block' ||
      computed.display === 'inline-flex' ||
      computed.display === 'inline'
    ) {
      return 'fit'
    }
  }

  if (dimension === 'height') {
    if (!inlineValue) {
      return 'fit'
    }
  }

  return 'fixed'
}

export function getSizingValue(element: HTMLElement, dimension: 'width' | 'height'): SizingValue {
  const mode = detectSizingMode(element, dimension)
  const rect = element.getBoundingClientRect()
  const numericValue = Math.round(dimension === 'width' ? rect.width : rect.height)

  return {
    mode,
    value: {
      numericValue,
      unit: 'px',
      raw: `${numericValue}px`,
    },
  }
}

export function getComputedSizing(element: HTMLElement): SizingProperties {
  return {
    width: getSizingValue(element, 'width'),
    height: getSizingValue(element, 'height'),
  }
}

export function sizingValueToCSS(sizing: SizingValue): string {
  switch (sizing.mode) {
    case 'fill':
      return '100%'
    case 'fit':
      return 'fit-content'
    case 'fixed':
      return `${sizing.value.numericValue}${sizing.value.unit}`
  }
}

export function sizingToTailwind(dimension: 'width' | 'height', sizing: SizingValue): string {
  const prefix = dimension === 'width' ? 'w' : 'h'

  switch (sizing.mode) {
    case 'fill':
      return `${prefix}-full`
    case 'fit':
      return `${prefix}-fit`
    case 'fixed':
      return `${prefix}-[${sizing.value.numericValue}${sizing.value.unit}]`
  }
}

function parseHexColor(hex: string): ColorValue {
  const raw = hex
  let h = hex.replace('#', '')

  // Expand shorthand (#RGB -> #RRGGBB)
  if (h.length === 3) {
    h = h
      .split('')
      .map((c) => c + c)
      .join('')
  }

  // Handle 8-digit hex with alpha
  if (h.length === 8) {
    const alpha = Math.round((parseInt(h.slice(6, 8), 16) / 255) * 100)
    return { hex: h.slice(0, 6).toUpperCase(), alpha, raw }
  }

  return { hex: h.toUpperCase(), alpha: 100, raw }
}

function parseRgbaColor(rgba: string): ColorValue {
  const match = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/)
  if (!match) {
    return { hex: '000000', alpha: 100, raw: rgba }
  }

  const r = parseInt(match[1])
  const g = parseInt(match[2])
  const b = parseInt(match[3])
  const a = match[4] ? parseFloat(match[4]) : 1

  const hex = [r, g, b]
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()
  const alpha = Math.round(a * 100)

  return { hex, alpha, raw: rgba }
}

function parseNamedColor(name: string): ColorValue {
  // Use a temporary canvas to convert named colors
  const ctx = document.createElement('canvas').getContext('2d')
  if (!ctx) {
    return { hex: '000000', alpha: 100, raw: name }
  }

  ctx.fillStyle = name
  const computed = ctx.fillStyle

  if (computed.startsWith('#')) {
    return parseHexColor(computed)
  }
  return parseRgbaColor(computed)
}

export function parseColorValue(cssValue: string): ColorValue {
  const raw = cssValue.trim()

  // Handle transparent
  if (raw === 'transparent') {
    return { hex: '000000', alpha: 0, raw }
  }

  // Handle hex colors
  if (raw.startsWith('#')) {
    return parseHexColor(raw)
  }

  // Handle rgb/rgba
  if (raw.startsWith('rgb')) {
    return parseRgbaColor(raw)
  }

  // Fallback: use canvas to convert named colors
  return parseNamedColor(raw)
}

const TRANSPARENT_COLOR: ColorValue = { hex: '000000', alpha: 0, raw: 'transparent' }

export function getComputedColorStyles(element: HTMLElement): ColorProperties {
  const computed = window.getComputedStyle(element)

  const hasBorder =
    computed.borderTopStyle !== 'none' && parseFloat(computed.borderTopWidth) > 0
  const hasOutline =
    computed.outlineStyle !== 'none' && parseFloat(computed.outlineWidth) > 0

  return {
    backgroundColor: parseColorValue(computed.backgroundColor),
    color: parseColorValue(computed.color),
    borderColor: hasBorder ? parseColorValue(computed.borderTopColor) : TRANSPARENT_COLOR,
    outlineColor: hasOutline ? parseColorValue(computed.outlineColor) : TRANSPARENT_COLOR,
  }
}

export const colorPropertyToCSSMap: Record<ColorPropertyKey, string> = {
  backgroundColor: 'background-color',
  color: 'color',
  borderColor: 'border-color',
  outlineColor: 'outline-color',
}

const colorTailwindPrefixMap: Record<ColorPropertyKey, string> = {
  backgroundColor: 'bg',
  color: 'text',
  borderColor: 'border',
  outlineColor: 'outline',
}

export function colorToTailwind(
  property: ColorPropertyKey,
  colorValue: ColorValue
): string {
  const prefix = colorTailwindPrefixMap[property]

  // Use arbitrary hex value
  if (colorValue.alpha === 100) {
    return `${prefix}-[#${colorValue.hex}]`
  }
  return `${prefix}-[#${colorValue.hex}]/${colorValue.alpha}`
}

export function getElementInfo(element: HTMLElement): ElementInfo {
  const computed = window.getComputedStyle(element)
  const parentElement = element.parentElement

  const isFlexContainer = computed.display === 'flex' || computed.display === 'inline-flex'

  let isFlexItem = false
  if (parentElement) {
    const parentComputed = window.getComputedStyle(parentElement)
    isFlexItem = parentComputed.display === 'flex' || parentComputed.display === 'inline-flex'
  }

  return {
    tagName: element.tagName.toLowerCase(),
    id: element.id || null,
    classList: Array.from(element.classList),
    isFlexContainer,
    isFlexItem,
    isTextElement: isTextElement(element),
    parentElement,
    hasChildren: element.children.length > 0,
  }
}

interface DimensionDisplay {
  width: string
  height: string
}

function isFitSizing(element: HTMLElement, dimension: 'width' | 'height'): boolean {
  const computed = window.getComputedStyle(element)
  const inlineValue = element.style[dimension]

  if (inlineValue === 'auto') return true

  const computedValue = computed[dimension]

  if (!inlineValue) {
    const parent = element.parentElement
    if (parent) {
      const parentComputed = window.getComputedStyle(parent)
      if (parentComputed.display === 'flex' || parentComputed.display === 'inline-flex') {
        const flexBasis = computed.flexBasis
        const flexGrow = computed.flexGrow
        if (flexBasis === 'auto' && flexGrow === '0') {
          return true
        }
      }
    }

    if (dimension === 'width') {
      if (computed.display === 'block' && !inlineValue) {
        return false
      }
      if (
        computed.display === 'inline-block' ||
        computed.display === 'inline-flex' ||
        computed.display === 'inline'
      ) {
        return true
      }
    }

    if (dimension === 'height') {
      return !inlineValue
    }
  }

  if (computedValue.includes('fit-content') || computedValue.includes('max-content')) {
    return true
  }

  return false
}

export function getDimensionDisplay(element: HTMLElement): DimensionDisplay {
  const rect = element.getBoundingClientRect()
  const width = Math.round(rect.width)
  const height = Math.round(rect.height)

  const widthIsFit = isFitSizing(element, 'width')
  const heightIsFit = isFitSizing(element, 'height')

  return {
    width: widthIsFit ? `Fit ${width}` : `${width}`,
    height: heightIsFit ? `Fit ${height}` : `${height}`,
  }
}


export function calculateParentMeasurements(element: HTMLElement, container?: HTMLElement): MeasurementLine[] {
  const parent = container ?? element.parentElement
  if (!parent) return []

  const elementRect = element.getBoundingClientRect()
  const parentRect = parent.getBoundingClientRect()

  // Use clientLeft/clientTop for reliable border widths, clientWidth/clientHeight
  // for inner dimensions (handles scrollbars correctly)
  const paddingBoxLeft = parentRect.left + parent.clientLeft
  const paddingBoxTop = parentRect.top + parent.clientTop
  const paddingBoxRight = parentRect.left + parent.clientLeft + parent.clientWidth
  const paddingBoxBottom = parentRect.top + parent.clientTop + parent.clientHeight

  let parentInnerLeft: number
  let parentInnerTop: number
  let parentInnerRight: number
  let parentInnerBottom: number

  if (container) {
    // Ancestor case: measure from padding-box (inside border, outside padding).
    // The ancestor's padding doesn't directly position the child — intermediate
    // elements do — so the visually correct edge is inside the border only.
    parentInnerLeft = paddingBoxLeft
    parentInnerTop = paddingBoxTop
    parentInnerRight = paddingBoxRight
    parentInnerBottom = paddingBoxBottom
  } else {
    // Direct parent case: measure from content-box (inside border and padding).
    // The parent's padding IS the gap between its edge and the child's layout area.
    const parentStyles = window.getComputedStyle(parent)
    parentInnerLeft = paddingBoxLeft + (parseFloat(parentStyles.paddingLeft) || 0)
    parentInnerTop = paddingBoxTop + (parseFloat(parentStyles.paddingTop) || 0)
    parentInnerRight = paddingBoxRight - (parseFloat(parentStyles.paddingRight) || 0)
    parentInnerBottom = paddingBoxBottom - (parseFloat(parentStyles.paddingBottom) || 0)
  }

  const measurements: MeasurementLine[] = []

  const topDistance = Math.round(elementRect.top - parentInnerTop)
  if (topDistance > 0) {
    const midX = elementRect.left + elementRect.width / 2
    measurements.push({
      direction: 'vertical',
      x1: midX,
      y1: parentInnerTop,
      x2: midX,
      y2: elementRect.top,
      distance: topDistance,
      labelPosition: { x: midX, y: (parentInnerTop + elementRect.top) / 2 },
    })
  }

  const bottomDistance = Math.round(parentInnerBottom - elementRect.bottom)
  if (bottomDistance > 0) {
    const midX = elementRect.left + elementRect.width / 2
    measurements.push({
      direction: 'vertical',
      x1: midX,
      y1: elementRect.bottom,
      x2: midX,
      y2: parentInnerBottom,
      distance: bottomDistance,
      labelPosition: { x: midX, y: (elementRect.bottom + parentInnerBottom) / 2 },
    })
  }

  const leftDistance = Math.round(elementRect.left - parentInnerLeft)
  if (leftDistance > 0) {
    const midY = elementRect.top + elementRect.height / 2
    measurements.push({
      direction: 'horizontal',
      x1: parentInnerLeft,
      y1: midY,
      x2: elementRect.left,
      y2: midY,
      distance: leftDistance,
      labelPosition: { x: (parentInnerLeft + elementRect.left) / 2, y: midY },
    })
  }

  const rightDistance = Math.round(parentInnerRight - elementRect.right)
  if (rightDistance > 0) {
    const midY = elementRect.top + elementRect.height / 2
    measurements.push({
      direction: 'horizontal',
      x1: elementRect.right,
      y1: midY,
      x2: parentInnerRight,
      y2: midY,
      distance: rightDistance,
      labelPosition: { x: (elementRect.right + parentInnerRight) / 2, y: midY },
    })
  }

  return measurements
}

export function calculateElementMeasurements(
  from: HTMLElement,
  to: HTMLElement
): MeasurementLine[] {
  const fromRect = from.getBoundingClientRect()
  const toRect = to.getBoundingClientRect()
  const measurements: MeasurementLine[] = []

  const horizontalOverlap =
    fromRect.left < toRect.right && fromRect.right > toRect.left
  const verticalOverlap =
    fromRect.top < toRect.bottom && fromRect.bottom > toRect.top

  if (verticalOverlap) {
    const overlapTop = Math.max(fromRect.top, toRect.top)
    const overlapBottom = Math.min(fromRect.bottom, toRect.bottom)
    const midY = (overlapTop + overlapBottom) / 2

    if (fromRect.right <= toRect.left) {
      const distance = Math.round(toRect.left - fromRect.right)
      measurements.push({
        direction: 'horizontal',
        x1: fromRect.right,
        y1: midY,
        x2: toRect.left,
        y2: midY,
        distance,
        labelPosition: { x: (fromRect.right + toRect.left) / 2, y: midY },
      })
    } else if (fromRect.left >= toRect.right) {
      const distance = Math.round(fromRect.left - toRect.right)
      measurements.push({
        direction: 'horizontal',
        x1: toRect.right,
        y1: midY,
        x2: fromRect.left,
        y2: midY,
        distance,
        labelPosition: { x: (toRect.right + fromRect.left) / 2, y: midY },
      })
    }
  }

  if (horizontalOverlap) {
    const overlapLeft = Math.max(fromRect.left, toRect.left)
    const overlapRight = Math.min(fromRect.right, toRect.right)
    const midX = (overlapLeft + overlapRight) / 2

    if (fromRect.bottom <= toRect.top) {
      const distance = Math.round(toRect.top - fromRect.bottom)
      measurements.push({
        direction: 'vertical',
        x1: midX,
        y1: fromRect.bottom,
        x2: midX,
        y2: toRect.top,
        distance,
        labelPosition: { x: midX, y: (fromRect.bottom + toRect.top) / 2 },
      })
    } else if (fromRect.top >= toRect.bottom) {
      const distance = Math.round(fromRect.top - toRect.bottom)
      measurements.push({
        direction: 'vertical',
        x1: midX,
        y1: toRect.bottom,
        x2: midX,
        y2: fromRect.top,
        distance,
        labelPosition: { x: midX, y: (toRect.bottom + fromRect.top) / 2 },
      })
    }
  }

  if (!horizontalOverlap && !verticalOverlap) {
    const fromCenterX = fromRect.left + fromRect.width / 2
    const fromCenterY = fromRect.top + fromRect.height / 2
    const toCenterX = toRect.left + toRect.width / 2
    const toCenterY = toRect.top + toRect.height / 2

    const hDistance = toCenterX > fromCenterX
      ? Math.round(toRect.left - fromRect.right)
      : Math.round(fromRect.left - toRect.right)

    if (hDistance > 0) {
      const startX = toCenterX > fromCenterX ? fromRect.right : fromRect.left
      const endX = toCenterX > fromCenterX ? toRect.left : toRect.right
      const y = (fromCenterY + toCenterY) / 2
      measurements.push({
        direction: 'horizontal',
        x1: startX,
        y1: y,
        x2: endX,
        y2: y,
        distance: hDistance,
        labelPosition: { x: (startX + endX) / 2, y },
      })
    }

    const vDistance = toCenterY > fromCenterY
      ? Math.round(toRect.top - fromRect.bottom)
      : Math.round(fromRect.top - toRect.bottom)

    if (vDistance > 0) {
      const x = (fromCenterX + toCenterX) / 2
      const startY = toCenterY > fromCenterY ? fromRect.bottom : fromRect.top
      const endY = toCenterY > fromCenterY ? toRect.top : toRect.bottom
      measurements.push({
        direction: 'vertical',
        x1: x,
        y1: startY,
        x2: x,
        y2: endY,
        distance: vDistance,
        labelPosition: { x, y: (startY + endY) / 2 },
      })
    }
  }

  return measurements
}

const GUIDELINE_PROXIMITY = 80

export function calculateGuidelineMeasurements(
  element: HTMLElement,
  guidelines: Guideline[],
  mousePosition?: { x: number; y: number } | null,
): MeasurementLine[] {
  if (guidelines.length === 0) return []

  const rect = element.getBoundingClientRect()
  const scrollX = window.scrollX
  const scrollY = window.scrollY
  const measurements: MeasurementLine[] = []

  for (const g of guidelines) {
    if (g.orientation === 'horizontal') {
      const gy = g.position - scrollY
      const midX = rect.left + rect.width / 2

      // Only show when mouse is near this guideline's Y position
      if (mousePosition && Math.abs(mousePosition.y - gy) > GUIDELINE_PROXIMITY) continue

      if (gy < rect.top) {
        const distance = Math.round(rect.top - gy)
        if (distance > 0) {
          measurements.push({
            direction: 'vertical',
            x1: midX,
            y1: gy,
            x2: midX,
            y2: rect.top,
            distance,
            labelPosition: { x: midX, y: (gy + rect.top) / 2 },
          })
        }
      } else if (gy > rect.bottom) {
        const distance = Math.round(gy - rect.bottom)
        if (distance > 0) {
          measurements.push({
            direction: 'vertical',
            x1: midX,
            y1: rect.bottom,
            x2: midX,
            y2: gy,
            distance,
            labelPosition: { x: midX, y: (rect.bottom + gy) / 2 },
          })
        }
      }
    } else {
      const gx = g.position - scrollX
      const midY = rect.top + rect.height / 2

      // Only show when mouse is near this guideline's X position
      if (mousePosition && Math.abs(mousePosition.x - gx) > GUIDELINE_PROXIMITY) continue

      if (gx < rect.left) {
        const distance = Math.round(rect.left - gx)
        if (distance > 0) {
          measurements.push({
            direction: 'horizontal',
            x1: gx,
            y1: midY,
            x2: rect.left,
            y2: midY,
            distance,
            labelPosition: { x: (gx + rect.left) / 2, y: midY },
          })
        }
      } else if (gx > rect.right) {
        const distance = Math.round(gx - rect.right)
        if (distance > 0) {
          measurements.push({
            direction: 'horizontal',
            x1: rect.right,
            y1: midY,
            x2: gx,
            y2: midY,
            distance,
            labelPosition: { x: (rect.right + gx) / 2, y: midY },
          })
        }
      }
    }
  }

  return measurements
}

export function isFlexContainer(element: HTMLElement): boolean {
  const computed = window.getComputedStyle(element)
  return computed.display === 'flex' || computed.display === 'inline-flex'
}

export function getFlexDirection(
  element: HTMLElement
): 'row' | 'row-reverse' | 'column' | 'column-reverse' {
  const computed = window.getComputedStyle(element)
  return computed.flexDirection as 'row' | 'row-reverse' | 'column' | 'column-reverse'
}

export function detectChildrenDirection(
  container: HTMLElement,
  exclude: HTMLElement | null
): { axis: 'horizontal' | 'vertical'; reversed: boolean } {
  const computed = window.getComputedStyle(container)

  // Flex: trust CSS for accuracy (especially reverse)
  if (computed.display === 'flex' || computed.display === 'inline-flex') {
    const dir = computed.flexDirection
    return {
      axis: (dir === 'row' || dir === 'row-reverse') ? 'horizontal' : 'vertical',
      reversed: dir === 'row-reverse' || dir === 'column-reverse',
    }
  }

  // Non-flex: examine first two visible, in-flow children
  const visible: HTMLElement[] = []
  for (const c of container.children) {
    if (!(c instanceof HTMLElement) || c === exclude) continue
    const cs = window.getComputedStyle(c)
    if (cs.display === 'none' || cs.position === 'absolute' || cs.position === 'fixed') continue
    visible.push(c)
    if (visible.length === 2) break
  }

  if (visible.length < 2) return { axis: 'vertical', reversed: false }

  const first = visible[0].getBoundingClientRect()
  const second = visible[1].getBoundingClientRect()
  const yOverlap = first.bottom - 2 > second.top && second.bottom - 2 > first.top

  if (yOverlap) {
    return { axis: 'horizontal', reversed: second.right < first.left }
  }
  return { axis: 'vertical', reversed: second.bottom < first.top }
}

export function elementFromPointWithoutOverlays(x: number, y: number): HTMLElement | null {
  const host = document.querySelector<HTMLElement>('[data-direct-edit-host]')
  if (host) host.style.display = 'none'
  const el = document.elementFromPoint(x, y) as HTMLElement | null
  if (host) host.style.display = ''
  return el
}

function isLayoutContainer(element: HTMLElement): boolean {
  const display = window.getComputedStyle(element).display
  return (
    display === 'flex' ||
    display === 'inline-flex' ||
    display === 'grid' ||
    display === 'inline-grid'
  )
}

function isBlockContainer(element: HTMLElement): boolean {
  const display = window.getComputedStyle(element).display
  return display === 'block' || display === 'flow-root'
      || display === 'inline-block' || display === 'list-item'
}

function skipElement(el: HTMLElement, exclude: HTMLElement | null): boolean {
  if (exclude && exclude.contains(el)) return true
  if (el === document.body || el === document.documentElement) return true
  if (el.closest('[data-direct-edit]') || el.closest('[data-direct-edit-host]')) return true
  return false
}

function findContainerViaTraversal(x: number, y: number, exclude: HTMLElement | null): HTMLElement | null {
  const el = elementFromPointWithoutOverlays(x, y)
  if (!el) return null
  let current: HTMLElement | null = el
  while (current) {
    if (!skipElement(current, exclude)) {
      if (isLayoutContainer(current) || isBlockContainer(current)) return current
    }
    current = current.parentElement
  }
  return null
}

export function findContainerAtPoint(
  x: number,
  y: number,
  exclude: HTMLElement | null,
  preferredParent?: HTMLElement | null
): HTMLElement | null {
  const host = document.querySelector<HTMLElement>('[data-direct-edit-host]')
  if (host) host.style.display = 'none'

  const elements = document.elementsFromPoint(x, y) as HTMLElement[]

  if (host) host.style.display = ''

  // Find most specific container (front-to-back = most nested first)
  for (const el of elements) {
    if (skipElement(el, exclude)) continue
    if (isLayoutContainer(el) || isBlockContainer(el)) return el
  }

  // Fallback: preferredParent for gap/padding areas
  if (preferredParent && (isLayoutContainer(preferredParent) || isBlockContainer(preferredParent))) {
    for (const el of elements) {
      if (el === preferredParent) return preferredParent
    }
  }

  // Last resort: walk up DOM
  return findContainerViaTraversal(x, y, exclude)
}

export function calculateDropPosition(
  container: HTMLElement,
  pointerX: number,
  pointerY: number,
  draggedElement: HTMLElement
): { insertBefore: HTMLElement | null; indicator: DropIndicator } | null {
  const { axis, reversed: isReversed } = detectChildrenDirection(container, draggedElement)
  const isHorizontal = axis === 'horizontal'

  const children = Array.from(container.children).filter(
    (child) => child !== draggedElement && child instanceof HTMLElement
  ) as HTMLElement[]

  if (children.length === 0) {
    const containerRect = container.getBoundingClientRect()
    return {
      insertBefore: null,
      indicator: {
        x: containerRect.left + 4,
        y: containerRect.top + 4,
        width: isHorizontal ? 1 : containerRect.width - 8,
        height: isHorizontal ? containerRect.height - 8 : 1,
      },
    }
  }

  const containerRect = container.getBoundingClientRect()
  let insertBefore: HTMLElement | null = null
  let indicatorPosition = 0

  for (let i = 0; i < children.length; i++) {
    const child = children[i]
    const rect = child.getBoundingClientRect()
    const midpoint = isHorizontal
      ? rect.left + rect.width / 2
      : rect.top + rect.height / 2

    const pointer = isHorizontal ? pointerX : pointerY

    const beforeMidpoint = isReversed ? pointer > midpoint : pointer < midpoint

    if (beforeMidpoint) {
      insertBefore = child
      indicatorPosition = isHorizontal ? rect.left : rect.top
      break
    }
  }

  if (!insertBefore) {
    const lastChild = children[children.length - 1]
    const lastRect = lastChild.getBoundingClientRect()
    indicatorPosition = isHorizontal ? lastRect.right : lastRect.bottom
  }

  const indicator: DropIndicator = isHorizontal
    ? {
        x: indicatorPosition,
        y: containerRect.top + 4,
        width: 2,
        height: containerRect.height - 8,
      }
    : {
        x: containerRect.left + 4,
        y: indicatorPosition,
        width: containerRect.width - 8,
        height: 2,
      }

  return { insertBefore, indicator }
}

// Accesses React fiber internals to find the component stack. This is an undocumented
// API that could change between React versions, but is a common pattern for dev tools.
// Returns an empty array gracefully if React internals are unavailable.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getFiberForElement(element: HTMLElement): any | null {
  if (typeof window !== 'undefined') {
    const devtools = window.__DIRECT_EDIT_DEVTOOLS__
    if (devtools?.getFiberForElement) {
      const fiber = devtools.getFiberForElement(element)
      if (fiber) return fiber as any
    }
  }

  const fiberKey = Object.keys(element).find(
    (key) => key.startsWith('__reactFiber$') || key.startsWith('__reactInternalInstance$')
  )

  if (!fiberKey) return null
  return (element as any)[fiberKey] || null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getSourceFromFiber(fiber: any):
  | {
      fileName?: string
      lineNumber?: number
      columnNumber?: number
    }
  | null {
  const debugSource = fiber?._debugSource
  if (debugSource?.fileName) return debugSource

  const owner = fiber?._debugOwner
  const ownerPending = owner?.pendingProps?.__source
  if (ownerPending?.fileName) return ownerPending

  const ownerMemo = owner?.memoizedProps?.__source
  if (ownerMemo?.fileName) return ownerMemo

  const pending = fiber?.pendingProps?.__source
  if (pending?.fileName) return pending

  const memo = fiber?.memoizedProps?.__source
  if (memo?.fileName) return memo

  return null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildFrame(fiber: any): ReactComponentFrame | null {
  const type = fiber?.type
  if (typeof type !== 'function' && typeof type !== 'object') return null

  const name = type?.displayName || type?.name || null
  if (!name || name === 'Fragment') return null

  const frame: ReactComponentFrame = { name }
  const source = getSourceFromFiber(fiber)
  if (source?.fileName) {
    frame.file = source.fileName
    if (typeof source.lineNumber === 'number') {
      frame.line = source.lineNumber
    }
    if (typeof source.columnNumber === 'number') {
      frame.column = source.columnNumber
    }
  }

  return frame
}

function shouldIncludeFrame(
  frame: ReactComponentFrame,
  lastFrame: ReactComponentFrame | null
): boolean {
  if (!lastFrame) return true
  if (frame.name !== lastFrame.name) return true
  if (!lastFrame.file && frame.file) return true
  if (lastFrame.file && frame.file && lastFrame.line == null && frame.line != null) return true
  if (
    lastFrame.file &&
    frame.file &&
    lastFrame.line != null &&
    frame.line != null &&
    lastFrame.column == null &&
    frame.column != null
  ) {
    return true
  }
  return false
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getOwnerStack(fiber: any): ReactComponentFrame[] {
  const frames: ReactComponentFrame[] = []
  let current = fiber
  let lastFrame: ReactComponentFrame | null = null

  while (current) {
    const frame = buildFrame(current)
    if (frame && shouldIncludeFrame(frame, lastFrame)) {
      frames.push(frame)
      lastFrame = frame
    }
    current = current._debugOwner
  }

  return frames
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getRenderStack(fiber: any): ReactComponentFrame[] {
  const frames: ReactComponentFrame[] = []
  let current = fiber
  let lastFrame: ReactComponentFrame | null = null

  while (current) {
    const frame = buildFrame(current)
    if (frame && shouldIncludeFrame(frame, lastFrame)) {
      frames.push(frame)
      lastFrame = frame
    }
    current = current.return
  }

  return frames
}

function getReactComponentStack(element: HTMLElement): ReactComponentFrame[] {
  const fiber = getFiberForElement(element)
  if (!fiber) return []

  const ownerStack = getOwnerStack(fiber)
  if (ownerStack.length > 0) {
    return ownerStack
  }

  return getRenderStack(fiber)
}

const STABLE_ATTRIBUTES = ['data-testid', 'data-qa', 'data-cy', 'aria-label', 'role'] as const
const MAX_SELECTOR_DEPTH = 4

function escapeCssIdentifier(value: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(value)
  }
  return value.replace(/[^a-zA-Z0-9_-]/g, (char) => `\\${char}`)
}

function escapeAttributeValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

function isUniqueSelector(selector: string): boolean {
  if (typeof document === 'undefined') return false
  try {
    return document.querySelectorAll(selector).length === 1
  } catch {
    return false
  }
}

function getUniqueIdSelector(element: HTMLElement): string | null {
  if (!element.id) return null
  const selector = `#${escapeCssIdentifier(element.id)}`
  return isUniqueSelector(selector) ? selector : null
}

function getStableAttributeSelector(element: HTMLElement): string | null {
  const tagName = element.tagName.toLowerCase()
  for (const attr of STABLE_ATTRIBUTES) {
    const value = element.getAttribute(attr)
    if (!value) continue
    const selector = `${tagName}[${attr}="${escapeAttributeValue(value)}"]`
    if (isUniqueSelector(selector)) {
      return selector
    }
  }
  return null
}

function getNthOfTypeSelector(element: HTMLElement): string {
  const tagName = element.tagName.toLowerCase()
  const classes = Array.from(element.classList)
    .filter((className) => className && !className.startsWith('direct-edit'))
    .slice(0, 2)
  const classSelector = classes.map((className) => `.${escapeCssIdentifier(className)}`).join('')

  let nthOfType = ''
  const parent = element.parentElement
  if (parent) {
    const siblings = Array.from(parent.children).filter(
      (child) => (child as HTMLElement).tagName.toLowerCase() === tagName
    )
    if (siblings.length > 1) {
      const index = siblings.indexOf(element) + 1
      nthOfType = `:nth-of-type(${index})`
    }
  }

  return `${tagName}${classSelector}${nthOfType}`
}

function buildDomSelector(element: HTMLElement): string {
  if (typeof document === 'undefined') {
    return element.tagName.toLowerCase()
  }
  if (element.closest('[data-direct-edit]')) return ''

  const uniqueId = getUniqueIdSelector(element)
  if (uniqueId) return uniqueId

  const stableAttribute = getStableAttributeSelector(element)
  if (stableAttribute) return stableAttribute

  const segments: string[] = []
  let current: HTMLElement | null = element
  let depth = 0

  while (current && current !== document.body && depth < MAX_SELECTOR_DEPTH) {
    if (current.hasAttribute('data-direct-edit')) {
      current = current.parentElement
      continue
    }

    if (depth > 0) {
      const parentId = getUniqueIdSelector(current)
      if (parentId) {
        segments.unshift(parentId)
        break
      }
      const parentStableAttr = getStableAttributeSelector(current)
      if (parentStableAttr) {
        segments.unshift(parentStableAttr)
        break
      }
    }

    segments.unshift(getNthOfTypeSelector(current))
    current = current.parentElement
    depth += 1
  }

  return segments.join(' > ')
}

function stripDirectEditNodes(root: Element) {
  const nodes = root.querySelectorAll('[data-direct-edit]')
  nodes.forEach((node) => node.remove())
}

function buildTargetHtml(element: HTMLElement): string {
  const tagName = element.tagName.toLowerCase()
  const attrs: string[] = []
  const allowList = [
    'id',
    'class',
    'href',
    'src',
    'alt',
    'aria-label',
    'role',
    'data-testid',
  ]
  const maxAttrLength = 48

  for (const attr of allowList) {
    const value = element.getAttribute(attr)
    if (!value) continue
    const trimmed = value.length > maxAttrLength ? `${value.slice(0, maxAttrLength - 3)}...` : value
    attrs.push(`${attr}="${escapeAttributeValue(trimmed)}"`)
  }

  const text = getTextPreview(element)
  const attrString = attrs.length > 0 ? ` ${attrs.join(' ')}` : ''

  if (text) {
    return `<${tagName}${attrString}>\n  ${escapeHtml(text)}\n</${tagName}>`
  }

  return `<${tagName}${attrString}></${tagName}>`
}

function formatSourcePath(file: string): string {
  const normalized = file
    .replace(/\\/g, '/')
    .replace(/^webpack:\/\/\//, '')
    .replace(/^webpack:\/\//, '')
    .replace(/^file:\/\//, '')
    .replace(/^_N_E\//, '')
    .replace(/^\.\/+/, '')
  const packagesIndex = normalized.indexOf('/packages/')
  if (packagesIndex !== -1) {
    return `/[project]${normalized.slice(packagesIndex)}`
  }
  const appIndex = normalized.indexOf('/app/')
  if (appIndex !== -1) {
    return `/[project]${normalized.slice(appIndex)}`
  }
  const srcIndex = normalized.indexOf('/src/')
  if (srcIndex !== -1) {
    return `/[project]${normalized.slice(srcIndex)}`
  }
  return normalized
}

function formatSourceLocation(file: string, line?: number, column?: number): string {
  const formatted = formatSourcePath(file)
  if (typeof line === 'number') {
    const columnSuffix = typeof column === 'number' ? `:${column}` : ''
    return `${formatted}:${line}${columnSuffix}`
  }
  return formatted
}

function isUserlandSource(file: string): boolean {
  const normalized = file.replace(/\\/g, '/')
  if (
    normalized.includes('node_modules') ||
    normalized.includes('next/dist') ||
    normalized.includes('react') ||
    normalized.includes('react-dom') ||
    normalized.includes('direct-edit')
  ) {
    return false
  }
  return (
    normalized.includes('/app/') ||
    normalized.includes('/src/') ||
    normalized.includes('/packages/') ||
    normalized.startsWith('./')
  )
}

function getPrimaryFrame(locator: ElementLocator): ReactComponentFrame | null {
  for (const frame of locator.reactStack) {
    if (frame.file && isUserlandSource(frame.file)) {
      return frame
    }
  }
  for (const frame of locator.reactStack) {
    if (frame.file) {
      return frame
    }
  }
  return locator.reactStack[0] ?? null
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function buildDomContextHtml(
  element: HTMLElement,
  options?: { siblingCount?: number }
): string {
  const parent = element.parentElement
  if (!parent) {
    return element.outerHTML
  }

  const parentClone = parent.cloneNode(false) as HTMLElement
  const siblings = Array.from(parent.children) as HTMLElement[]
  const selectedIndex = siblings.indexOf(element)
  let slice = siblings

  if (options?.siblingCount && options.siblingCount > 0 && selectedIndex >= 0) {
    const start = Math.max(0, selectedIndex - options.siblingCount)
    const end = Math.min(siblings.length, selectedIndex + options.siblingCount + 1)
    slice = siblings.slice(start, end)
  }

  for (const sibling of slice) {
    if (sibling.closest('[data-direct-edit]')) continue
    const clone = sibling.cloneNode(true) as HTMLElement
    if (sibling === element) {
      clone.setAttribute('data-direct-edit-target', 'true')
    }
    stripDirectEditNodes(clone)
    parentClone.appendChild(clone)
  }

  return parentClone.outerHTML
}

function getTextPreview(element: HTMLElement): string {
  const text = element.textContent ?? ''
  const cleaned = text.replace(/\s+/g, ' ').trim()
  if (cleaned.length <= 120) {
    return cleaned
  }
  return `${cleaned.slice(0, 117)}...`
}

function parseDomSource(element: HTMLElement): DomSourceLocation | null {
  const value = element.getAttribute('data-direct-edit-source')
  if (!value) return null

  let file = value
  let line: number | undefined
  let column: number | undefined

  const lastColon = value.lastIndexOf(':')
  if (lastColon !== -1) {
    const maybeColumn = Number(value.slice(lastColon + 1))
    if (!Number.isNaN(maybeColumn)) {
      column = maybeColumn
      file = value.slice(0, lastColon)

      const prevColon = file.lastIndexOf(':')
      if (prevColon !== -1) {
        const maybeLine = Number(file.slice(prevColon + 1))
        if (!Number.isNaN(maybeLine)) {
          line = maybeLine
          file = file.slice(0, prevColon)
        }
      }
    }
  }

  return { file, line, column }
}

export function getElementLocator(element: HTMLElement): ElementLocator {
  const elementInfo = getElementInfo(element)
  let domSource = parseDomSource(element)

  // Fallback: get source from the element's own React fiber when
  // the Vite plugin attribute is not present
  if (!domSource) {
    const fiber = getFiberForElement(element)
    if (fiber) {
      const fiberSource = getSourceFromFiber(fiber)
      if (fiberSource?.fileName) {
        domSource = {
          file: fiberSource.fileName,
          line: fiberSource.lineNumber,
          column: fiberSource.columnNumber,
        }
      }
    }
  }

  return {
    reactStack: getReactComponentStack(element),
    domSelector: buildDomSelector(element),
    domContextHtml: buildDomContextHtml(element),
    targetHtml: buildTargetHtml(element),
    textPreview: getTextPreview(element),
    tagName: elementInfo.tagName,
    id: elementInfo.id,
    classList: elementInfo.classList,
    domSource: domSource ?? undefined,
  }
}

interface ExportChange {
  property: string
  value: string
  tailwind: string
}

export function buildEditExport(
  locator: ElementLocator,
  pendingStyles: Record<string, string>
): string
export function buildEditExport(
  element: HTMLElement | null,
  elementInfo: ElementInfo,
  computedSpacing: SpacingProperties | null,
  computedBorderRadius: BorderRadiusProperties | null,
  computedFlex: FlexProperties | null,
  computedSizing: SizingProperties | null,
  pendingStyles: Record<string, string>
): string
export function buildEditExport(
  arg1: ElementLocator | HTMLElement | null,
  arg2: ElementInfo | Record<string, string>,
  arg3?: SpacingProperties | null,
  arg4?: BorderRadiusProperties | null,
  arg5?: FlexProperties | null,
  arg6?: SizingProperties | null,
  arg7?: Record<string, string>
): string {
  const isLocator = Boolean(arg1 && typeof arg1 === 'object' && 'domSelector' in arg1)
  if (!isLocator) {
    void arg3
    void arg4
    void arg5
    void arg6
  }
  const pendingStyles = (isLocator ? (arg2 as Record<string, string>) : arg7) || {}
  let locator: ElementLocator

  if (isLocator) {
    locator = arg1 as ElementLocator
  } else {
    const element = arg1 as HTMLElement | null
    const elementInfo = arg2 as ElementInfo
    locator = element
      ? getElementLocator(element)
      : {
          reactStack: [],
          domSelector: elementInfo.id ? `#${elementInfo.id}` : elementInfo.tagName,
          domContextHtml: `<${elementInfo.tagName}${elementInfo.id ? ` id="${elementInfo.id}"` : ''} data-direct-edit-target="true"></${elementInfo.tagName}>`,
          targetHtml: `<${elementInfo.tagName}${elementInfo.id ? ` id="${elementInfo.id}"` : ''}></${elementInfo.tagName}>`,
          textPreview: '',
          tagName: elementInfo.tagName,
          id: elementInfo.id,
          classList: elementInfo.classList,
        }
  }

  const changes: ExportChange[] = []

  for (const [property, value] of Object.entries(pendingStyles)) {
    const tailwindClass = stylesToTailwind({ [property]: value })
    changes.push({
      property,
      value,
      tailwind: tailwindClass,
    })
  }

  const lines: string[] = []

  const primaryFrame = getPrimaryFrame(locator)
  const componentLabel = primaryFrame?.name ? primaryFrame.name : locator.tagName
  const formattedSource = locator.domSource?.file
    ? formatSourceLocation(locator.domSource.file, locator.domSource.line, locator.domSource.column)
    : primaryFrame?.file
      ? formatSourceLocation(primaryFrame.file, primaryFrame.line, primaryFrame.column)
      : null

  lines.push(`@<${componentLabel}>`)
  lines.push('')
  lines.push(locator.targetHtml || locator.domContextHtml || '')
  lines.push(`in ${formattedSource ?? '(file not available)'}`)

  if (!formattedSource) {
    const selector = locator.domSelector?.trim()
    const text = locator.textPreview?.trim()
    if (selector) {
      lines.push(`selector: ${selector}`)
    }
    if (text) {
      lines.push(`text: ${text}`)
    }
  }

  lines.push('')
  if (changes.length > 0) {
    lines.push('edits:')
    for (const change of changes) {
      const tailwind = change.tailwind ? ` (${change.tailwind})` : ''
      lines.push(`${change.property}: ${change.value}${tailwind}`)
    }
  }

  return lines.join('\n')
}

export function buildCommentExport(
  locator: ElementLocator,
  commentText: string,
  replies?: Array<{ text: string; createdAt: number }>
): string {
  const lines: string[] = []

  const primaryFrame = getPrimaryFrame(locator)
  const componentLabel = primaryFrame?.name ? primaryFrame.name : locator.tagName
  const formattedSource = locator.domSource?.file
    ? formatSourceLocation(locator.domSource.file, locator.domSource.line, locator.domSource.column)
    : primaryFrame?.file
      ? formatSourceLocation(primaryFrame.file, primaryFrame.line, primaryFrame.column)
      : null

  lines.push(`@<${componentLabel}>`)
  lines.push('')
  lines.push(locator.targetHtml || locator.domContextHtml || '')
  lines.push(`in ${formattedSource ?? '(file not available)'}`)

  if (!formattedSource) {
    const selector = locator.domSelector?.trim()
    const text = locator.textPreview?.trim()
    if (selector) {
      lines.push(`selector: ${selector}`)
    }
    if (text) {
      lines.push(`text: ${text}`)
    }
  }

  lines.push('')
  lines.push(`comment: ${commentText}`)
  if (replies && replies.length > 0) {
    for (const reply of replies) {
      lines.push(`reply: ${reply.text}`)
    }
  }

  return lines.join('\n')
}

export type {
  ElementInfo,
  CSSPropertyValue,
  SpacingProperties,
  BorderRadiusProperties,
  BorderStyle,
  BorderProperties,
  FlexProperties,
  DirectEditState,
  SpacingPropertyKey,
  BorderRadiusPropertyKey,
  BorderPropertyKey,
  FlexPropertyKey,
  MeasurementLine,
  MeasurementState,
  ColorValue,
  ColorProperties,
  ColorPropertyKey,
  SizingProperties,
  SizingPropertyKey,
  SizingMode,
  SizingValue,
  TypographyProperties,
  TypographyPropertyKey,
  ReactComponentFrame,
  ElementLocator,
  DragState,
  DropTarget,
  DropIndicator,
} from './types'
