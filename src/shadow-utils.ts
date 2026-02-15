import type { ColorValue } from './types'
import { formatColorValue } from './ui/color-utils'
import { parseColorValue } from './utils'

const TAILWIND_SHADOW_PRESETS = [
  { x: 0, y: 1, blur: 3, spread: 0, alpha: 10 },
  { x: 0, y: 4, blur: 6, spread: -1, alpha: 10 },
] as const

export interface EditableShadowLayer {
  x: number
  y: number
  blur: number
  spread: number
  inset: boolean
  color: ColorValue
}

export function createDefaultShadowLayer(index: number): EditableShadowLayer {
  const preset = index === 0 ? TAILWIND_SHADOW_PRESETS[0] : TAILWIND_SHADOW_PRESETS[1]
  return {
    x: preset.x,
    y: preset.y,
    blur: preset.blur,
    spread: preset.spread,
    inset: false,
    color: { hex: '000000', alpha: preset.alpha, raw: '' },
  }
}

function splitPreservingParens(input: string, isSeparator: (char: string) => boolean): string[] {
  const parts: string[] = []
  let current = ''
  let depth = 0

  for (const char of input.trim()) {
    if (char === '(') {
      depth += 1
      current += char
    } else if (char === ')') {
      depth = Math.max(0, depth - 1)
      current += char
    } else if (depth === 0 && isSeparator(char)) {
      const part = current.trim()
      if (part) parts.push(part)
      current = ''
    } else {
      current += char
    }
  }

  const tail = current.trim()
  if (tail) parts.push(tail)
  return parts
}

export function splitShadowLayers(value: string): string[] {
  const trimmed = value.trim()
  if (!trimmed || trimmed === 'none') return []
  return splitPreservingParens(trimmed, (char) => char === ',')
}

function tokenizeShadowLayer(layer: string): string[] {
  return splitPreservingParens(layer, (char) => /\s/.test(char))
}

function parseLengthToken(token: string): number | null {
  const match = token.match(/^(-?(?:\d+\.?\d*|\.\d+))(px)?$/i)
  if (!match) return null

  const numeric = parseFloat(match[1])
  if (!Number.isFinite(numeric)) return null

  // Unitless zero is valid in box-shadow and should be treated like 0px.
  if (match[2] || numeric === 0) return numeric
  return null
}

function formatShadowNumber(value: number): string {
  return String(Math.round(value * 100) / 100)
}

export function parseShadowLayer(layer: string, fallback: EditableShadowLayer): EditableShadowLayer {
  const trimmed = layer.trim()
  if (!trimmed) return fallback

  const tokens = tokenizeShadowLayer(trimmed)
  let inset = false
  const lengths: number[] = []
  let colorToken: string | null = null

  for (const token of tokens) {
    if (token.toLowerCase() === 'inset') {
      inset = true
      continue
    }

    const length = parseLengthToken(token)
    if (length !== null) {
      lengths.push(length)
      continue
    }

    if (!colorToken) {
      colorToken = token
    }
  }

  const [x, y, blur, spread] = [
    lengths[0] ?? fallback.x,
    lengths[1] ?? fallback.y,
    lengths[2] ?? 0,
    lengths[3] ?? 0,
  ]

  return {
    x,
    y,
    blur,
    spread,
    inset,
    color: colorToken ? parseColorValue(colorToken) : fallback.color,
  }
}

export function parseShadowLayers(value: string): EditableShadowLayer[] {
  const rawLayers = splitShadowLayers(value)
  if (rawLayers.length === 0) return []
  return rawLayers.map((layer, index) => parseShadowLayer(layer, createDefaultShadowLayer(index)))
}

export function serializeShadowLayer(layer: EditableShadowLayer): string {
  const colorValue = formatColorValue({ ...layer.color, raw: '' })
  const prefix = layer.inset ? 'inset ' : ''
  return `${prefix}${formatShadowNumber(layer.x)}px ${formatShadowNumber(layer.y)}px ${formatShadowNumber(layer.blur)}px ${formatShadowNumber(layer.spread)}px ${colorValue}`
}

export function serializeShadowLayers(layers: EditableShadowLayer[]): string {
  if (layers.length === 0) return 'none'
  return layers.map(serializeShadowLayer).join(', ')
}
