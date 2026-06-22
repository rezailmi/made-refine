export interface ClassAttribution {
  /** Classes on the element that set this CSS property directly (no variant). */
  matchedClasses: string[]
  /** Variant-prefixed classes (sm:, hover:, dark:, group-hover:, etc.)
   *  whose base utility targets this property. */
  variantMatches: string[]
}

/**
 * Splits a Tailwind class into { variants, base }.
 * Handles arbitrary values like `bg-[url(:foo)]` and `[border-top-style:dashed]`
 * by only splitting on `:` outside `[...]` brackets.
 */
function splitVariantsAndBase(cls: string): { variants: string[]; base: string } {
  const variants: string[] = []
  let depth = 0
  let lastSplit = 0
  let i = 0

  while (i < cls.length) {
    const ch = cls[i]
    if (ch === '[') {
      depth++
    } else if (ch === ']') {
      if (depth > 0) depth--
    } else if (ch === ':' && depth === 0) {
      variants.push(cls.slice(lastSplit, i))
      lastSplit = i + 1
    }
    i++
  }

  const base = cls.slice(lastSplit)
  return { variants, base }
}

/**
 * Expand a CSS property to itself plus all shorthand-related longhands for
 * matching purposes. E.g. `padding` expands to all four padding sides + `padding`.
 */
export function expandPropertyForAttribution(cssProperty: string): string[] {
  switch (cssProperty) {
    case 'padding':
      return ['padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left']
    case 'padding-inline':
      return ['padding-inline', 'padding-left', 'padding-right']
    case 'padding-block':
      return ['padding-block', 'padding-top', 'padding-bottom']
    case 'margin':
      return ['margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left']
    case 'margin-inline':
      return ['margin-inline', 'margin-left', 'margin-right']
    case 'margin-block':
      return ['margin-block', 'margin-top', 'margin-bottom']
    case 'border-width':
      return [
        'border-width',
        'border-top-width',
        'border-right-width',
        'border-bottom-width',
        'border-left-width',
      ]
    case 'border-style':
      return [
        'border-style',
        'border-top-style',
        'border-right-style',
        'border-bottom-style',
        'border-left-style',
      ]
    case 'border-radius':
      return [
        'border-radius',
        'border-top-left-radius',
        'border-top-right-radius',
        'border-bottom-right-radius',
        'border-bottom-left-radius',
      ]
    default:
      return [cssProperty]
  }
}

/**
 * Return the set of CSS properties that a base utility class targets.
 * Returns empty array for classes we don't recognize.
 */
