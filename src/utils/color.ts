import type { ColorValue, ColorProperties, ColorPropertyKey } from '../types'

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

  // Expand 4-digit shorthand (#RGBA -> #RRGGBBAA)
  if (h.length === 4) {
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
  // Modern space-separated syntax: rgb(R G B) or rgb(R G B / A)
  const modernMatch = rgba.match(/rgba?\(\s*(\d+)\s+(\d+)\s+(\d+)(?:\s*\/\s*([\d.]+%?))?\s*\)/)
  if (modernMatch) {
    const r = parseInt(modernMatch[1])
    const g = parseInt(modernMatch[2])
    const b = parseInt(modernMatch[3])
    let a = 1
    if (modernMatch[4]) {
      a = modernMatch[4].endsWith('%')
        ? parseFloat(modernMatch[4]) / 100
        : parseFloat(modernMatch[4])
    }
    const hex = [r, g, b]
      .map((v) => v.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
    return { hex, alpha: Math.round(a * 100), raw: rgba }
  }

  // Legacy comma-separated syntax: rgb(R, G, B) or rgba(R, G, B, A)
  const legacyMatch = rgba.match(/rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+%?))?\s*\)/)
  if (!legacyMatch) {
    return { hex: '000000', alpha: 100, raw: rgba }
  }

  const r = parseInt(legacyMatch[1])
  const g = parseInt(legacyMatch[2])
  const b = parseInt(legacyMatch[3])
  let a = 1
  if (legacyMatch[4]) {
    a = legacyMatch[4].endsWith('%')
      ? parseFloat(legacyMatch[4]) / 100
      : parseFloat(legacyMatch[4])
  }

  const hex = [r, g, b]
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()
  const alpha = Math.round(a * 100)

  return { hex, alpha, raw: rgba }
}

let cachedCanvasCtx: CanvasRenderingContext2D | null = null

function parseNamedColor(name: string): ColorValue {
  // Lazily create and reuse a canvas context for named color conversion
  if (!cachedCanvasCtx) {
    cachedCanvasCtx = document.createElement('canvas').getContext('2d')
  }
  const ctx = cachedCanvasCtx
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

  const borderSides = [
    { style: computed.borderTopStyle, width: computed.borderTopWidth, color: computed.borderTopColor },
    { style: computed.borderRightStyle, width: computed.borderRightWidth, color: computed.borderRightColor },
    { style: computed.borderBottomStyle, width: computed.borderBottomWidth, color: computed.borderBottomColor },
    { style: computed.borderLeftStyle, width: computed.borderLeftWidth, color: computed.borderLeftColor },
  ]
  const visibleBorderSide = borderSides.find(
    (side) => side.style !== 'none' && side.style !== 'hidden' && parseFloat(side.width) > 0
  )
  const hasBorder = Boolean(visibleBorderSide)
  const hasOutline =
    computed.outlineStyle !== 'none' && parseFloat(computed.outlineWidth) > 0

  return {
    backgroundColor: parseColorValue(computed.backgroundColor),
    color: parseColorValue(computed.color),
    borderColor: hasBorder && visibleBorderSide ? parseColorValue(visibleBorderSide.color) : TRANSPARENT_COLOR,
    outlineColor: hasOutline ? parseColorValue(computed.outlineColor) : TRANSPARENT_COLOR,
  }
}

export const colorPropertyToCSSMap: Record<ColorPropertyKey, string> = {
  backgroundColor: 'background-color',
  color: 'color',
  borderColor: 'border-color',
  outlineColor: 'outline-color',
}
