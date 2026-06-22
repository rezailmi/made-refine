import { parsePropertyValue } from './css-value'
import { colorToTailwind, parseColorValue } from '../utils'

const spacingScale: Record<number, string> = {
  0: '0',
  1: 'px',
  2: '0.5',
  4: '1',
  6: '1.5',
  8: '2',
  10: '2.5',
  12: '3',
  14: '3.5',
  16: '4',
  20: '5',
  24: '6',
  28: '7',
  32: '8',
  36: '9',
  40: '10',
  44: '11',
  48: '12',
  52: '13',
  56: '14',
  60: '15',
  64: '16',
  72: '18',
  80: '20',
  96: '24',
}

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
    scale: {
      0: 'none',
      2: 'sm',
      4: '',
      6: 'md',
      8: 'lg',
      12: 'xl',
      16: '2xl',
      24: '3xl',
      9999: 'full',
    },
  },
  'border-top-left-radius': {
    prefix: 'rounded-tl',
    scale: {
      0: 'none',
      2: 'sm',
      4: '',
      6: 'md',
      8: 'lg',
      12: 'xl',
      16: '2xl',
      24: '3xl',
      9999: 'full',
    },
  },
  'border-top-right-radius': {
    prefix: 'rounded-tr',
    scale: {
      0: 'none',
      2: 'sm',
      4: '',
      6: 'md',
      8: 'lg',
      12: 'xl',
      16: '2xl',
      24: '3xl',
      9999: 'full',
    },
  },
  'border-bottom-right-radius': {
    prefix: 'rounded-br',
    scale: {
      0: 'none',
      2: 'sm',
      4: '',
      6: 'md',
      8: 'lg',
      12: 'xl',
      16: '2xl',
      24: '3xl',
      9999: 'full',
    },
  },
  'border-bottom-left-radius': {
    prefix: 'rounded-bl',
    scale: {
      0: 'none',
      2: 'sm',
      4: '',
      6: 'md',
      8: 'lg',
      12: 'xl',
      16: '2xl',
      24: '3xl',
      9999: 'full',
    },
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

const BORDER_STYLE_CLASS_MAP: Record<string, string> = {
  none: 'border-none',
  solid: 'border-solid',
  dashed: 'border-dashed',
  dotted: 'border-dotted',
  double: 'border-double',
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
  return (
    value
      .trim()
      .toLowerCase()
      // Convert rgba(R, G, B, A) → rgb(R G B / A) to match Tailwind v4 preset notation
      .replace(/rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)/g, 'rgb($1 $2 $3 / $4)')
      // Convert comma-form rgb(R, G, B) → rgb(R G B) for consistency
      .replace(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/g, 'rgb($1 $2 $3)')
      .replace(/\s*\/\s*/g, '/')
      .replace(/\(\s+/g, '(')
      .replace(/\s+\)/g, ')')
      .replace(/\s*,\s*/g, ',')
      .replace(/\s+/g, ' ')
      // Normalize unitless-zero equivalent: `0px` → `0` (0px and 0 are identical in CSS)
      .replace(/\b0px\b/g, '0')
  )
}

