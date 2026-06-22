import type {
  CSSPropertyValue,
  SpacingProperties,
  BorderRadiusProperties,
  BorderStyle,
  BorderProperties,
  FlexProperties,
  SizingProperties,
  TypographyProperties,
  ColorValue,
  ColorProperties,
} from '../types'
import { parsePropertyValue } from './css-value'
import { getSizingValue, parseColorValue } from '../utils'

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

export function getComputedTypography(element: HTMLElement): TypographyProperties {
  const computed = window.getComputedStyle(element)

  let textVerticalAlign: TypographyProperties['textVerticalAlign'] = 'flex-start'
  if (computed.display === 'flex' || computed.display === 'inline-flex') {
    const alignItems = computed.alignItems
    if (alignItems === 'center') textVerticalAlign = 'center'
    else if (alignItems === 'flex-end' || alignItems === 'end') textVerticalAlign = 'flex-end'
  }

  // Handle "normal" keyword for line-height (use font-size as approximation)
  const lineHeight =
    computed.lineHeight === 'normal'
      ? {
          numericValue: parseFloat(computed.fontSize) * 1.2,
          unit: 'px' as const,
          raw: `${Math.round(parseFloat(computed.fontSize) * 1.2)}px`,
        }
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

export function getComputedSizing(element: HTMLElement): SizingProperties {
  return {
    width: getSizingValue(element, 'width'),
    height: getSizingValue(element, 'height'),
  }
}

const TEXT_ELEMENT_TAGS = new Set([
  'p',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'span',
  'label',
  'a',
  'strong',
  'em',
  'small',
  'blockquote',
  'li',
  'td',
  'th',
  'caption',
  'figcaption',
  'legend',
  'dt',
  'dd',
  'abbr',
  'cite',
  'code',
  'pre',
])

function hasDirectNonWhitespaceText(element: HTMLElement): boolean {
  return Array.from(element.childNodes).some(
    (node) => node.nodeType === Node.TEXT_NODE && Boolean(node.textContent?.trim())
  )
}

const TRANSPARENT_COLOR: ColorValue = { hex: '000000', alpha: 0, raw: 'transparent' }

function isVisibleBorderSide(side: { style: string; width: string }): boolean {
  return side.style !== 'none' && side.style !== 'hidden' && parseFloat(side.width) > 0
}

function hasVisibleOutline(computed: CSSStyleDeclaration): boolean {
  return computed.outlineStyle !== 'none' && parseFloat(computed.outlineWidth) > 0
}

function parseVisibleColor(value: string, fallbackCurrentColor?: string): ColorValue | null {
  const raw = value.trim()
  const lowered = raw.toLowerCase()
  if (!raw || lowered === 'none' || lowered === 'transparent') {
    return null
  }

  const resolved = /^currentcolor$/i.test(raw) ? (fallbackCurrentColor ?? raw) : raw
  const parsed = parseColorValue(resolved)
  if (parsed.alpha <= 0) {
    return null
  }
  return parsed
}

function addUniqueColor(colors: Map<string, ColorValue>, color: ColorValue | null): void {
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
    {
      style: computed.borderTopStyle,
      width: computed.borderTopWidth,
      color: computed.borderTopColor,
    },
    {
      style: computed.borderRightStyle,
      width: computed.borderRightWidth,
      color: computed.borderRightColor,
    },
    {
      style: computed.borderBottomStyle,
      width: computed.borderBottomWidth,
      color: computed.borderBottomColor,
    },
    {
      style: computed.borderLeftStyle,
      width: computed.borderLeftWidth,
      color: computed.borderLeftColor,
    },
  ]
  const visibleBorderSide = borderSides.find((side) => isVisibleBorderSide(side))
  const hasBorder = Boolean(visibleBorderSide)
  const hasOutline = hasVisibleOutline(computed)

  return {
    backgroundColor: parseColorValue(computed.backgroundColor),
    color: parseColorValue(computed.color),
    borderColor:
      hasBorder && visibleBorderSide ? parseColorValue(visibleBorderSide.color) : TRANSPARENT_COLOR,
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
        {
          style: computed.borderTopStyle,
          width: computed.borderTopWidth,
          color: computed.borderTopColor,
        },
        {
          style: computed.borderRightStyle,
          width: computed.borderRightWidth,
          color: computed.borderRightColor,
        },
        {
          style: computed.borderBottomStyle,
          width: computed.borderBottomWidth,
          color: computed.borderBottomColor,
        },
        {
          style: computed.borderLeftStyle,
          width: computed.borderLeftWidth,
          color: computed.borderLeftColor,
        },
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
          parseVisibleColor(computed.getPropertyValue('fill'), currentTextColor) ??
          parseVisibleColor(node.getAttribute('fill') ?? '', currentTextColor)
        const strokeColor =
          parseVisibleColor(computed.getPropertyValue('stroke'), currentTextColor) ??
          parseVisibleColor(node.getAttribute('stroke') ?? '', currentTextColor)
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
