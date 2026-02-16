import { describe, expect, it, vi } from 'vitest'
import {
  ensureDirectTextSpanAtPoint,
  getComputedColorStyles,
  ORIGINAL_STYLE_PROPS,
  propertyToCSSMap,
  borderRadiusPropertyToCSSMap,
  borderPropertyToCSSMap,
  flexPropertyToCSSMap,
  sizingPropertyToCSSMap,
  colorPropertyToCSSMap,
  typographyPropertyToCSSMap,
  stylesToTailwind,
  collapseSpacingShorthands,
} from './utils'

describe('getComputedColorStyles', () => {
  it('uses the first visible side when top border is not visible', () => {
    const el = document.createElement('div')
    el.style.borderTopStyle = 'none'
    el.style.borderTopWidth = '0px'
    el.style.borderTopColor = 'rgb(255, 0, 0)'
    el.style.borderRightStyle = 'solid'
    el.style.borderRightWidth = '2px'
    el.style.borderRightColor = 'rgb(0, 255, 0)'
    el.style.borderBottomStyle = 'none'
    el.style.borderBottomWidth = '0px'
    el.style.borderLeftStyle = 'none'
    el.style.borderLeftWidth = '0px'
    document.body.appendChild(el)

    const color = getComputedColorStyles(el)

    expect(color.borderColor.hex).toBe('00FF00')
    expect(color.borderColor.alpha).toBe(100)
    el.remove()
  })

  it('returns transparent border color when all sides are not visible', () => {
    const el = document.createElement('div')
    el.style.borderTopStyle = 'none'
    el.style.borderTopWidth = '0px'
    el.style.borderRightStyle = 'hidden'
    el.style.borderRightWidth = '2px'
    el.style.borderBottomStyle = 'none'
    el.style.borderBottomWidth = '0px'
    el.style.borderLeftStyle = 'none'
    el.style.borderLeftWidth = '0px'
    document.body.appendChild(el)

    const color = getComputedColorStyles(el)

    expect(color.borderColor.alpha).toBe(0)
    el.remove()
  })
})

