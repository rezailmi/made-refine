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
  SessionEdit,
  AnchorRef,
  PlacementRef,
  MoveClassification,
  MoveOperation,
  MoveIntent,
  MovePlan,
  LayoutPrescription,
  Comment,
} from './types'

export { parsePropertyValue, formatPropertyValue } from './utils/css-value'
import { parsePropertyValue } from './utils/css-value'
import { getCanvasSnapshot, getBodyOffset } from './canvas-store'
import { getZoomScale } from './utils/measurements'

export function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  if (max < min) return min
  return Math.max(min, Math.min(max, value))
}

export function isInputFocused(): boolean {
  let active: Element | null = document.activeElement
  while (active?.shadowRoot?.activeElement) {
    active = active.shadowRoot.activeElement
  }
  return (
    active instanceof HTMLInputElement ||
    active instanceof HTMLTextAreaElement ||
    (active instanceof HTMLElement && active.isContentEditable)
  )
}

declare global {
  interface Window {
    __DIRECT_EDIT_DEVTOOLS__?: {
      getFiberForElement: (element: HTMLElement) => unknown | null
      hasHook?: boolean
    }
  }
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

  const topStyle = computed.borderTopStyle as BorderStyle
  const rightStyle = computed.borderRightStyle as BorderStyle
  const bottomStyle = computed.borderBottomStyle as BorderStyle
  const leftStyle = computed.borderLeftStyle as BorderStyle

  const topWidth = parsePropertyValue(computed.borderTopWidth)
  const rightWidth = parsePropertyValue(computed.borderRightWidth)
  const bottomWidth = parsePropertyValue(computed.borderBottomWidth)
  const leftWidth = parsePropertyValue(computed.borderLeftWidth)

  return {
    borderTopStyle: topStyle,
    borderTopWidth: topWidth,
    borderRightStyle: rightStyle,
    borderRightWidth: rightWidth,
    borderBottomStyle: bottomStyle,
    borderBottomWidth: bottomWidth,
    borderLeftStyle: leftStyle,
    borderLeftWidth: leftWidth,
  }
}

/** CSS properties captured before editing so resetToOriginal can restore them. */
export const ORIGINAL_STYLE_PROPS = [
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
    'background',
    'color',
    'border-color',
    'outline-color',
    'outline-style',
    'outline-width',
    'box-shadow',
    'font-family',
    'font-weight',
    'font-size',
    'line-height',
    'letter-spacing',
    'text-align',
] as const

export function getOriginalInlineStyles(element: HTMLElement): Record<string, string> {
  const styles: Record<string, string> = {}

  for (const prop of ORIGINAL_STYLE_PROPS) {
    const value = element.style.getPropertyValue(prop)
    if (value) {
      styles[prop] = value
    }
  }

  return styles
}

const spacingScale: Record<number, string> = { 0: '0', 1: 'px', 2: '0.5', 4: '1', 8: '2', 12: '3', 16: '4', 20: '5', 24: '6', 32: '8' }

const tailwindClassMap: Record<string, { prefix: string; scale: Record<number, string> }> = {
  padding: { prefix: 'p', scale: spacingScale },
  'padding-inline': { prefix: 'px', scale: spacingScale },
  'padding-block': { prefix: 'py', scale: spacingScale },
  'padding-top': { prefix: 'pt', scale: spacingScale },
  'padding-right': { prefix: 'pr', scale: spacingScale },
  'padding-bottom': { prefix: 'pb', scale: spacingScale },
  'padding-left': { prefix: 'pl', scale: spacingScale },
  margin: { prefix: 'm', scale: spacingScale },
  'margin-inline': { prefix: 'mx', scale: spacingScale },
  'margin-block': { prefix: 'my', scale: spacingScale },
  'margin-top': { prefix: 'mt', scale: spacingScale },
  'margin-right': { prefix: 'mr', scale: spacingScale },
  'margin-bottom': { prefix: 'mb', scale: spacingScale },
  'margin-left': { prefix: 'ml', scale: spacingScale },
  gap: { prefix: 'gap', scale: spacingScale },
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

function normalizeTailwindArbitraryValue(value: string): string {
  return value.trim().replace(/\s+/g, '_')
}

function normalizeShadowForComparison(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s*\/\s*/g, '/')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    .replace(/\s*,\s*/g, ',')
    .replace(/\s+/g, ' ')
}

