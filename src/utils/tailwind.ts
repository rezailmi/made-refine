import type { ColorPropertyKey, SizingValue } from '../types'
import { parsePropertyValue } from './css-value'
import { parseColorValue } from './color'

function findClosingParen(s: string): number {
  let depth = 1
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '(') depth++
    else if (s[i] === ')') { depth--; if (depth === 0) return i }
  }
  return s.length
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

const colorTailwindPrefixMap: Record<ColorPropertyKey, string> = {
  backgroundColor: 'bg',
  color: 'text',
  borderColor: 'border',
  outlineColor: 'outline',
}

export function colorToTailwind(
  property: ColorPropertyKey,
  colorValue: { hex: string; alpha: number; raw: string }
): string {
  const prefix = colorTailwindPrefixMap[property]

  // Use arbitrary hex value
  if (colorValue.alpha === 100) {
    return `${prefix}-[#${colorValue.hex}]`
  }
  return `${prefix}-[#${colorValue.hex}]/${colorValue.alpha}`
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

    if (prop === 'background') {
      if (value.includes('linear-gradient')) {
        const match = value.match(/linear-gradient\(/)
        if (match) {
          // Extract the first gradient's color using paren-aware splitting
          const inner = value.slice(match.index! + match[0].length)
          const closeParen = findClosingParen(inner)
          const gradientContent = inner.slice(0, closeParen)
          const firstArg = gradientContent.split(/,(?![^(]*\))/)[0]
          if (firstArg) {
            const colorValue = parseColorValue(firstArg.trim())
            classes.push(colorToTailwind('backgroundColor', colorValue))
          } else {
            classes.push(`bg-[${value.replace(/\s+/g, '_')}]`)
          }
        } else {
          classes.push(`bg-[${value.replace(/\s+/g, '_')}]`)
        }
      } else if (value) {
        classes.push(`bg-[${value.replace(/\s+/g, '_')}]`)
      }
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

    if (prop === 'outline-style') {
      const styleMap: Record<string, string> = {
        none: 'outline-none',
        solid: 'outline-solid',
        dashed: 'outline-dashed',
        dotted: 'outline-dotted',
        double: 'outline-double',
      }
      classes.push(styleMap[value] || `[outline-style:${value}]`)
      continue
    }

    if (prop === 'outline-width') {
      const parsed = parsePropertyValue(value)
      if (parsed.unit === 'px') {
        const knownWidths: Record<number, string> = { 0: '0', 1: '', 2: '2', 4: '4', 8: '8' }
        if (Object.prototype.hasOwnProperty.call(knownWidths, parsed.numericValue)) {
          const suffix = knownWidths[parsed.numericValue]
          classes.push(suffix === '' ? 'outline' : `outline-${suffix}`)
        } else {
          classes.push(`outline-[${value}]`)
        }
      } else {
        classes.push(`outline-[${value}]`)
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
