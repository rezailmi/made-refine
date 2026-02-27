import type { ColorValue } from './types'
import { formatColorValue } from './ui/color-utils'
import { parseColorValue } from './utils'
import { splitPreservingParens } from './shadow-utils'

export function parseFillLayers(bgColor: string, bgShorthand: string): ColorValue[] {
  const trimmedShorthand = bgShorthand.trim()

  if (trimmedShorthand && trimmedShorthand.includes('linear-gradient')) {
    const parts = splitPreservingParens(trimmedShorthand, (char) => char === ',')
    const layers: ColorValue[] = []
    for (const part of parts) {
      const trimmedPart = part.trim()
      if (!trimmedPart.startsWith('linear-gradient(')) continue
      // Extract the content between the outer parentheses
      const inner = trimmedPart.slice('linear-gradient('.length, -1)
      // Split on comma respecting nested parens to get the first color argument
      const args = splitPreservingParens(inner, (char) => char === ',')
      if (args.length > 0) {
        layers.push(parseColorValue(args[0].trim()))
      }
    }
    return layers
  }

  const trimmedBg = bgColor.trim()
  if (!trimmedBg) return []

  const parsed = parseColorValue(trimmedBg)
  if (parsed.alpha === 0) return []
  return [parsed]
}

export function serializeFillLayers(layers: ColorValue[]): { properties: Record<string, string> } {
  if (layers.length === 0) {
    return { properties: { 'background-color': 'transparent', background: '' } }
  }

  if (layers.length === 1) {
    return { properties: { 'background-color': formatColorValue(layers[0]), background: '' } }
  }

  const gradients = layers.map((c) => {
    const color = formatColorValue(c)
    return `linear-gradient(${color}, ${color})`
  })
  return { properties: { background: gradients.join(', '), 'background-color': '' } }
}