describe('stylesToTailwind', () => {
  describe('border-style shorthand', () => {
    it('maps border-style to Tailwind class', () => {
      expect(stylesToTailwind({ 'border-style': 'solid' })).toBe('border-solid')
      expect(stylesToTailwind({ 'border-style': 'dashed' })).toBe('border-dashed')
      expect(stylesToTailwind({ 'border-style': 'dotted' })).toBe('border-dotted')
      expect(stylesToTailwind({ 'border-style': 'double' })).toBe('border-double')
      expect(stylesToTailwind({ 'border-style': 'none' })).toBe('border-none')
    })
  })

  describe('per-side border-style with all four sides present', () => {
    it('consolidates to shorthand when all sides match', () => {
      const result = stylesToTailwind({
        'border-top-style': 'solid',
        'border-right-style': 'solid',
        'border-bottom-style': 'solid',
        'border-left-style': 'solid',
      })
      expect(result).toBe('border-solid')
    })

    it('emits per-side arbitrary classes when all four sides are present but differ', () => {
      const result = stylesToTailwind({
        'border-top-style': 'solid',
        'border-right-style': 'dashed',
        'border-bottom-style': 'solid',
        'border-left-style': 'solid',
      })
      expect(result).toBe('[border-top-style:solid] [border-right-style:dashed] [border-bottom-style:solid] [border-left-style:solid]')
    })
  })

  describe('per-side border-style with partial sides', () => {
    it('emits arbitrary-property Tailwind for a single side', () => {
      expect(stylesToTailwind({ 'border-top-style': 'solid' })).toBe('[border-top-style:solid]')
      expect(stylesToTailwind({ 'border-right-style': 'dashed' })).toBe('[border-right-style:dashed]')
      expect(stylesToTailwind({ 'border-bottom-style': 'dotted' })).toBe('[border-bottom-style:dotted]')
      expect(stylesToTailwind({ 'border-left-style': 'double' })).toBe('[border-left-style:double]')
    })

    it('emits arbitrary-property Tailwind for two sides', () => {
      const result = stylesToTailwind({
        'border-top-style': 'solid',
        'border-bottom-style': 'dashed',
      })
      expect(result).toBe('[border-top-style:solid] [border-bottom-style:dashed]')
    })
  })

  describe('other border properties', () => {
    it('maps border-color', () => {
      expect(stylesToTailwind({ 'border-color': 'rgb(0, 0, 0)' })).toContain('border-')
    })
  })

  describe('spacing properties', () => {
    it('maps padding to Tailwind', () => {
      expect(stylesToTailwind({ 'padding-top': '16px' })).toBe('pt-4')
    })

    it('maps margin to Tailwind', () => {
      expect(stylesToTailwind({ 'margin-left': '8px' })).toBe('ml-2')
    })

    it('uses arbitrary value for non-scale values', () => {
      expect(stylesToTailwind({ 'padding-top': '13px' })).toBe('pt-[13px]')
    })

    it('maps shorthand padding to p-*', () => {
      expect(stylesToTailwind({ padding: '16px' })).toBe('p-4')
    })

    it('maps padding-inline to px-*', () => {
      expect(stylesToTailwind({ 'padding-inline': '8px' })).toBe('px-2')
    })

    it('maps padding-block to py-*', () => {
      expect(stylesToTailwind({ 'padding-block': '4px' })).toBe('py-1')
    })

    it('maps shorthand margin to m-*', () => {
      expect(stylesToTailwind({ margin: '16px' })).toBe('m-4')
    })

    it('maps margin-inline to mx-*', () => {
      expect(stylesToTailwind({ 'margin-inline': '8px' })).toBe('mx-2')
    })

    it('maps margin-block to my-*', () => {
      expect(stylesToTailwind({ 'margin-block': '4px' })).toBe('my-1')
    })
  })

  describe('display', () => {
    it('maps display values', () => {
      expect(stylesToTailwind({ display: 'flex' })).toBe('flex')
      expect(stylesToTailwind({ display: 'none' })).toBe('hidden')
      expect(stylesToTailwind({ display: 'grid' })).toBe('grid')
    })
  })

  describe('width and height', () => {
    it('maps known width values', () => {
      expect(stylesToTailwind({ width: '100%' })).toBe('w-full')
      expect(stylesToTailwind({ width: 'fit-content' })).toBe('w-fit')
    })

    it('uses arbitrary value for unknown widths', () => {
      expect(stylesToTailwind({ width: '200px' })).toBe('w-[200px]')
    })
  })

  describe('box-shadow', () => {
    it('maps none to shadow-none', () => {
      expect(stylesToTailwind({ 'box-shadow': 'none' })).toBe('shadow-none')
    })

    it('maps Tailwind default shadow values to utility classes', () => {
      expect(stylesToTailwind({ 'box-shadow': '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' })).toBe('shadow-md')
      expect(stylesToTailwind({ 'box-shadow': 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)' })).toBe('shadow-inner')
    })

    it('maps custom shadow values to arbitrary Tailwind syntax', () => {
      expect(stylesToTailwind({ 'box-shadow': '0 4px 6px -1px rgba(0,0,0,0.1)' })).toBe(
        'shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1)]',
      )
    })
  })

  describe('typography', () => {
    it('maps font-weight', () => {
      expect(stylesToTailwind({ 'font-weight': '700' })).toBe('font-bold')
      expect(stylesToTailwind({ 'font-weight': '400' })).toBe('font-normal')
    })

    it('maps text-align', () => {
      expect(stylesToTailwind({ 'text-align': 'center' })).toBe('text-center')
    })
  })
})

describe('ORIGINAL_STYLE_PROPS covers all properties that resetToOriginal removes', () => {
  // resetToOriginal (provider.tsx) builds its removal list from these maps plus
  // hardcoded extras. If a property is removed during reset but missing from
  // ORIGINAL_STYLE_PROPS, original inline values are permanently lost.
  const resetCSSProps = [
    ...new Set([
      ...Object.values(propertyToCSSMap),
      ...Object.values(borderRadiusPropertyToCSSMap),
      ...Object.values(borderPropertyToCSSMap),
      ...Object.values(flexPropertyToCSSMap),
      ...Object.values(sizingPropertyToCSSMap),
      ...Object.values(colorPropertyToCSSMap),
      ...Object.values(typographyPropertyToCSSMap),
      'outline-style',
      'outline-width',
      'box-shadow',
    ]),
  ]

  it('ORIGINAL_STYLE_PROPS is a superset of the reset property list', () => {
    const captureSet = new Set<string>(ORIGINAL_STYLE_PROPS)
    const missing = resetCSSProps.filter((prop) => !captureSet.has(prop))

    expect(missing).toEqual([])
  })
})

describe('collapseSpacingShorthands', () => {
  it('collapses all 4 equal padding sides to shorthand', () => {
    const result = collapseSpacingShorthands({
      'padding-top': '16px',
      'padding-right': '16px',
      'padding-bottom': '16px',
      'padding-left': '16px',
    })
    expect(result).toEqual({ padding: '16px' })
  })

  it('collapses matching horizontal/vertical pairs', () => {
    const result = collapseSpacingShorthands({
      'padding-top': '8px',
      'padding-right': '16px',
      'padding-bottom': '8px',
      'padding-left': '16px',
    })
    expect(result).toEqual({ 'padding-inline': '16px', 'padding-block': '8px' })
  })

  it('collapses only horizontal pair when vertical differs', () => {
    const result = collapseSpacingShorthands({
      'padding-top': '8px',
      'padding-right': '16px',
      'padding-bottom': '12px',
      'padding-left': '16px',
    })
    expect(result).toEqual({ 'padding-top': '8px', 'padding-inline': '16px', 'padding-bottom': '12px' })
  })

  it('collapses only vertical pair when horizontal differs', () => {
    const result = collapseSpacingShorthands({
      'padding-top': '8px',
      'padding-right': '16px',
      'padding-bottom': '8px',
      'padding-left': '12px',
    })
    expect(result).toEqual({ 'padding-block': '8px', 'padding-right': '16px', 'padding-left': '12px' })
  })

  it('does not collapse when all sides differ', () => {
    const result = collapseSpacingShorthands({
      'padding-top': '4px',
      'padding-right': '8px',
      'padding-bottom': '12px',
      'padding-left': '16px',
    })
    expect(result).toEqual({
      'padding-top': '4px',
      'padding-right': '8px',
      'padding-bottom': '12px',
      'padding-left': '16px',
    })
  })

  it('collapses all 4 equal margin sides to shorthand', () => {
    const result = collapseSpacingShorthands({
      'margin-top': '8px',
      'margin-right': '8px',
      'margin-bottom': '8px',
      'margin-left': '8px',
    })
    expect(result).toEqual({ margin: '8px' })
  })

  it('collapses margin horizontal/vertical pairs', () => {
    const result = collapseSpacingShorthands({
      'margin-top': '4px',
      'margin-right': '8px',
      'margin-bottom': '4px',
      'margin-left': '8px',
    })
    expect(result).toEqual({ 'margin-inline': '8px', 'margin-block': '4px' })
  })

  it('overrides existing shorthand values when all sides are present', () => {
    const result = collapseSpacingShorthands({
      padding: '2px',
      'padding-inline': '6px',
      'padding-block': '10px',
      'padding-top': '8px',
      'padding-right': '16px',
      'padding-bottom': '8px',
      'padding-left': '16px',
    })
    expect(result).toEqual({ 'padding-inline': '16px', 'padding-block': '8px' })
  })

  it('passes through non-spacing properties unchanged', () => {
    const result = collapseSpacingShorthands({
      'padding-top': '16px',
      'padding-right': '16px',
      'padding-bottom': '16px',
      'padding-left': '16px',
      display: 'flex',
    })
    expect(result).toEqual({ padding: '16px', display: 'flex' })
  })

  it('handles partial sides without collapsing', () => {
    const result = collapseSpacingShorthands({
      'padding-top': '16px',
      'padding-left': '16px',
    })
    expect(result).toEqual({ 'padding-top': '16px', 'padding-left': '16px' })
  })
})

describe('ensureDirectTextSpanAtPoint', () => {
  it('wraps the direct text node hit by point', () => {
    const parent = document.createElement('div')
    const text = document.createTextNode('Priority support')
    parent.appendChild(text)
    document.body.appendChild(parent)

    let selected: Text | null = null
    const spy = vi.spyOn(document, 'createRange').mockImplementation(() => ({
      selectNodeContents: (node: Node) => { selected = node as Text },
      getClientRects: () => {
        if (selected !== text) return []
        return [{
          left: 10,
          top: 10,
          right: 150,
          bottom: 30,
          width: 140,
          height: 20,
          x: 10,
          y: 10,
          toJSON: () => ({}),
        }]
      },
      detach: () => {},
    }) as unknown as Range)

    const span = ensureDirectTextSpanAtPoint(parent, 20, 20)
    expect(span).not.toBeNull()
    expect(span?.tagName.toLowerCase()).toBe('span')
    expect(span?.textContent).toBe('Priority support')
    expect(parent.firstChild).toBe(span)

    spy.mockRestore()
    parent.remove()
  })

  it('returns null when click misses direct text rects', () => {
    const parent = document.createElement('div')
    const text = document.createTextNode('Custom domains')
    parent.appendChild(text)
    document.body.appendChild(parent)

    let selected: Text | null = null
    const spy = vi.spyOn(document, 'createRange').mockImplementation(() => ({
      selectNodeContents: (node: Node) => { selected = node as Text },
      getClientRects: () => {
        if (selected !== text) return []
        return [{
          left: 10,
          top: 10,
          right: 80,
          bottom: 20,
          width: 70,
          height: 10,
          x: 10,
          y: 10,
          toJSON: () => ({}),
        }]
      },
      detach: () => {},
    }) as unknown as Range)

    const span = ensureDirectTextSpanAtPoint(parent, 200, 200)
    expect(span).toBeNull()
    expect(parent.firstChild).toBe(text)

    spy.mockRestore()
    parent.remove()
  })
})
