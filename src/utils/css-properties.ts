import type {
  CSSPropertyValue,
  SpacingProperties,
  BorderRadiusProperties,
  BorderStyle,
  BorderProperties,
  FlexProperties,
  SpacingPropertyKey,
  BorderRadiusPropertyKey,
  BorderPropertyKey,
  FlexPropertyKey,
  SizingPropertyKey,
  TypographyPropertyKey,
  TypographyProperties,
  SizingProperties,
  SizingValue,
  SizingMode,
} from '../types'

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