const tailwindShadowClassValues: Array<{ className: string; css: string }> = [
  { className: 'shadow-2xs', css: '0 1px rgb(0 0 0 / 0.05)' },
  { className: 'shadow-xs', css: '0 1px 2px 0 rgb(0 0 0 / 0.05)' },
  { className: 'shadow', css: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)' },
  { className: 'shadow-sm', css: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)' },
  {
    className: 'shadow-md',
    css: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  },
  {
    className: 'shadow-lg',
    css: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  },
  {
    className: 'shadow-xl',
    css: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
  },
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

    if (prop === 'flex-wrap') {
      if (value === 'wrap') classes.push('flex-wrap')
      else if (value === 'wrap-reverse') classes.push('flex-wrap-reverse')
      else if (value === 'nowrap') classes.push('flex-nowrap')
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
      else {
        const parsed = parsePropertyValue(value)
        const exactScale =
          parsed.unit === 'px' ? getExactScaleValue(parsed.numericValue, spacingScale) : null
        if (exactScale !== null) classes.push(`w-${exactScale}`)
        else classes.push(`w-[${value}]`)
      }
      continue
    }

    if (prop === 'height') {
      if (value === '100%') classes.push('h-full')
      else if (value === 'fit-content') classes.push('h-fit')
      else if (value === 'auto') classes.push('h-auto')
      else {
        const parsed = parsePropertyValue(value)
        const exactScale =
          parsed.unit === 'px' ? getExactScaleValue(parsed.numericValue, spacingScale) : null
        if (exactScale !== null) classes.push(`h-${exactScale}`)
        else classes.push(`h-[${value}]`)
      }
      continue
    }

    if (prop === 'background-color') {
      const colorValue = parseColorValue(value)
      classes.push(colorToTailwind('backgroundColor', colorValue))
      continue
    }

    if (prop === 'background') {
      // Multi-layer gradient shorthand — emit an arbitrary-value class.
      // Spaces in the value become underscores (mirrors box-shadow handling).
      if (value && value.trim()) {
        classes.push(`background-[${value.replace(/\s+/g, '_')}]`)
      }
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
      classes.push(BORDER_STYLE_CLASS_MAP[value] || `[border-style:${value}]`)
      continue
    }

    // Tailwind has no per-side border-style utilities — consolidate when all sides match
    if (
      prop === 'border-top-style' ||
      prop === 'border-right-style' ||
      prop === 'border-bottom-style' ||
      prop === 'border-left-style'
    ) {
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
            classes.push(BORDER_STYLE_CLASS_MAP[value] || `[border-style:${value}]`)
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
      // Tailwind v4 default font-size presets (px → utility class).
      // Caveat: text-* presets also set line-height; this class is a semantic
      // hint only. The payload's cssValue is the authoritative value — the
      // applying agent may choose the arbitrary form when line-height must be
      // preserved independently.
      const fontSizePresets: Record<number, string> = {
        12: 'text-xs',
        14: 'text-sm',
        16: 'text-base',
        18: 'text-lg',
        20: 'text-xl',
        24: 'text-2xl',
        30: 'text-3xl',
        36: 'text-4xl',
        48: 'text-5xl',
        60: 'text-6xl',
        72: 'text-7xl',
        96: 'text-8xl',
        128: 'text-9xl',
      }
      const parsed = parsePropertyValue(value)
      const preset = parsed.unit === 'px' ? fontSizePresets[parsed.numericValue] : undefined
      classes.push(preset ?? `text-[${value}]`)
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

    if (prop === 'opacity') {
      const num = parseFloat(value)
      if (!isNaN(num) && num === 1) continue // omit — no class needed for default
      if (!isNaN(num)) {
        const pct = Math.round(num * 100)
        if (pct % 5 === 0 && pct >= 0 && pct <= 95) {
          classes.push(`opacity-${pct}`)
        } else {
          classes.push(`opacity-[${value}]`)
        }
      }
      continue
    }

    if (prop === 'text-decoration-line') {
      const decorationMap: Record<string, string> = {
        none: 'no-underline',
        underline: 'underline',
        'line-through': 'line-through',
      }
      if (decorationMap[value]) classes.push(decorationMap[value])
      continue
    }

    if (prop === 'text-transform') {
      const transformMap: Record<string, string> = {
        none: 'normal-case',
        uppercase: 'uppercase',
        lowercase: 'lowercase',
        capitalize: 'capitalize',
      }
      if (transformMap[value]) classes.push(transformMap[value])
      continue
    }

    if (prop === 'font-style') {
      if (value === 'italic') classes.push('italic')
      else if (value === 'normal') classes.push('not-italic')
      continue
    }

    if (prop === 'overflow') {
      const overflowMap: Record<string, string> = {
        visible: 'overflow-visible',
        hidden: 'overflow-hidden',
        auto: 'overflow-auto',
        scroll: 'overflow-scroll',
      }
      if (overflowMap[value]) classes.push(overflowMap[value])
      continue
    }

    if (prop === 'object-fit') {
      const fitMap: Record<string, string> = {
        fill: 'object-fill',
        contain: 'object-contain',
        cover: 'object-cover',
        none: 'object-none',
        'scale-down': 'object-scale-down',
      }
      if (fitMap[value]) classes.push(fitMap[value])
      continue
    }
  }

  return classes.join(' ')
}