function propertiesForBase(base: string): string[] {
  // Strip leading important modifier
  const b = base.startsWith('!') ? base.slice(1) : base

  // Arbitrary property: [some-prop:value]
  if (b.startsWith('[') && b.endsWith(']')) {
    const inner = b.slice(1, -1)
    // Find the first colon (not inside nested brackets)
    let d = 0
    for (let i = 0; i < inner.length; i++) {
      if (inner[i] === '[') d++
      else if (inner[i] === ']') d--
      else if (inner[i] === ':' && d === 0) {
        const prop = inner.slice(0, i).trim()
        // Must look like a CSS property (kebab-case, no spaces)
        if (prop && /^[a-z][a-z0-9-]*$/.test(prop)) {
          return [prop]
        }
        break
      }
    }
    return []
  }

  // --- Spacing ---
  // p-* → padding all
  if (/^p-/.test(b) || b === 'p') {
    return ['padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left']
  }
  if (/^px-/.test(b) || b === 'px') {
    return ['padding-left', 'padding-right', 'padding-inline']
  }
  if (/^py-/.test(b) || b === 'py') {
    return ['padding-top', 'padding-bottom', 'padding-block']
  }
  if (/^pt-/.test(b)) return ['padding-top']
  if (/^pr-/.test(b)) return ['padding-right']
  if (/^pb-/.test(b)) return ['padding-bottom']
  if (/^pl-/.test(b)) return ['padding-left']

  // m-* → margin all (including negative: -m-*, -mt-*, etc.)
  if (/^-?m-/.test(b) || b === 'm') {
    return ['margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left']
  }
  if (/^-?mx-/.test(b) || b === 'mx') {
    return ['margin-left', 'margin-right', 'margin-inline']
  }
  if (/^-?my-/.test(b) || b === 'my') {
    return ['margin-top', 'margin-bottom', 'margin-block']
  }
  if (/^-?mt-/.test(b)) return ['margin-top']
  if (/^-?mr-/.test(b)) return ['margin-right']
  if (/^-?mb-/.test(b)) return ['margin-bottom']
  if (/^-?ml-/.test(b)) return ['margin-left']

  // gap
  if (/^gap-/.test(b) || b === 'gap') return ['gap']

  // --- Sizing ---
  if (/^w-/.test(b) || b === 'w-full' || b === 'w-fit' || b === 'w-auto' || b === 'w-px') {
    return ['width']
  }
  if (/^h-/.test(b) || b === 'h-full' || b === 'h-fit' || b === 'h-auto' || b === 'h-px') {
    return ['height']
  }
  if (/^size-/.test(b)) return ['width', 'height']

  // --- Border radius ---
  // rounded (exact), rounded-sm/md/lg/xl/2xl/3xl/full/none (exact), rounded-{size}
  if (
    b === 'rounded' ||
    b === 'rounded-sm' ||
    b === 'rounded-md' ||
    b === 'rounded-lg' ||
    b === 'rounded-xl' ||
    b === 'rounded-2xl' ||
    b === 'rounded-3xl' ||
    b === 'rounded-full' ||
    b === 'rounded-none' ||
    // arbitrary: rounded-[...]
    /^rounded-\[/.test(b)
  ) {
    return [
      'border-radius',
      'border-top-left-radius',
      'border-top-right-radius',
      'border-bottom-right-radius',
      'border-bottom-left-radius',
    ]
  }
  // Per-corner: rounded-tl-*, rounded-tr-*, rounded-br-*, rounded-bl-*
  if (/^rounded-tl/.test(b)) return ['border-top-left-radius', 'border-radius']
  if (/^rounded-tr/.test(b)) return ['border-top-right-radius', 'border-radius']
  if (/^rounded-br/.test(b)) return ['border-bottom-right-radius', 'border-radius']
  if (/^rounded-bl/.test(b)) return ['border-bottom-left-radius', 'border-radius']
  // Catch remaining rounded-* that weren't matched yet
  if (/^rounded-/.test(b)) {
    return [
      'border-radius',
      'border-top-left-radius',
      'border-top-right-radius',
      'border-bottom-right-radius',
      'border-bottom-left-radius',
    ]
  }

  // --- Border width ---
  // border (exact: 1px all), border-0/2/4/8
  if (b === 'border' || /^border-[0248]$/.test(b)) {
    return [
      'border-width',
      'border-top-width',
      'border-right-width',
      'border-bottom-width',
      'border-left-width',
    ]
  }
  // border-t, border-t-0/2/4/8, border-r, border-b, border-l
  if (/^border-t(-[0248])?$/.test(b)) return ['border-top-width', 'border-width']
  if (/^border-r(-[0248])?$/.test(b)) return ['border-right-width', 'border-width']
  if (/^border-b(-[0248])?$/.test(b)) return ['border-bottom-width', 'border-width']
  if (/^border-l(-[0248])?$/.test(b)) return ['border-left-width', 'border-width']
  // border-x/border-y width: horizontal and vertical shorthands
  if (/^border-x(-[0248])?$/.test(b))
    return ['border-left-width', 'border-right-width', 'border-width']
  if (/^border-y(-[0248])?$/.test(b))
    return ['border-top-width', 'border-bottom-width', 'border-width']

  // --- Border style ---
  if (
    b === 'border-solid' ||
    b === 'border-dashed' ||
    b === 'border-dotted' ||
    b === 'border-double' ||
    b === 'border-none'
  ) {
    return [
      'border-style',
      'border-top-style',
      'border-right-style',
      'border-bottom-style',
      'border-left-style',
    ]
  }

  // --- Border color ---
  // border-[#...] or border-<word>-<shade> but NOT border width/style/radius classes
  // We check that the suffix is not purely numeric or a known style/width keyword
  if (/^border-/.test(b)) {
    const suffix = b.slice('border-'.length)
    const isWidthClass = /^[0248]$/.test(suffix) || suffix === ''
    const isStyleClass =
      suffix === 'solid' ||
      suffix === 'dashed' ||
      suffix === 'dotted' ||
      suffix === 'double' ||
      suffix === 'none'
    const isPerSideWidth = /^[trbl](-[0248])?$/.test(suffix)
    // border-x/border-y (with optional width suffix)
    const isAxisWidth = /^[xy](-[0248])?$/.test(suffix)
    const isRadiusClass =
      suffix === 'sm' ||
      suffix === 'md' ||
      suffix === 'lg' ||
      suffix === 'xl' ||
      suffix === '2xl' ||
      suffix === '3xl' ||
      suffix === 'full' ||
      /^(tl|tr|br|bl)/.test(suffix) ||
      /^rounded/.test(b)
    // Purely numeric (border-3) or arbitrary-length (border-[3px]) → width not color
    const isNumericWidth = /^\d+$/.test(suffix)
    const isArbitraryLength = /^\[.*(px|rem|em|%|vw|vh|ch|ex|fr).*\]$/.test(suffix)

    if (
      !isWidthClass &&
      !isStyleClass &&
      !isPerSideWidth &&
      !isAxisWidth &&
      !isRadiusClass &&
      !isNumericWidth &&
      !isArbitraryLength
    ) {
      return ['border-color']
    }
    return []
  }

  // --- Colors ---
  if (/^bg-/.test(b)) return ['background-color', 'background']
  // text-align (exact match first)
  if (b === 'text-left' || b === 'text-center' || b === 'text-right' || b === 'text-justify') {
    return ['text-align']
  }
  // text-size presets
  if (
    b === 'text-xs' ||
    b === 'text-sm' ||
    b === 'text-base' ||
    b === 'text-lg' ||
    b === 'text-xl' ||
    b === 'text-2xl' ||
    b === 'text-3xl' ||
    b === 'text-4xl' ||
    b === 'text-5xl' ||
    b === 'text-6xl' ||
    b === 'text-7xl' ||
    b === 'text-8xl' ||
    b === 'text-9xl' ||
    /^text-\[/.test(b)
  ) {
    // text-[<length>] → font-size; text-[#hex] or text-[color] → color
    if (/^text-\[/.test(b)) {
      const inner = b.slice('text-['.length, -1)
      // If it starts with # or looks like a color function → color
      if (inner.startsWith('#') || /^(rgb|hsl|oklch|color)/.test(inner)) {
        return ['color']
      }
      // Otherwise assume a length → font-size
      return ['font-size']
    }
    return ['font-size']
  }
  // White-space / overflow text utilities — not color
  if (
    b === 'text-wrap' ||
    b === 'text-nowrap' ||
    b === 'text-balance' ||
    b === 'text-pretty' ||
    b === 'text-ellipsis' ||
    b === 'text-clip'
  ) {
    return []
  }
  // Any other text-* → color
  if (/^text-/.test(b)) return ['color']

  // --- Font ---
  // font-weight keywords
  if (
    b === 'font-thin' ||
    b === 'font-extralight' ||
    b === 'font-light' ||
    b === 'font-normal' ||
    b === 'font-medium' ||
    b === 'font-semibold' ||
    b === 'font-bold' ||
    b === 'font-extrabold' ||
    b === 'font-black'
  ) {
    return ['font-weight']
  }
  // font-[arbitrary] without dash pattern is ambiguous; check if it starts with known weight values
  if (/^font-\[/.test(b)) return ['font-family', 'font-weight'] // could be either
  if (/^font-/.test(b)) return ['font-family']

  // leading → line-height
  if (/^leading-/.test(b)) return ['line-height']
  // tracking → letter-spacing
  if (/^tracking-/.test(b)) return ['letter-spacing']

  // --- Typography ---
  if (b === 'italic' || b === 'not-italic') return ['font-style']
  if (b === 'underline' || b === 'line-through' || b === 'no-underline') {
    return ['text-decoration-line', 'text-decoration']
  }
  if (b === 'uppercase' || b === 'lowercase' || b === 'capitalize' || b === 'normal-case') {
    return ['text-transform']
  }

  // --- Layout ---
  if (
    b === 'flex' ||
    b === 'inline-flex' ||
    b === 'grid' ||
    b === 'block' ||
    b === 'inline-block' ||
    b === 'hidden'
  ) {
    return ['display']
  }
  if (
    b === 'flex-row' ||
    b === 'flex-col' ||
    b === 'flex-row-reverse' ||
    b === 'flex-col-reverse'
  ) {
    return ['flex-direction']
  }
  if (b === 'flex-wrap' || b === 'flex-nowrap' || b === 'flex-wrap-reverse') {
    return ['flex-wrap']
  }
  if (/^justify-/.test(b)) return ['justify-content']
  if (/^items-/.test(b)) return ['align-items']
  if (/^overflow-/.test(b)) return ['overflow']

  // --- Effects ---
  if (/^opacity-/.test(b)) return ['opacity']
  if (b === 'shadow' || b === 'shadow-none' || /^shadow-/.test(b)) {
    return ['box-shadow']
  }
  if (/^object-/.test(b)) return ['object-fit']

  return []
}

/**
 * Given a CSS property and the element's classList, return which classes
 * directly set that property (matchedClasses) and which variant-prefixed classes
 * also govern it (variantMatches).
 */
export function attributeClassesForProperty(
  cssProperty: string,
  classList: string[]
): ClassAttribution {
  const expandedProps = new Set(expandPropertyForAttribution(cssProperty))
  const matchedClasses: string[] = []
  const variantMatches: string[] = []

  for (const cls of classList) {
    const { variants, base } = splitVariantsAndBase(cls)
    // Strip important modifier for property lookup
    const targetProps = propertiesForBase(base)
    const intersects = targetProps.some((p) => expandedProps.has(p))
    if (!intersects) continue

    if (variants.length === 0) {
      matchedClasses.push(cls)
    } else {
      variantMatches.push(cls)
    }
  }

  return { matchedClasses, variantMatches }
}