const tailwindShadowClassValues: Array<{ className: string; css: string }> = [
  { className: 'shadow-2xs', css: '0 1px rgb(0 0 0 / 0.05)' },
  { className: 'shadow-xs', css: '0 1px 2px 0 rgb(0 0 0 / 0.05)' },
  { className: 'shadow', css: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)' },
  { className: 'shadow-sm', css: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)' },
  { className: 'shadow-md', css: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' },
  { className: 'shadow-lg', css: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)' },
  { className: 'shadow-xl', css: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)' },
  { className: 'shadow-2xl', css: '0 25px 50px -12px rgb(0 0 0 / 0.25)' },
  { className: 'shadow-inner', css: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)' },
]

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
      classes.push(styleMap[value] || `[border-style:${value}]`)
      continue
    }

    // Tailwind has no per-side border-style utilities — consolidate when all sides match
    if (prop === 'border-top-style' || prop === 'border-right-style' || prop === 'border-bottom-style' || prop === 'border-left-style') {
      const allPresent =
        'border-top-style' in styles &&
        'border-right-style' in styles &&
        'border-bottom-style' in styles &&
        'border-left-style' in styles
      if (allPresent) {
        // Only emit once (from border-top-style) when all four sides are present
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
            classes.push(styleMap[value] || `[border-style:${value}]`)
          } else {
            // Sides differ — emit each side individually
            classes.push(`[border-top-style:${styles['border-top-style']}]`)
            classes.push(`[border-right-style:${styles['border-right-style']}]`)
            classes.push(`[border-bottom-style:${styles['border-bottom-style']}]`)
            classes.push(`[border-left-style:${styles['border-left-style']}]`)
          }
        }
      } else {
        // Emit arbitrary-property syntax for individual side styles
        classes.push(`[${prop}:${value}]`)
      }
      continue
    }

    if (prop === 'outline-color') {
      const colorValue = parseColorValue(value)
      classes.push(colorToTailwind('outlineColor', colorValue))
      continue
    }

    if (prop === 'box-shadow') {
      const trimmed = value.trim()
      if (trimmed === 'none' || trimmed === '') {
        classes.push('shadow-none')
      } else {
        const normalized = normalizeShadowForComparison(trimmed)
        const preset = tailwindShadowClassValues.find(
          (entry) => normalizeShadowForComparison(entry.css) === normalized
        )
        if (preset) classes.push(preset.className)
        else classes.push(`shadow-[${normalizeTailwindArbitraryValue(value)}]`)
      }
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

function hasDirectNonWhitespaceText(element: HTMLElement): boolean {
  return Array.from(element.childNodes).some(
    (node) => node.nodeType === Node.TEXT_NODE && Boolean(node.textContent?.trim())
  )
}

export function isTextElement(element: HTMLElement): boolean {
  const tagName = element.tagName.toLowerCase()
  if (TEXT_ELEMENT_TAGS.has(tagName)) {
    return true
  }
  if (hasDirectNonWhitespaceText(element)) {
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

function parseRgbChannel(value: string): number | null {
  const token = value.trim()
  if (!token) return null

  if (token.endsWith('%')) {
    const numeric = parseFloat(token.slice(0, -1))
    if (!Number.isFinite(numeric)) return null
    return Math.round((Math.max(0, Math.min(100, numeric)) / 100) * 255)
  }

  const numeric = parseFloat(token)
  if (!Number.isFinite(numeric)) return null
  return Math.round(Math.max(0, Math.min(255, numeric)))
}

function parseRgbAlpha(value: string | undefined): number | null {
  if (value == null || value.trim() === '') return 1
  const token = value.trim()

  if (token.endsWith('%')) {
    const numeric = parseFloat(token.slice(0, -1))
    if (!Number.isFinite(numeric)) return null
    return Math.max(0, Math.min(100, numeric)) / 100
  }

  const numeric = parseFloat(token)
  if (!Number.isFinite(numeric)) return null
  return Math.max(0, Math.min(1, numeric))
}

function parseRgbaColor(rgba: string): ColorValue {
  const raw = rgba.trim()
  const fnMatch = raw.match(/^rgba?\((.*)\)$/i)
  if (!fnMatch) {
    return { hex: '000000', alpha: 100, raw: rgba }
  }

  const body = fnMatch[1].trim()
  let channelTokens: [string, string, string] | null = null
  let alphaToken: string | undefined

  const commaParts = body.split(',').map((part) => part.trim()).filter(Boolean)
  if (commaParts.length === 3 || commaParts.length === 4) {
    channelTokens = [commaParts[0], commaParts[1], commaParts[2]]
    alphaToken = commaParts[3]
  } else {
    const slashParts = body.split('/')
    if (slashParts.length === 1 || slashParts.length === 2) {
      const channels = slashParts[0].trim().split(/\s+/).filter(Boolean)
      if (channels.length === 3) {
        channelTokens = [channels[0], channels[1], channels[2]]
        alphaToken = slashParts[1]?.trim()
      }
    }
  }

  if (!channelTokens) {
    return { hex: '000000', alpha: 100, raw: rgba }
  }

  const r = parseRgbChannel(channelTokens[0])
  const g = parseRgbChannel(channelTokens[1])
  const b = parseRgbChannel(channelTokens[2])
  const a = parseRgbAlpha(alphaToken)

  if (r === null || g === null || b === null || a === null) {
    return { hex: '000000', alpha: 100, raw: rgba }
  }

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

function isVisibleBorderSide(side: { style: string; width: string }): boolean {
  return side.style !== 'none' && side.style !== 'hidden' && parseFloat(side.width) > 0
}

function hasVisibleOutline(computed: CSSStyleDeclaration): boolean {
  return computed.outlineStyle !== 'none' && parseFloat(computed.outlineWidth) > 0
}

function parseVisibleColor(
  value: string,
  fallbackCurrentColor?: string
): ColorValue | null {
  const raw = value.trim()
  const lowered = raw.toLowerCase()
  if (!raw || lowered === 'none' || lowered === 'transparent') {
    return null
  }

  const resolved = /^currentcolor$/i.test(raw)
    ? (fallbackCurrentColor ?? raw)
    : raw
  const parsed = parseColorValue(resolved)
  if (parsed.alpha <= 0) {
    return null
  }
  return parsed
}

function addUniqueColor(
  colors: Map<string, ColorValue>,
  color: ColorValue | null
): void {
  if (!color) return
  colors.set(`${color.hex}:${color.alpha}`, color)
}

function isTextRenderingFormControl(element: HTMLElement): boolean {
  if (element instanceof HTMLTextAreaElement) return true
  if (element instanceof HTMLSelectElement) return true
  if (element instanceof HTMLButtonElement) return true
  if (element instanceof HTMLInputElement) {
    const textlessInputTypes = new Set([
      'hidden',
      'checkbox',
      'radio',
      'range',
      'color',
      'file',
      'image',
    ])
    return !textlessInputTypes.has(element.type.toLowerCase())
  }
  return false
}

function hasRenderableTextNode(element: HTMLElement): boolean {
  if (element.isContentEditable) return true
  if (isTextRenderingFormControl(element)) return true
  if (!element.textContent?.trim()) return false
  if (hasDirectNonWhitespaceText(element)) return true
  const tagName = element.tagName.toLowerCase()
  return TEXT_ELEMENT_TAGS.has(tagName) || element.children.length === 0
}

export function getComputedBoxShadow(element: HTMLElement): string {
  const computed = window.getComputedStyle(element)
  const value = computed.boxShadow.trim()
  return value || 'none'
}

export function getComputedColorStyles(element: HTMLElement): ColorProperties {
  const computed = window.getComputedStyle(element)

  const borderSides = [
    { style: computed.borderTopStyle, width: computed.borderTopWidth, color: computed.borderTopColor },
    { style: computed.borderRightStyle, width: computed.borderRightWidth, color: computed.borderRightColor },
    { style: computed.borderBottomStyle, width: computed.borderBottomWidth, color: computed.borderBottomColor },
    { style: computed.borderLeftStyle, width: computed.borderLeftWidth, color: computed.borderLeftColor },
  ]
  const visibleBorderSide = borderSides.find((side) => isVisibleBorderSide(side))
  const hasBorder = Boolean(visibleBorderSide)
  const hasOutline = hasVisibleOutline(computed)

  return {
    backgroundColor: parseColorValue(computed.backgroundColor),
    color: parseColorValue(computed.color),
    borderColor: hasBorder && visibleBorderSide ? parseColorValue(visibleBorderSide.color) : TRANSPARENT_COLOR,
    outlineColor: hasOutline ? parseColorValue(computed.outlineColor) : TRANSPARENT_COLOR,
  }
}

export function getSelectionColors(element: HTMLElement): ColorValue[] {
  const uniqueColors = new Map<string, ColorValue>()
  const queue: Element[] = [element]

  for (let index = 0; index < queue.length; index++) {
    const node = queue[index]
    const computed = window.getComputedStyle(node)

    if (computed.display === 'none') {
      // Entire subtree is not rendered; skip traversal for performance.
      continue
    }

    const isVisibilityHidden =
      computed.visibility === 'hidden' || computed.visibility === 'collapse'
    const currentTextColor = computed.color

    if (!isVisibilityHidden) {
      addUniqueColor(uniqueColors, parseVisibleColor(computed.backgroundColor))

      if (node instanceof HTMLElement && hasRenderableTextNode(node)) {
        addUniqueColor(uniqueColors, parseVisibleColor(currentTextColor))
      }

      const borderSides = [
        { style: computed.borderTopStyle, width: computed.borderTopWidth, color: computed.borderTopColor },
        { style: computed.borderRightStyle, width: computed.borderRightWidth, color: computed.borderRightColor },
        { style: computed.borderBottomStyle, width: computed.borderBottomWidth, color: computed.borderBottomColor },
        { style: computed.borderLeftStyle, width: computed.borderLeftWidth, color: computed.borderLeftColor },
      ]
      for (const side of borderSides) {
        if (!isVisibleBorderSide(side)) continue
        addUniqueColor(uniqueColors, parseVisibleColor(side.color, currentTextColor))
      }

      if (hasVisibleOutline(computed)) {
        addUniqueColor(uniqueColors, parseVisibleColor(computed.outlineColor, currentTextColor))
      }

      if (node instanceof SVGElement) {
        const fillColor =
          parseVisibleColor(computed.getPropertyValue('fill'), currentTextColor)
          ?? parseVisibleColor(node.getAttribute('fill') ?? '', currentTextColor)
        const strokeColor =
          parseVisibleColor(computed.getPropertyValue('stroke'), currentTextColor)
          ?? parseVisibleColor(node.getAttribute('stroke') ?? '', currentTextColor)
        addUniqueColor(uniqueColors, fillColor)
        addUniqueColor(uniqueColors, strokeColor)
      }
    }

    for (const child of node.children) {
      queue.push(child)
    }
  }

  return Array.from(uniqueColors.values())
}

export interface AllComputedStyles {
  spacing: SpacingProperties
  borderRadius: BorderRadiusProperties
  border: BorderProperties
  flex: FlexProperties
  sizing: SizingProperties
  color: ColorProperties
  boxShadow: string
  typography: TypographyProperties
}

export function getAllComputedStyles(element: HTMLElement): AllComputedStyles {
  const { spacing, borderRadius, flex } = getComputedStyles(element)
  return {
    spacing,
    borderRadius,
    border: getComputedBorderStyles(element),
    flex,
    sizing: getComputedSizing(element),
    color: getComputedColorStyles(element),
    boxShadow: getComputedBoxShadow(element),
    typography: getComputedTypography(element),
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
  const parentElement = element === document.body ? null : element.parentElement

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
  const width = Math.round(element.offsetWidth)
  const height = Math.round(element.offsetHeight)

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

  const zoom = getZoomScale()
  const measurements: MeasurementLine[] = []

  const topDistance = Math.round((elementRect.top - parentInnerTop) / zoom)
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

  const bottomDistance = Math.round((parentInnerBottom - elementRect.bottom) / zoom)
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

  const leftDistance = Math.round((elementRect.left - parentInnerLeft) / zoom)
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

  const rightDistance = Math.round((parentInnerRight - elementRect.right) / zoom)
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
  const zoom = getZoomScale()
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
      const distance = Math.round((toRect.left - fromRect.right) / zoom)
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
      const distance = Math.round((fromRect.left - toRect.right) / zoom)
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
      const distance = Math.round((toRect.top - fromRect.bottom) / zoom)
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
      const distance = Math.round((fromRect.top - toRect.bottom) / zoom)
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
      ? Math.round((toRect.left - fromRect.right) / zoom)
      : Math.round((fromRect.left - toRect.right) / zoom)

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
      ? Math.round((toRect.top - fromRect.bottom) / zoom)
      : Math.round((fromRect.top - toRect.bottom) / zoom)

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

  const snap = getCanvasSnapshot()
  const zoom = snap.active ? snap.zoom : 1
  const rect = element.getBoundingClientRect()
  const measurements: MeasurementLine[] = []

  for (const g of guidelines) {
    let viewportPos: number
    if (snap.active) {
      const pan = g.orientation === 'horizontal' ? snap.panY : snap.panX
      const bo = g.orientation === 'horizontal' ? getBodyOffset().y : getBodyOffset().x
      viewportPos = bo + (g.position - bo + pan) * zoom
    } else {
      const scroll = g.orientation === 'horizontal' ? window.scrollY : window.scrollX
      viewportPos = g.position - scroll
    }

    if (g.orientation === 'horizontal') {
      const midX = rect.left + rect.width / 2

      if (mousePosition && Math.abs(mousePosition.y - viewportPos) > GUIDELINE_PROXIMITY) continue

      if (viewportPos < rect.top) {
        const distance = Math.round((rect.top - viewportPos) / zoom)
        if (distance > 0) {
          measurements.push({
            direction: 'vertical',
            x1: midX,
            y1: viewportPos,
            x2: midX,
            y2: rect.top,
            distance,
            labelPosition: { x: midX, y: (viewportPos + rect.top) / 2 },
          })
        }
      } else if (viewportPos > rect.bottom) {
        const distance = Math.round((viewportPos - rect.bottom) / zoom)
        if (distance > 0) {
          measurements.push({
            direction: 'vertical',
            x1: midX,
            y1: rect.bottom,
            x2: midX,
            y2: viewportPos,
            distance,
            labelPosition: { x: midX, y: (rect.bottom + viewportPos) / 2 },
          })
        }
      }
    } else {
      const midY = rect.top + rect.height / 2

      if (mousePosition && Math.abs(mousePosition.x - viewportPos) > GUIDELINE_PROXIMITY) continue

      if (viewportPos < rect.left) {
        const distance = Math.round((rect.left - viewportPos) / zoom)
        if (distance > 0) {
          measurements.push({
            direction: 'horizontal',
            x1: viewportPos,
            y1: midY,
            x2: rect.left,
            y2: midY,
            distance,
            labelPosition: { x: (viewportPos + rect.left) / 2, y: midY },
          })
        }
      } else if (viewportPos > rect.right) {
        const distance = Math.round((viewportPos - rect.right) / zoom)
        if (distance > 0) {
          measurements.push({
            direction: 'horizontal',
            x1: rect.right,
            y1: midY,
            x2: viewportPos,
            y2: midY,
            distance,
            labelPosition: { x: (rect.right + viewportPos) / 2, y: midY },
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

/** True when the child participates in normal flow (not hidden, absolute, or fixed). */
export function isInFlowChild(el: HTMLElement): boolean {
  const cs = window.getComputedStyle(el)
  return cs.display !== 'none' && cs.position !== 'absolute' && cs.position !== 'fixed'
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
    if (!isInFlowChild(c)) continue
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

export function computeIntendedIndex(
  parent: HTMLElement,
  draggedElement: HTMLElement,
): {
  index: number
  siblingBefore: HTMLElement | null
  siblingAfter: HTMLElement | null
} {
  const { axis } = detectChildrenDirection(parent, draggedElement)
  const isHorizontal = axis === 'horizontal'
  const draggedRect = draggedElement.getBoundingClientRect()
  const intendedCenter = isHorizontal
    ? draggedRect.left + draggedRect.width / 2
    : draggedRect.top + draggedRect.height / 2

  const siblings: HTMLElement[] = []
  for (const c of parent.children) {
    if (!(c instanceof HTMLElement) || c === draggedElement) continue
    if (!isInFlowChild(c)) continue
    siblings.push(c)
  }

  if (siblings.length === 0) {
    return { index: 0, siblingBefore: null, siblingAfter: null }
  }

  for (let i = 0; i < siblings.length; i++) {
    const rect = siblings[i].getBoundingClientRect()
    const midpoint = isHorizontal
      ? rect.left + rect.width / 2
      : rect.top + rect.height / 2
    if (intendedCenter < midpoint) {
      return { index: i, siblingBefore: i > 0 ? siblings[i - 1] : null, siblingAfter: siblings[i] }
    }
  }

  return { index: siblings.length, siblingBefore: siblings[siblings.length - 1], siblingAfter: null }
}

function htmlChildren(el: HTMLElement): HTMLElement[] {
  return Array.from(el.children).filter(
    (child): child is HTMLElement => child instanceof HTMLElement
  )
}

/** Walk up from `element` to find the nearest flex/inline-flex ancestor, stopping at `boundary`. */
function findFlexAncestor(
  element: HTMLElement,
  boundary: HTMLElement | null,
): { flexParent: HTMLElement; child: HTMLElement } | null {
  let current: HTMLElement | null = element
  while (current && current !== document.body) {
    const parent: HTMLElement | null = current.parentElement
    if (!parent) break
    const display = getComputedStyle(parent).display
    if (display === 'flex' || display === 'inline-flex') {
      return { flexParent: parent, child: current }
    }
    if (boundary && parent === boundary) break
    current = parent
  }
  return null
}

export function computeHoverHighlight(
  elementUnder: HTMLElement | null,
  selectedElement: HTMLElement | null,
): { flexContainer: HTMLElement; children: HTMLElement[] } | null {
  if (
    !elementUnder ||
    elementUnder === document.body ||
    elementUnder === document.documentElement ||
    elementUnder.closest('[data-direct-edit]') ||
    elementUnder.closest('[data-direct-edit-host]') ||
    elementUnder === selectedElement
  ) {
    return null
  }

  // When hovering descendants of the selected element, stop walk-up at the boundary
  const boundary = selectedElement?.contains(elementUnder) ? selectedElement : null

  const ownDisplay = getComputedStyle(elementUnder).display
  if (ownDisplay === 'flex' || ownDisplay === 'inline-flex') {
    return { flexContainer: elementUnder, children: htmlChildren(elementUnder) }
  }

  const found = findFlexAncestor(elementUnder, boundary)
  if (found) {
    return { flexContainer: found.flexParent, children: htmlChildren(found.flexParent) }
  }

  return { flexContainer: elementUnder, children: [] }
}

export function resolveElementTarget(
  elementUnder: HTMLElement,
  selectedElement: HTMLElement | null,
): HTMLElement {
  const boundary = selectedElement?.contains(elementUnder) ? selectedElement : null
  const found = findFlexAncestor(elementUnder, boundary)
  if (found && found.flexParent === boundary) return elementUnder
  return found?.child ?? elementUnder
}

/** Finds the text-owning element at a point within `boundary` using browser caret hit-testing. */
export function findTextOwnerAtPoint(
  boundary: HTMLElement,
  clientX: number,
  clientY: number,
): HTMLElement | null {
  const doc = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node } | null
    caretRangeFromPoint?: (x: number, y: number) => Range | null
  }

  const caretNode =
    doc.caretPositionFromPoint?.(clientX, clientY)?.offsetNode
    ?? doc.caretRangeFromPoint?.(clientX, clientY)?.startContainer
    ?? null
  if (!caretNode || caretNode.nodeType !== Node.TEXT_NODE) return null

  const textNode = caretNode as Text
  if (!(textNode.nodeValue ?? '').trim()) return null

  const owner = textNode.parentElement
  if (!owner || !boundary.contains(owner)) return null
  if (owner.closest('[data-direct-edit]') || owner.closest('[data-direct-edit-host]')) return null

  // Guard against caret APIs returning nearby text nodes.
  const range = document.createRange()
  range.selectNodeContents(textNode)
  const hitsText = Array.from(range.getClientRects()).some(
    (r) => clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom
  )
  range.detach?.()
  return hitsText ? owner : null
}

/** Fallback text hit-testing by scanning text nodes and rendered rects within `boundary`. */
export function findTextOwnerByRangeScan(
  boundary: HTMLElement,
  clientX: number,
  clientY: number,
): HTMLElement | null {
  const walker = document.createTreeWalker(boundary, NodeFilter.SHOW_TEXT)
  let current: Node | null = walker.nextNode()

  while (current) {
    const textNode = current as Text
    if ((textNode.nodeValue ?? '').trim()) {
      const owner = textNode.parentElement
      if (
        owner &&
        boundary.contains(owner) &&
        !owner.closest('[data-direct-edit]') &&
        !owner.closest('[data-direct-edit-host]')
      ) {
        const range = document.createRange()
        range.selectNodeContents(textNode)
        const hitsText = Array.from(range.getClientRects()).some(
          (r) => clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom
        )
        range.detach?.()
        if (hitsText) return owner
      }
    }
    current = walker.nextNode()
  }

  return null
}

/** Wrap the direct text node under the point into a span so it becomes independently selectable. */
export function ensureDirectTextSpanAtPoint(
  parent: HTMLElement,
  clientX: number,
  clientY: number,
): HTMLElement | null {
  const directTextNodes = Array.from(parent.childNodes).filter(
    (node): node is Text => node.nodeType === Node.TEXT_NODE && Boolean(node.textContent?.trim())
  )

  for (const textNode of directTextNodes) {
    const range = document.createRange()
    range.selectNodeContents(textNode)
    const hitsText = Array.from(range.getClientRects()).some(
      (r) => clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom
    )
    range.detach?.()

    if (!hitsText) continue

    const span = document.createElement('span')
    span.setAttribute('data-direct-edit-generated', 'text-span')
    span.textContent = textNode.textContent ?? ''
    parent.replaceChild(span, textNode)
    return span
  }

  return null
}

/** When elementFromPoint returns the selected element (bare text, padding, gap),
 *  find the best child element to drill into at the given coordinates. */
export function findChildAtPoint(
  parent: HTMLElement,
  clientX: number,
  clientY: number,
): HTMLElement | null {
  const children = htmlChildren(parent)
  if (children.length === 0) return null

  // Direct hit: child whose bbox contains the click
  const hit = children.find((child) => {
    const r = child.getBoundingClientRect()
    return clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom
  })
  if (hit) return hit

  // Single-child fallback should not steal clicks from parent's direct text.
  if (children.length === 1 && !hasDirectNonWhitespaceText(parent)) return children[0]

  return null
}

export function elementFromPointWithoutOverlays(x: number, y: number): HTMLElement | null {
  const host = document.querySelector<HTMLElement>('[data-direct-edit-host]')
  if (host) host.style.display = 'none'
  const el = document.elementFromPoint(x, y) as HTMLElement | null
  if (host) host.style.display = ''
  return el
}

export function isLayoutContainer(element: HTMLElement): boolean {
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

export function findLayoutContainerAtPoint(
  x: number,
  y: number,
  exclude: HTMLElement | null,
  preferredParent?: HTMLElement | null,
): HTMLElement | null {
  const host = document.querySelector<HTMLElement>('[data-direct-edit-host]')
  if (host) host.style.display = 'none'
  const elements = document.elementsFromPoint(x, y) as HTMLElement[]
  if (host) host.style.display = ''

  for (const el of elements) {
    if (skipElement(el, exclude)) continue
    if (isLayoutContainer(el)) return el
  }

  if (preferredParent && isLayoutContainer(preferredParent)) {
    for (const el of elements) {
      if (el === preferredParent) return preferredParent
    }
  }

  return null
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

type ParsedStackFrame = {
  functionName?: string
  fileName?: string
  lineNumber?: number
  columnNumber?: number
  source?: string
  isServer?: boolean
}

const STACK_SOURCE_FILE_EXTENSION_REGEX = /\.(jsx|tsx|ts|js)$/
const STACK_BUNDLED_FILE_PATTERN_REGEX =
  /(\.min|bundle|chunk|vendor|vendors|runtime|polyfill|polyfills)\.(js|mjs|cjs)$|(chunk|bundle|vendor|vendors|runtime|polyfill|polyfills|framework|app|main|index)[-_.][A-Za-z0-9_-]{4,}\.(js|mjs|cjs)$|[\da-f]{8,}\.(js|mjs|cjs)$|[-_.][\da-f]{20,}\.(js|mjs|cjs)$|\/dist\/|\/build\/|\/.next\/|\/out\/|\/node_modules\/|\.webpack\.|\.vite\.|\.turbopack\./i
const FIREFOX_SAFARI_STACK_REGEXP = /(^|@)\S+:\d+/
const SAFARI_NATIVE_CODE_REGEXP = /^(eval@)?(\[native code\])?$/
const SERVER_FRAME_MARKER = '(at Server)'

const STACK_INTERNAL_SCHEME_PREFIXES = [
  'rsc://',
  'about://React/',
  'React/Server/',
  'file:///',
  'webpack://',
  'webpack-internal://',
  'node:',
  'turbopack://',
  '/app-pages-browser/',
] as const

function formatOwnerDebugStack(stack: string): string {
  if (!stack) return ''

  const lines = stack.split('\n')
  const filtered: string[] = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue
    if (trimmed === 'Error: react-stack-top-frame') continue
    if (
      trimmed.includes('react_stack_bottom_frame') ||
      trimmed.includes('react-stack-bottom-frame')
    ) {
      continue
    }
    filtered.push(line)
  }

  if (filtered.length > 0 && filtered[0].includes('fakeJSXCallSite')) {
    filtered.shift()
  }

  return filtered.join('\n')
}

function extractStackLocation(urlLike: string): [string, number | undefined, number | undefined] {
  if (!urlLike.includes(':')) return [urlLike, undefined, undefined]

  const isWrappedLocation = urlLike.startsWith('(') && /:\d+\)$/.test(urlLike)
  const sanitizedResult = isWrappedLocation ? urlLike.slice(1, -1) : urlLike
  const parts = /(.+?)(?::(\d+))?(?::(\d+))?$/.exec(sanitizedResult)
  if (!parts) return [sanitizedResult, undefined, undefined]

  return [
    parts[1],
    parts[2] !== undefined ? Number(parts[2]) : undefined,
    parts[3] !== undefined ? Number(parts[3]) : undefined,
  ]
}

function parseV8StackLine(line: string): ParsedStackFrame | null {
  let currentLine = line
  if (currentLine.includes('(eval ')) {
    currentLine = currentLine
      .replace(/eval code/g, 'eval')
      .replace(/(\(eval at [^()]*)|(,.*$)/g, '')
  }

  let sanitizedLine = currentLine
    .replace(/^\s+/, '')
    .replace(/\(eval code/g, '(')
    .replace(/^.*?\s+/, '')
  const locationMatch = sanitizedLine.match(/ (\(.+\)$)/)
  if (locationMatch) {
    sanitizedLine = sanitizedLine.replace(locationMatch[0], '')
  }

  const [fileName, lineNumber, columnNumber] = extractStackLocation(
    locationMatch ? locationMatch[1] : sanitizedLine
  )
  const functionName = locationMatch && sanitizedLine ? sanitizedLine : undefined
  if (fileName === 'eval' || fileName === '<anonymous>') {
    return {
      functionName,
    }
  }

  return {
    functionName,
    fileName,
    lineNumber,
    columnNumber,
    source: currentLine,
    isServer: currentLine.includes(SERVER_FRAME_MARKER) || fileName.startsWith('rsc://'),
  }
}

function parseFFOrSafariStackLine(line: string): ParsedStackFrame | null {
  let currentLine = line
  if (currentLine.includes(' > eval')) {
    currentLine = currentLine.replace(
      / line (\d+)(?: > eval line \d+)* > eval:\d+:\d+/g,
      ':$1'
    )
  }

  const trimmed = currentLine.trim()
  if (!trimmed || SAFARI_NATIVE_CODE_REGEXP.test(trimmed)) {
    return null
  }

  if (!trimmed.includes('@') && !trimmed.includes(':')) {
    return {
      functionName: trimmed,
      source: currentLine,
      isServer: trimmed.includes(SERVER_FRAME_MARKER),
    }
  }

  const atIndex = trimmed.lastIndexOf('@')
  if (atIndex === -1) {
    return null
  }
  const maybeFunctionName = trimmed.slice(0, atIndex)
  const location = trimmed.slice(atIndex + 1)
  const [fileName, lineNumber, columnNumber] = extractStackLocation(location)

  return {
    functionName: maybeFunctionName || undefined,
    fileName,
    lineNumber,
    columnNumber,
    source: currentLine,
    isServer: currentLine.includes(SERVER_FRAME_MARKER) || fileName.startsWith('rsc://'),
  }
}

function parseInStackLine(line: string): ParsedStackFrame | null {
  const functionName = line
    .replace(/^\s*in\s+/, '')
    .replace(/\s*\(at .*\)$/, '')
    .trim()
  if (!functionName) return null

  return {
    functionName,
    source: line,
    isServer: line.includes(SERVER_FRAME_MARKER),
  }
}

function parseDebugStack(stack: string): ParsedStackFrame[] {
  const frames: ParsedStackFrame[] = []
  for (const rawLine of stack.split('\n')) {
    if (FIREFOX_SAFARI_STACK_REGEXP.test(rawLine)) {
      const parsed = parseFFOrSafariStackLine(rawLine)
      if (parsed) frames.push(parsed)
      continue
    }

    if (/^\s*at\s+/.test(rawLine)) {
      const parsed = parseV8StackLine(rawLine)
      if (parsed) frames.push(parsed)
      continue
    }

    if (/^\s*in\s+/.test(rawLine)) {
      const parsed = parseInStackLine(rawLine)
      if (parsed) frames.push(parsed)
    }
  }

  return frames
}

function normalizeStackFileName(fileName: string): string {
  if (!fileName) return ''

  let normalized = fileName
  const isHttpUrl = normalized.startsWith('http://') || normalized.startsWith('https://')
  if (isHttpUrl) {
    try {
      normalized = new URL(normalized).pathname
    } catch {
      // Fall through and use the original string.
    }
  }

  let didStripPrefix = true
  while (didStripPrefix) {
    didStripPrefix = false
    for (const prefix of STACK_INTERNAL_SCHEME_PREFIXES) {
      if (normalized.startsWith(prefix)) {
        normalized = normalized.slice(prefix.length)
        if (prefix === 'file:///') {
          normalized = `/${normalized.replace(/^\/+/, '')}`
        }
        didStripPrefix = true
        break
      }
    }
  }

  normalized = normalized
    .replace(/^\/\(app-pages-browser\)\//, '/')
    .replace(/^\/\.\//, '/')
    .replace(/^\.\//, '')

  const queryIndex = normalized.indexOf('?')
  if (queryIndex !== -1) {
    normalized = normalized.slice(0, queryIndex)
  }

  return normalized
}

function isSourceStackFile(fileName: string): boolean {
  const normalizedFileName = normalizeStackFileName(fileName)
  if (!normalizedFileName) return false
  if (!STACK_SOURCE_FILE_EXTENSION_REGEX.test(normalizedFileName)) return false
  return !STACK_BUNDLED_FILE_PATTERN_REGEX.test(normalizedFileName)
}

type EnrichedServerFrame = {
  fileName: string
  lineNumber?: number
  columnNumber?: number
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildFunctionNameToRscFramesMap(fiber: any): Map<string, EnrichedServerFrame[]> {
  const functionNameToRscFrames = new Map<string, EnrichedServerFrame[]>()
  const visited = new Set<any>()
  let current = fiber

  while (current && !visited.has(current)) {
    visited.add(current)
    const rawStack = current?._debugStack?.stack
    const stack = typeof rawStack === 'string' ? formatOwnerDebugStack(rawStack) : ''
    if (stack) {
      const frames = parseDebugStack(stack)
      for (const frame of frames) {
        if (!frame.functionName || !frame.fileName) continue
        if (!frame.fileName.startsWith('rsc://')) continue

        const normalized = normalizeStackFileName(frame.fileName)
        if (!normalized) continue

        const existing = functionNameToRscFrames.get(frame.functionName) ?? []
        const duplicate = existing.some(
          (candidate) =>
            candidate.fileName === normalized &&
            candidate.lineNumber === frame.lineNumber &&
            candidate.columnNumber === frame.columnNumber
        )
        if (!duplicate) {
          existing.push({
            fileName: normalized,
            lineNumber: frame.lineNumber,
            columnNumber: frame.columnNumber,
          })
          functionNameToRscFrames.set(frame.functionName, existing)
        }
      }
    }

    current = current._debugOwner ?? current.return ?? null
  }

  return functionNameToRscFrames
}

function enrichServerFrame(
  frame: ParsedStackFrame,
  functionNameToRscFrames: Map<string, EnrichedServerFrame[]>,
  functionNameToUsageIndex: Map<string, number>,
): ParsedStackFrame {
  if (!frame.functionName) return frame

  const available = functionNameToRscFrames.get(frame.functionName)
  if (!available) return frame

  const usageIndex = functionNameToUsageIndex.get(frame.functionName) ?? 0
  const resolved = available[usageIndex % available.length]
  functionNameToUsageIndex.set(frame.functionName, usageIndex + 1)

  return {
    ...frame,
    fileName: resolved.fileName,
    lineNumber: resolved.lineNumber,
    columnNumber: resolved.columnNumber,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getSourceFromDebugStack(fiber: any):
  | {
      fileName?: string
      lineNumber?: number
      columnNumber?: number
    }
  | null {
  const rawStack = fiber?._debugStack?.stack
  if (typeof rawStack !== 'string' || rawStack.length === 0) {
    return null
  }

  const formattedStack = formatOwnerDebugStack(rawStack)
  if (!formattedStack) return null

  const stackFrames = parseDebugStack(formattedStack)
  const functionNameToRscFrames = buildFunctionNameToRscFramesMap(fiber)
  const functionNameToUsageIndex = new Map<string, number>()

  for (const frame of stackFrames) {
    const maybeEnriched = frame.isServer
      ? enrichServerFrame(frame, functionNameToRscFrames, functionNameToUsageIndex)
      : frame
    if (!maybeEnriched.fileName) continue

    const normalizedFileName = normalizeStackFileName(maybeEnriched.fileName)
    if (!normalizedFileName) continue

    if (isSourceStackFile(normalizedFileName)) {
      return {
        fileName: normalizedFileName,
        lineNumber: maybeEnriched.lineNumber,
        columnNumber: maybeEnriched.columnNumber,
      }
    }
  }

  return null
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

  const fromDebugStack = getSourceFromDebugStack(fiber)
  if (fromDebugStack?.fileName) return fromDebugStack

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

interface ChildBriefInfo {
  name: string
  textPreview: string
  source: DomSourceLocation | null
}

export function getElementDisplayName(element: HTMLElement): string {
  const tag = element.tagName.toLowerCase()
  if (element.id) return `${tag}#${element.id}`
  const firstClass = Array.from(element.classList)
    .find(c => c && !c.startsWith('direct-edit'))
  if (firstClass) return `${tag}.${firstClass}`
  return tag
}

/** Lightweight info for a child element, used in reorder data. Does NOT call getElementLocator. */
export function getChildBriefInfo(element: HTMLElement): ChildBriefInfo {
  const name = getElementDisplayName(element)
  const raw = ((element.innerText || element.textContent) ?? '').replace(/\s+/g, ' ').trim()
  const textPreview = raw.length > 40 ? `${raw.slice(0, 37)}...` : raw
  const source = getElementSource(element)
  return { name, textPreview, source }
}

const STABLE_ATTRIBUTES = ['data-testid', 'data-qa', 'data-cy', 'aria-label', 'role'] as const
const MAX_SELECTOR_DEPTH = 24
const CONTEXT_ALLOWED_ATTRIBUTES = new Set([
  'id',
  'class',
  'href',
  'src',
  'alt',
  'aria-label',
  'role',
  'data-testid',
  'data-qa',
  'data-cy',
  'data-direct-edit-target',
])

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

function sanitizeContextNode(root: HTMLElement) {
  const nodes: HTMLElement[] = [root, ...Array.from(root.querySelectorAll<HTMLElement>('*'))]
  for (const node of nodes) {
    for (const attr of Array.from(node.attributes)) {
      if (!CONTEXT_ALLOWED_ATTRIBUTES.has(attr.name)) {
        node.removeAttribute(attr.name)
      }
    }
  }
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
    .replace(/^webpack-internal:\/\//, '')
    .replace(/^rsc:\/\/React\/Server\//, '')
    .replace(/^about:\/\/React\//, '')
    .replace(/^file:\/\//, '')
    .replace(/^\/\(app-pages-browser\)\//, '/')
    .replace(/^\/app-pages-browser\//, '/')
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
    const clone = element.cloneNode(true) as HTMLElement
    clone.setAttribute('data-direct-edit-target', 'true')
    stripDirectEditNodes(clone)
    sanitizeContextNode(clone)
    return clone.outerHTML
  }

  const parentClone = parent.cloneNode(false) as HTMLElement
  const siblings = Array.from(parent.children) as HTMLElement[]
  const selectedIndex = siblings.indexOf(element)
  const siblingCount = options?.siblingCount ?? 1
  let slice = siblings

  if (siblingCount >= 0 && selectedIndex >= 0) {
    const start = Math.max(0, selectedIndex - siblingCount)
    const end = Math.min(siblings.length, selectedIndex + siblingCount + 1)
    slice = siblings.slice(start, end)
  }

  for (const sibling of slice) {
    if (sibling.closest('[data-direct-edit]')) continue
    const clone = sibling.cloneNode(true) as HTMLElement
    if (sibling === element) {
      clone.setAttribute('data-direct-edit-target', 'true')
    }
    stripDirectEditNodes(clone)
    sanitizeContextNode(clone)
    parentClone.appendChild(clone)
  }

  sanitizeContextNode(parentClone)
  return parentClone.outerHTML
}

function normalizePreviewWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function isWordLikeChar(char: string): boolean {
  return /[A-Za-z0-9]/.test(char)
}

function getFallbackTextPreview(element: HTMLElement): string {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
  const tokens: string[] = []
  let previousRaw = ''
  let previousParent: HTMLElement | null = null

  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const textNode = node as Text
    const raw = textNode.textContent ?? ''
    const normalized = normalizePreviewWhitespace(raw)
    if (!normalized) continue

    if (tokens.length > 0) {
      const hasExplicitWhitespace = /^\s/.test(raw) || /\s$/.test(previousRaw)
      const prevLast = previousRaw.slice(-1)
      const nextFirst = normalized[0]
      const shouldInsertHeuristicSpace =
        previousParent !== textNode.parentElement &&
        isWordLikeChar(prevLast) &&
        isWordLikeChar(nextFirst)

      if (hasExplicitWhitespace || shouldInsertHeuristicSpace) {
        tokens.push(' ')
      }
    }

    tokens.push(normalized)
    previousRaw = raw
    previousParent = textNode.parentElement
  }

  return tokens.join('')
}

function getTextPreview(element: HTMLElement): string {
  const innerTextCandidate = normalizePreviewWhitespace(element.innerText ?? '')
  const text = innerTextCandidate || getFallbackTextPreview(element)
  if (text.length <= 120) {
    return text
  }
  return `${text.slice(0, 117)}...`
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

/** Resolve the source location for an element: data-direct-edit-source attribute, then fiber fallback. */
export function getElementSource(element: HTMLElement): DomSourceLocation | null {
  const domSource = parseDomSource(element)
  if (domSource) return domSource

  // Fallback: get source from the element's own React fiber when
  // the Vite plugin attribute is not present
  const seenFibers = new Set<any>()
  let fiber = getFiberForElement(element)
  while (fiber && !seenFibers.has(fiber)) {
    seenFibers.add(fiber)
    const fiberSource = getSourceFromFiber(fiber)
    if (fiberSource?.fileName) {
      return {
        file: fiberSource.fileName,
        line: fiberSource.lineNumber,
        column: fiberSource.columnNumber,
      }
    }
    fiber = fiber._debugOwner ?? fiber.return ?? null
  }
  return null
}

export function getElementLocator(element: HTMLElement): ElementLocator {
  const elementInfo = getElementInfo(element)
  const domSource = getElementSource(element)

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

function getLocatorHeader(locator: ElementLocator): { componentLabel: string; formattedSource: string | null } {
  const primaryFrame = getPrimaryFrame(locator)
  const componentLabel = primaryFrame?.name ? primaryFrame.name : locator.tagName
  const formattedSource = locator.domSource?.file
    ? formatSourceLocation(locator.domSource.file, locator.domSource.line, locator.domSource.column)
    : primaryFrame?.file
      ? formatSourceLocation(primaryFrame.file, primaryFrame.line, primaryFrame.column)
      : null
  return { componentLabel, formattedSource }
}

function buildLocatorContextLines(locator: ElementLocator, options?: { skipContext?: boolean }): string[] {
  const lines: string[] = []
  const { componentLabel, formattedSource } = getLocatorHeader(locator)
  const target = (locator.targetHtml || locator.domContextHtml || '').trim()
  const context = locator.domContextHtml?.trim() || ''
  const selector = locator.domSelector?.trim()
  const text = locator.textPreview?.trim()

  lines.push(`@<${componentLabel}>`)
  lines.push('')
  if (target) {
    lines.push('target:')
    lines.push(target)
  }
  if (!options?.skipContext && context && context !== target) {
    lines.push('context:')
    lines.push(context)
  }
  lines.push(`in ${formattedSource ?? '(file not available)'}`)
  if (selector) {
    lines.push(`selector: ${selector}`)
  }
  if (text) {
    lines.push(`text: ${text}`)
  }

  return lines
}

export function buildElementContext(locator: ElementLocator): string {
  return buildLocatorContextLines(locator).join('\n')
}

const spacingGroups = [
  { top: 'padding-top', right: 'padding-right', bottom: 'padding-bottom', left: 'padding-left', all: 'padding', inline: 'padding-inline', block: 'padding-block' },
  { top: 'margin-top', right: 'margin-right', bottom: 'margin-bottom', left: 'margin-left', all: 'margin', inline: 'margin-inline', block: 'margin-block' },
] as const

export function collapseSpacingShorthands(styles: Record<string, string>): Record<string, string> {
  const result = { ...styles }

  for (const group of spacingGroups) {
    const hasTop = group.top in result
    const hasRight = group.right in result
    const hasBottom = group.bottom in result
    const hasLeft = group.left in result
    const hasAllSides = hasTop && hasRight && hasBottom && hasLeft

    if (hasAllSides) {
      delete result[group.all]
      delete result[group.inline]
      delete result[group.block]
    }

    const top = result[group.top]
    const right = result[group.right]
    const bottom = result[group.bottom]
    const left = result[group.left]

    const horizontalMatch = hasLeft && hasRight && left === right
    const verticalMatch = hasTop && hasBottom && top === bottom

    if (horizontalMatch && verticalMatch) {
      delete result[group.top]
      delete result[group.right]
      delete result[group.bottom]
      delete result[group.left]
      if (top === left) {
        result[group.all] = top
      } else {
        result[group.inline] = left
        result[group.block] = top
      }
    } else if (horizontalMatch) {
      // Only horizontal pair matches
      delete result[group.left]
      delete result[group.right]
      result[group.inline] = left
    } else if (verticalMatch) {
      // Only vertical pair matches
      delete result[group.top]
      delete result[group.bottom]
      result[group.block] = top
    }
  }

  return result
}

function collapseFourSideShorthand(
  result: Record<string, string>,
  sides: { top: string; right: string; bottom: string; left: string; all: string }
): void {
  if (!(sides.top in result && sides.right in result && sides.bottom in result && sides.left in result)) return

  // Side-specific values are the source of truth when all four are present.
  delete result[sides.all]

  const top = result[sides.top]
  const right = result[sides.right]
  const bottom = result[sides.bottom]
  const left = result[sides.left]
  const allEqual = top === right && top === bottom && top === left
  if (!allEqual) return

  delete result[sides.top]
  delete result[sides.right]
  delete result[sides.bottom]
  delete result[sides.left]
  result[sides.all] = top
}

export function collapseExportShorthands(styles: Record<string, string>): Record<string, string> {
  const result = collapseSpacingShorthands(styles)

  collapseFourSideShorthand(result, {
    top: 'border-top-style',
    right: 'border-right-style',
    bottom: 'border-bottom-style',
    left: 'border-left-style',
    all: 'border-style',
  })

  collapseFourSideShorthand(result, {
    top: 'border-top-width',
    right: 'border-right-width',
    bottom: 'border-bottom-width',
    left: 'border-left-width',
    all: 'border-width',
  })

  collapseFourSideShorthand(result, {
    top: 'border-top-left-radius',
    right: 'border-top-right-radius',
    bottom: 'border-bottom-right-radius',
    left: 'border-bottom-left-radius',
    all: 'border-radius',
  })

  return result
}

export function buildEditExport(
  locator: ElementLocator,
  pendingStyles: Record<string, string>,
  textEdit?: { originalText: string; newText: string } | null
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
  arg3?: SpacingProperties | null | { originalText: string; newText: string },
  arg4?: BorderRadiusProperties | null,
  arg5?: FlexProperties | null,
  arg6?: SizingProperties | null,
  arg7?: Record<string, string>
): string {
  const isLocator = Boolean(arg1 && typeof arg1 === 'object' && 'domSelector' in arg1)
  if (!isLocator) {
    void arg4
    void arg5
    void arg6
  }
  const pendingStyles = (isLocator ? (arg2 as Record<string, string>) : arg7) || {}
  const textEdit = isLocator && arg3 && typeof arg3 === 'object' && 'originalText' in arg3
    ? (arg3 as { originalText: string; newText: string })
    : null
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

  const collapsedStyles = collapseExportShorthands(pendingStyles)
  for (const [property, value] of Object.entries(collapsedStyles)) {
    const tailwindClass = stylesToTailwind({ [property]: value })
    changes.push({
      property,
      value,
      tailwind: tailwindClass,
    })
  }

  const lines = buildLocatorContextLines(locator)
  lines.push('')
  if (changes.length > 0) {
    lines.push('edits:')
    for (const change of changes) {
      const tailwind = change.tailwind ? ` (${change.tailwind})` : ''
      lines.push(`${change.property}: ${change.value}${tailwind}`)
    }
  }

  if (textEdit) {
    lines.push('text content changed:')
    lines.push(`from: "${textEdit.originalText}"`)
    lines.push(`to: "${textEdit.newText}"`)
  }

  return lines.join('\n')
}

/** Like buildEditExport but with options to skip context HTML (for move edits). */
function buildEditExportWithOptions(
  locator: ElementLocator,
  pendingStyles: Record<string, string>,
  textEdit?: { originalText: string; newText: string } | null,
  options?: { skipContext?: boolean }
): string {
  const changes: ExportChange[] = []
  const collapsedStyles = collapseExportShorthands(pendingStyles)
  for (const [property, value] of Object.entries(collapsedStyles)) {
    const tailwindClass = stylesToTailwind({ [property]: value })
    changes.push({ property, value, tailwind: tailwindClass })
  }

  const lines = buildLocatorContextLines(locator, options)
  lines.push('')
  if (changes.length > 0) {
    lines.push('edits:')
    for (const change of changes) {
      const tailwind = change.tailwind ? ` (${change.tailwind})` : ''
      lines.push(`${change.property}: ${change.value}${tailwind}`)
    }
  }

  if (textEdit) {
    lines.push('text content changed:')
    lines.push(`from: "${textEdit.originalText}"`)
    lines.push(`to: "${textEdit.newText}"`)
  }

  return lines.join('\n')
}

export function buildCommentExport(
  locator: ElementLocator,
  commentText: string,
  replies?: Array<{ text: string; createdAt: number }>
): string {
  const lines = buildLocatorContextLines(locator)
  lines.push('')
  lines.push(`comment: ${commentText}`)
  if (replies && replies.length > 0) {
    for (const reply of replies) {
      lines.push(`reply: ${reply.text}`)
    }
  }

  return lines.join('\n')
}

function normalizeSelector(selector: string | null | undefined): string | null {
  const value = selector?.trim()
  return value && value.length > 0 ? value : null
}

function normalizeName(name: string | null | undefined): string {
  return name?.trim().toLowerCase() || 'element'
}

function buildAnchorRef(
  name: string | null | undefined,
  selector: string | null | undefined,
  source: DomSourceLocation | null | undefined
): AnchorRef {
  return {
    name: name?.trim() || 'element',
    selector: normalizeSelector(selector),
    source: source?.file ? source : null,
  }
}

function anchorKey(anchor: AnchorRef | null | undefined): string {
  if (!anchor) return 'none'
  const selector = normalizeSelector(anchor.selector)
  if (selector) return `selector:${selector}`
  if (anchor.source?.file) {
    return `source:${anchor.source.file}:${anchor.source.line ?? 0}:${anchor.source.column ?? 0}`
  }
  return `name:${normalizeName(anchor.name)}`
}

function anchorsEqual(a: AnchorRef | null | undefined, b: AnchorRef | null | undefined): boolean {
  if (!a && !b) return true
  if (!a || !b) return false
  const aSelector = normalizeSelector(a.selector)
  const bSelector = normalizeSelector(b.selector)
  if (aSelector && bSelector) return aSelector === bSelector
  if (a.source?.file && b.source?.file) {
    return (
      a.source.file === b.source.file
      && (a.source.line ?? null) === (b.source.line ?? null)
      && (a.source.column ?? null) === (b.source.column ?? null)
    )
  }
  return normalizeName(a.name) === normalizeName(b.name)
}

function formatAnchorRef(anchor: AnchorRef | null | undefined, fallback = '(none)'): string {
  if (!anchor) return fallback
  const selector = normalizeSelector(anchor.selector)
  if (selector) return selector
  if (anchor.source?.file) return `<${anchor.name}> @ ${formatSourceLocation(anchor.source.file, anchor.source.line, anchor.source.column)}`
  return `<${anchor.name}>`
}

function buildPlacementRef(before: AnchorRef | null, after: AnchorRef | null): PlacementRef {
  if (before && after) {
    return {
      before,
      after,
      description: `between after ${formatAnchorRef(before)} and before ${formatAnchorRef(after)}`,
    }
  }
  if (before) {
    return {
      before,
      after: null,
      description: `after ${formatAnchorRef(before)}`,
    }
  }
  if (after) {
    return {
      before: null,
      after,
      description: `before ${formatAnchorRef(after)}`,
    }
  }
  return {
    before: null,
    after: null,
    description: 'as the only child',
  }
}

function buildPlacementFromMove(
  beforeName: string | null | undefined,
  beforeSelector: string | null | undefined,
  beforeSource: DomSourceLocation | null | undefined,
  afterName: string | null | undefined,
  afterSelector: string | null | undefined,
  afterSource: DomSourceLocation | null | undefined
): PlacementRef {
  const before = (beforeName || beforeSelector || beforeSource?.file)
    ? buildAnchorRef(beforeName, beforeSelector, beforeSource)
    : null
  const after = (afterName || afterSelector || afterSource?.file)
    ? buildAnchorRef(afterName, afterSelector, afterSource)
    : null
  return buildPlacementRef(before, after)
}

function toRoundedVisualDelta(move: NonNullable<SessionEdit['move']>): { x: number; y: number } | undefined {
  const delta = move.visualDelta ?? move.positionDelta
  if (!delta) return undefined
  const rounded = { x: Math.round(delta.x), y: Math.round(delta.y) }
  return rounded.x === 0 && rounded.y === 0 ? undefined : rounded
}

function hasVisualIntent(move: NonNullable<SessionEdit['move']>): boolean {
  return Boolean(toRoundedVisualDelta(move))
}

function hasStructuralChange(move: NonNullable<SessionEdit['move']>): boolean {
  const fromParent = buildAnchorRef(move.fromParentName, move.fromParentSelector, move.fromParentSource)
  const toParent = buildAnchorRef(move.toParentName, move.toParentSelector, move.toParentSource)
  const fromPlacement = buildPlacementFromMove(
    move.fromSiblingBefore,
    move.fromSiblingBeforeSelector,
    move.fromSiblingBeforeSource,
    move.fromSiblingAfter,
    move.fromSiblingAfterSelector,
    move.fromSiblingAfterSource,
  )
  const toPlacement = buildPlacementFromMove(
    move.toSiblingBefore,
    move.toSiblingBeforeSelector,
    move.toSiblingBeforeSource,
    move.toSiblingAfter,
    move.toSiblingAfterSelector,
    move.toSiblingAfterSource,
  )

  if (!anchorsEqual(fromParent, toParent)) return true
  if (!anchorsEqual(fromPlacement.before, toPlacement.before)) return true
  if (!anchorsEqual(fromPlacement.after, toPlacement.after)) return true
  if (typeof move.fromIndex === 'number' && typeof move.toIndex === 'number' && move.fromIndex !== move.toIndex) return true
  return false
}

function isStructuredLayoutContainer(layout: NonNullable<SessionEdit['move']>['fromParentLayout'] | undefined): boolean {
  return layout === 'flex' || layout === 'grid'
}

function isExistingFlexWorkflow(move: NonNullable<SessionEdit['move']>): boolean {
  const structuralChange = hasStructuralChange(move)
  if (!structuralChange) return false

  const fromParent = buildAnchorRef(move.fromParentName, move.fromParentSelector, move.fromParentSource)
  const toParent = buildAnchorRef(move.toParentName, move.toParentSelector, move.toParentSource)
  const sameParent = anchorsEqual(fromParent, toParent)
  const fromLayout = move.fromParentLayout
  const toLayout = move.toParentLayout

  if (sameParent) {
    return Boolean(move.mode === 'reorder' && (isStructuredLayoutContainer(toLayout) || isStructuredLayoutContainer(fromLayout)))
  }
  return Boolean(isStructuredLayoutContainer(fromLayout) && isStructuredLayoutContainer(toLayout))
}

function classifyMove(move: NonNullable<SessionEdit['move']>): MoveClassification | 'noop' {
  const structuralChange = hasStructuralChange(move)
  const visualIntent = hasVisualIntent(move)
  if (!structuralChange && !visualIntent) return 'noop'
  if (isExistingFlexWorkflow(move)) return 'existing_layout_move'
  if (move.mode === 'free' || move.mode === 'position') return 'layout_refactor'
  if (!structuralChange && visualIntent) return 'layout_refactor'
  return 'layout_refactor'
}

interface NumericCluster {
  center: number
  values: number[]
}

function buildNumericClusters(values: number[], tolerance: number): NumericCluster[] {
  if (values.length === 0) return []
  const sorted = [...values].sort((a, b) => a - b)
  const clusters: NumericCluster[] = [{ center: sorted[0], values: [sorted[0]] }]
  for (let i = 1; i < sorted.length; i++) {
    const value = sorted[i]
    const current = clusters[clusters.length - 1]
    if (Math.abs(value - current.center) <= tolerance) {
      current.values.push(value)
      current.center = current.values.reduce((sum, n) => sum + n, 0) / current.values.length
    } else {
      clusters.push({ center: value, values: [value] })
    }
  }
  return clusters
}

function inferFlexDirection(
  sameRowCount: number,
  sameColumnCount: number,
  visualDelta?: { x: number; y: number }
): { direction: 'row' | 'column'; reason: string } {
  if (sameRowCount > sameColumnCount) {
    return { direction: 'row', reason: 'Subject aligns with neighboring anchors on the same row.' }
  }
  if (sameColumnCount > sameRowCount) {
    return { direction: 'column', reason: 'Subject aligns with neighboring anchors on the same column.' }
  }
  if (sameRowCount > 0) {
    return { direction: 'row', reason: 'Detected row alignment in final geometry.' }
  }
  if (sameColumnCount > 0) {
    return { direction: 'column', reason: 'Detected column alignment in final geometry.' }
  }
  const horizontalDominant = Math.abs(visualDelta?.x ?? 0) >= Math.abs(visualDelta?.y ?? 0)
  return {
    direction: horizontalDominant ? 'row' : 'column',
    reason: 'Fell back to movement axis because anchor alignment was ambiguous.',
  }
}

function inferLayoutPrescription(
  edit: SessionEdit,
  operation: Omit<MoveOperation, 'operationId'>,
  reasons: string[]
): LayoutPrescription {
  const parent = edit.element.parentElement
  if (!parent || !edit.element.isConnected) {
    return {
      recommendedSystem: 'flex',
      intentPatterns: ['no_geometry_context'],
      refactorSteps: [
        `Reparent ${formatAnchorRef(operation.subject)} under ${formatAnchorRef(operation.to.parent)} at ${operation.to.placement.description}.`,
      ],
      styleSteps: [
        `Convert ${formatAnchorRef(operation.to.parent)} to flex and set a clear primary axis for this relationship.`,
        'Use `gap` for spacing and keep positioning static.',
      ],
      itemSteps: [
        'Remove any inline `left/top/transform` move artifacts from moved elements.',
      ],
    }
  }

  const children = Array.from(parent.children).filter(
    (node) => node instanceof HTMLElement && isInFlowChild(node) && !node.hasAttribute('data-direct-edit')
  ) as HTMLElement[]
  const childSnapshots = children.map((child) => {
    const rect = child.getBoundingClientRect()
    const locator = getElementLocator(child)
    const anchor = buildAnchorRef(getElementDisplayName(child), locator.domSelector, locator.domSource)
    return {
      child,
      rect,
      centerX: rect.left + rect.width / 2,
      centerY: rect.top + rect.height / 2,
      anchor,
      anchorLabel: formatAnchorRef(anchor),
    }
  })
  const subjectSnapshot = childSnapshots.find((snapshot) => snapshot.child === edit.element)
  const subjectRect = edit.element.getBoundingClientRect()
  const subjectCenterX = subjectRect.left + subjectRect.width / 2
  const subjectCenterY = subjectRect.top + subjectRect.height / 2
  const rowTolerance = Math.max(8, subjectRect.height * 0.35)
  const colTolerance = Math.max(8, subjectRect.width * 0.35)

  const sameRowWith: string[] = []
  const sameColumnWith: string[] = []
  const sameRowNodes: typeof childSnapshots = []
  let aboveAnchor: string | null = null
  let belowAnchor: string | null = null
  let bestAboveDistance = Number.POSITIVE_INFINITY
  let bestBelowDistance = Number.POSITIVE_INFINITY

  for (const node of childSnapshots) {
    if (node.child === edit.element) continue

    if (Math.abs(node.centerY - subjectCenterY) <= rowTolerance) {
      sameRowWith.push(node.anchorLabel)
      sameRowNodes.push(node)
    }
    if (Math.abs(node.centerX - subjectCenterX) <= colTolerance) {
      sameColumnWith.push(node.anchorLabel)
    }

    const yDelta = node.centerY - subjectCenterY
    if (yDelta < 0 && Math.abs(yDelta) < bestAboveDistance) {
      bestAboveDistance = Math.abs(yDelta)
      aboveAnchor = node.anchorLabel
    }
    if (yDelta > 0 && yDelta < bestBelowDistance) {
      bestBelowDistance = yDelta
      belowAnchor = node.anchorLabel
    }
  }

  const rowCenters = childSnapshots.map(({ centerY }) => centerY)
  const colCenters = childSnapshots.map(({ centerX }) => centerX)
  const rowClusters = buildNumericClusters(rowCenters, rowTolerance)
  const colClusters = buildNumericClusters(colCenters, colTolerance)
  const denseRowClusters = rowClusters.filter(cluster => cluster.values.length >= 2).length
  const denseColClusters = colClusters.filter(cluster => cluster.values.length >= 2).length
  const isTwoDimensional = childSnapshots.length >= 4 && denseRowClusters >= 2 && denseColClusters >= 2
  const recommendedSystem: 'flex' | 'grid' = isTwoDimensional ? 'grid' : 'flex'

  const intentPatterns: string[] = []
  if (sameRowWith.length > 0) intentPatterns.push(`same_row_with:${sameRowWith.slice(0, 3).join(', ')}`)
  if (sameColumnWith.length > 0) intentPatterns.push(`same_column_with:${sameColumnWith.slice(0, 3).join(', ')}`)
  if (aboveAnchor) intentPatterns.push(`below:${aboveAnchor}`)
  if (belowAnchor) intentPatterns.push(`above:${belowAnchor}`)
  if (sameRowWith.length === 0 && sameColumnWith.length === 0) intentPatterns.push('separate_cluster')

  const visualDelta = operation.visualDelta
  const flexDirectionInfo = inferFlexDirection(sameRowWith.length, sameColumnWith.length, visualDelta)
  const flexDirection = flexDirectionInfo.direction

  if (recommendedSystem === 'grid') {
    reasons.push('Detected multiple dense row and column clusters; a 2D layout system is likely intentional.')
    return {
      recommendedSystem: 'grid',
      intentPatterns,
      refactorSteps: [
        `Create/ensure a shared container around ${formatAnchorRef(operation.subject)} and related anchors under ${formatAnchorRef(operation.to.parent)}.`,
        `Reorder/reparent elements to satisfy placement ${operation.to.placement.description}.`,
      ],
      styleSteps: [
        `Set ${formatAnchorRef(operation.to.parent)} to grid with explicit template rows/columns for the final layout.`,
        'Use `gap` for consistent spacing and keep placement structural.',
      ],
      itemSteps: [
        `Set item alignment on ${formatAnchorRef(operation.subject)} with grid self-alignment (` + '`justify-self`/`align-self`).',
      ],
    }
  }

  reasons.push(`${flexDirectionInfo.reason} Use a 1D flex layout instead of literal drag replay.`)

  let hasStackedCluster = false
  const stackedAnchorLabels = new Set<string>()
  if (flexDirection === 'row' && subjectSnapshot) {
    for (const rowPeer of sameRowNodes) {
      for (const node of childSnapshots) {
        if (node.child === edit.element || node.child === rowPeer.child) continue
        const sameColumnAsPeer = Math.abs(node.centerX - rowPeer.centerX) <= colTolerance
        const verticallySeparated = Math.abs(node.centerY - rowPeer.centerY) > rowTolerance
        if (sameColumnAsPeer && verticallySeparated) {
          hasStackedCluster = true
          stackedAnchorLabels.add(rowPeer.anchorLabel)
          stackedAnchorLabels.add(node.anchorLabel)
        }
      }
    }
  }

  const hasBelowCluster = childSnapshots.some((node) => (
    node.child !== edit.element
    && node.centerY - subjectCenterY > rowTolerance * 1.5
    && Math.abs(node.centerY - subjectCenterY) > Math.abs(node.centerX - subjectCenterX)
  ))

  const refactorSteps = [
    `Ensure ${formatAnchorRef(operation.subject)} and referenced neighbors share a common container under ${formatAnchorRef(operation.to.parent)}.`,
    `Reparent/reorder nodes so ${formatAnchorRef(operation.subject)} lands ${operation.to.placement.description}.`,
  ]
  if (flexDirection === 'row' && hasStackedCluster) {
    const clusterSample = Array.from(stackedAnchorLabels).slice(0, 3).join(', ')
    refactorSteps.push(`Create a left-side content wrapper for vertically stacked items (${clusterSample}), and keep ${formatAnchorRef(operation.subject)} as the opposite-side sibling.`)
  }
  if (hasBelowCluster) {
    refactorSteps.push('Keep lower content sections in a separate block below the horizontal header row; do not force them into the same row.')
  }

  const styleSteps = [
    `Set ${formatAnchorRef(operation.to.parent)} to flex with direction ${flexDirection}.`,
    flexDirection === 'row'
      ? 'Use `justify-content: space-between` and `align-items: flex-start` when the moved element should sit on the opposite edge.'
      : 'Use `justify-content` / `align-items` to establish top-bottom alignment.',
    'Use `gap` for spacing between siblings.',
  ]
  if (flexDirection === 'row' && hasStackedCluster) {
    styleSteps.push('Set the content wrapper to `display: flex` with `flex-direction: column` and an appropriate vertical gap.')
  }

  return {
    recommendedSystem: 'flex',
    intentPatterns,
    refactorSteps,
    styleSteps,
    itemSteps: [
      `Apply item-level alignment (` + '`align-self`' + ` / flex-basis) only when needed for ${formatAnchorRef(operation.subject)}.`,
      'Do not use absolute positioning, top/left offsets, transforms, or margin hacks to simulate movement.',
    ],
  }
}

interface MovePlanEntry {
  edit: SessionEdit
  operation: Omit<MoveOperation, 'operationId'>
  sortKey: string
}

export interface MovePlanContext {
  movePlan: MovePlan | null
  intentsByEdit: Map<SessionEdit, MoveIntent>
  noopMoveCount: number
}

function buildMoveEntries(edits: SessionEdit[]): {
  entries: MovePlanEntry[]
  noopMoveCount: number
} {
  const entries: MovePlanEntry[] = []
  let noopMoveCount = 0

  for (const edit of edits) {
    const move = edit.move
    if (!move) continue

    const subject = buildAnchorRef(
      getElementDisplayName(edit.element) || edit.locator.tagName,
      edit.locator.domSelector,
      edit.locator.domSource,
    )
    const fromParent = buildAnchorRef(move.fromParentName, move.fromParentSelector, move.fromParentSource)
    const toParent = buildAnchorRef(move.toParentName, move.toParentSelector, move.toParentSource)
    const fromPlacement = buildPlacementFromMove(
      move.fromSiblingBefore,
      move.fromSiblingBeforeSelector,
      move.fromSiblingBeforeSource,
      move.fromSiblingAfter,
      move.fromSiblingAfterSelector,
      move.fromSiblingAfterSource,
    )
    const toPlacement = buildPlacementFromMove(
      move.toSiblingBefore,
      move.toSiblingBeforeSelector,
      move.toSiblingBeforeSource,
      move.toSiblingAfter,
      move.toSiblingAfterSelector,
      move.toSiblingAfterSource,
    )

    const reasons: string[] = []
    const classification = classifyMove(move)
    if (classification === 'noop') {
      noopMoveCount++
      continue
    }

    const interactionMode = move.mode ?? 'free'
    const visualDelta = toRoundedVisualDelta(move)
    if (visualDelta) {
      reasons.push(`Non-zero visual delta detected (${visualDelta.x}px, ${visualDelta.y}px).`)
    }

    const structuralChange = hasStructuralChange(move)
    if (structuralChange) reasons.push('Anchor placement changed between source and target.')
    else reasons.push('No anchor placement change; treating movement as layout intent translation.')

    const operationBase: Omit<MoveOperation, 'operationId'> = {
      classification,
      interactionMode,
      subject,
      from: { parent: fromParent, placement: fromPlacement },
      to: { parent: toParent, placement: toPlacement },
      ...(visualDelta ? { visualDelta } : {}),
      confidence: classification === 'existing_layout_move'
        ? 'high'
        : structuralChange
          ? 'medium'
          : 'high',
      reasons,
    }

    if (classification === 'layout_refactor') {
      operationBase.layoutPrescription = inferLayoutPrescription(edit, operationBase, reasons)
    }

    const sortSource = subject.source?.file
      ? `${subject.source.file}:${subject.source.line ?? 0}:${subject.source.column ?? 0}`
      : ''
    const sortKey = [
      sortSource,
      anchorKey(subject),
      anchorKey(toParent),
      toPlacement.description,
    ].join('|')
    entries.push({ edit, operation: operationBase, sortKey })
  }

  entries.sort((a, b) => a.sortKey.localeCompare(b.sortKey))
  return { entries, noopMoveCount }
}

export function buildMovePlanContext(
  edits: SessionEdit[],
  _domContext?: unknown
): MovePlanContext {
  const { entries, noopMoveCount } = buildMoveEntries(edits)
  if (entries.length === 0) {
    return {
      movePlan: null,
      intentsByEdit: new Map(),
      noopMoveCount,
    }
  }

  const operations: MoveOperation[] = []
  const intentsByEdit = new Map<SessionEdit, MoveIntent>()
  for (let i = 0; i < entries.length; i++) {
    const operationId = `op-${i + 1}`
    const operation: MoveOperation = { operationId, ...entries[i].operation }
    operations.push(operation)
    intentsByEdit.set(entries[i].edit, operation)
  }

  const affectedContainerMap = new Map<string, AnchorRef>()
  for (const operation of operations) {
    affectedContainerMap.set(anchorKey(operation.from.parent), operation.from.parent)
    affectedContainerMap.set(anchorKey(operation.to.parent), operation.to.parent)
  }

  const orderingConstraints = operations
    .filter(op => op.classification === 'existing_layout_move')
    .map(op => `${op.operationId}: place ${formatAnchorRef(op.subject)} ${op.to.placement.description} in ${formatAnchorRef(op.to.parent)}.`)

  const notes: string[] = []
  if (noopMoveCount > 0) notes.push(`Excluded ${noopMoveCount} no-op move(s).`)
  if (operations.some(op => op.classification === 'layout_refactor')) {
    notes.push('Layout refactor operations include best-practice flex/grid prescriptions.')
  }

  return {
    movePlan: {
      operations,
      affectedContainers: Array.from(affectedContainerMap.values()),
      orderingConstraints,
      notes,
    },
    intentsByEdit,
    noopMoveCount,
  }
}

export function buildMovePlan(edits: SessionEdit[], domContext?: unknown): MovePlan {
  const context = buildMovePlanContext(edits, domContext)
  return context.movePlan ?? {
    operations: [],
    affectedContainers: [],
    orderingConstraints: [],
    notes: context.noopMoveCount > 0 ? [`Excluded ${context.noopMoveCount} no-op move(s).`] : [],
  }
}

export function getMoveIntentForEdit(
  edit: SessionEdit,
  context?: MovePlanContext | null
): MoveIntent | null {
  if (!edit.move) return null
  if (context?.intentsByEdit.has(edit)) return context.intentsByEdit.get(edit) ?? null
  const singleContext = buildMovePlanContext([edit])
  return singleContext.intentsByEdit.get(edit) ?? null
}

function buildMoveInstructionFromIntent(intent: MoveIntent): string {
  if (intent.classification === 'existing_layout_move') {
    return `Apply as a structural move in code: place ${formatAnchorRef(intent.subject)} ${intent.to.placement.description} in ${formatAnchorRef(intent.to.parent)}.`
  }
  const system = intent.layoutPrescription?.recommendedSystem ?? 'flex'
  return `Treat this as a ${system} layout refactor. Implement the listed structure/style steps in source code instead of drag replay.`
}

function formatMoveType(classification: MoveClassification): 'structural_move' | 'layout_refactor' {
  return classification === 'existing_layout_move' ? 'structural_move' : 'layout_refactor'
}

function buildMoveExportLines(intent: MoveIntent): string[] {
  const moveType = formatMoveType(intent.classification)
  const implementationSteps: string[] = []
  if (intent.classification === 'existing_layout_move') {
    implementationSteps.push(`Reorder/reparent ${formatAnchorRef(intent.subject)} to ${intent.to.placement.description} in ${formatAnchorRef(intent.to.parent)}.`)
  } else {
    const prescription = intent.layoutPrescription
    if (prescription) {
      implementationSteps.push(...prescription.refactorSteps)
      implementationSteps.push(...prescription.styleSteps)
      implementationSteps.push(...prescription.itemSteps)
    }
  }

  const lines: string[] = [
    'moved:',
    `id: ${intent.operationId}`,
    `type: ${moveType}`,
    `subject: ${formatAnchorRef(intent.subject, '(unknown)')}`,
    `parent: ${formatAnchorRef(intent.to.parent, '(unknown)')}`,
    `current_anchor: ${intent.from.placement.description}`,
    `target_anchor: ${intent.to.placement.description}`,
    ...(intent.visualDelta
      ? [`visual_hint: ${intent.visualDelta.x}px horizontal, ${intent.visualDelta.y}px vertical`]
      : []),
  ]

  if (intent.layoutPrescription) {
    lines.push(`recommended_layout: ${intent.layoutPrescription.recommendedSystem}`)
  }

  lines.push('implementation_steps:')
  for (const step of implementationSteps) {
    lines.push(`  - ${step}`)
  }

  lines.push('guardrails:')
  lines.push('  - Do not simulate movement with absolute positioning, left/top offsets, transform, or margin hacks.')
  lines.push(`instruction: ${buildMoveInstructionFromIntent(intent)}`)
  return lines
}

interface SessionExportOptions {
  movePlanContext?: MovePlanContext | null
  includeMovePlanHeader?: boolean
}

interface ExportContentProfile {
  hasCssEdits: boolean
  hasTextEdits: boolean
  hasMoves: boolean
  hasComments: boolean
}

export function getExportContentProfile(
  edits: SessionEdit[],
  comments: Comment[],
  movePlanOrContext?: MovePlan | MovePlanContext | null
): ExportContentProfile {
  const moveOpCount = movePlanOrContext
    ? ('operations' in movePlanOrContext
      ? movePlanOrContext.operations.length
      : (movePlanOrContext.movePlan?.operations.length ?? 0))
    : (buildMovePlanContext(edits).movePlan?.operations.length ?? 0)

  return {
    hasCssEdits: edits.some(e => Object.keys(e.pendingStyles).length > 0),
    hasTextEdits: edits.some(e => e.textEdit != null),
    hasMoves: moveOpCount > 0,
    hasComments: comments.length > 0,
  }
}

export function buildExportInstruction(profile: ExportContentProfile): string {
  const { hasCssEdits, hasTextEdits, hasMoves, hasComments } = profile

  if (!hasCssEdits && !hasTextEdits && !hasMoves && !hasComments) return ''

  if (!hasCssEdits && !hasTextEdits && !hasMoves) {
    return hasComments
      ? 'Address this feedback on the UI. Use the provided source location and selector to find each element in the codebase.'
      : ''
  }

  const parts: string[] = []
  if (hasCssEdits) parts.push('Apply the CSS changes to the targeted elements using the project\'s existing styling approach (Tailwind, CSS modules, etc.).')
  if (hasTextEdits) parts.push('Update the text content as specified.')
  if (hasMoves) parts.push('Implement the move plan below directly in source code. For `structural_move`, reorder/reparent elements using the target anchors. For `layout_refactor`, apply the listed flex/grid refactor steps. Do NOT simulate movement with absolute positioning, left/top offsets, transform, or margin hacks.')
  if (hasComments) parts.push('Address the comments on the relevant elements.')

  return `${parts.join(' ')} Use the provided source locations, selectors, and context HTML to locate each element in the codebase.`
}

export function buildSessionExport(
  edits: SessionEdit[],
  comments: Comment[] = [],
  options?: SessionExportOptions
): string {
  const blocks: string[] = []
  const planContext = options?.movePlanContext ?? buildMovePlanContext(edits)
  const movePlan = planContext.movePlan
  const includeMovePlanHeader = options?.includeMovePlanHeader !== false

  if (includeMovePlanHeader && movePlan && movePlan.operations.length > 0) {
    const planLines: string[] = [
      '=== LAYOUT MOVE PLAN ===',
      `operations: ${movePlan.operations.length}`,
    ]
    if (movePlan.affectedContainers.length > 0) {
      planLines.push('containers:')
      for (const container of movePlan.affectedContainers) {
        planLines.push(`  - ${formatAnchorRef(container, '(unknown)')}`)
      }
    }
    if (movePlan.orderingConstraints.length > 0) {
      planLines.push('structural_constraints:')
      for (const constraint of movePlan.orderingConstraints) {
        planLines.push(`  - ${constraint}`)
      }
    }
    if (movePlan.notes.length > 0) {
      planLines.push('plan_notes:')
      for (const note of movePlan.notes) {
        planLines.push(`  - ${note}`)
      }
    }
    blocks.push(planLines.join('\n'))
  }

  for (const edit of edits) {
    const moveIntent = getMoveIntentForEdit(edit, planContext)
    const hasMove = Boolean(moveIntent)
    const hasStyleOrText = Object.keys(edit.pendingStyles).length > 0 || edit.textEdit != null
    if (!hasMove && !hasStyleOrText) continue

    const block = hasMove
      ? buildEditExportWithOptions(edit.locator, edit.pendingStyles, edit.textEdit, { skipContext: true })
      : buildEditExport(edit.locator, edit.pendingStyles, edit.textEdit)

    let moveBlock = ''
    if (moveIntent) {
      moveBlock = `\n${buildMoveExportLines(moveIntent).join('\n')}`
    }
    blocks.push(block + moveBlock)
  }

  for (const comment of comments) {
    blocks.push(buildCommentExport(comment.locator, comment.text, comment.replies))
  }

  return blocks.join('\n\n---\n\n')
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
