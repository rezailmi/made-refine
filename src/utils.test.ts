import { describe, expect, it } from 'vitest'
import { getComputedColorStyles, stylesToTailwind } from './utils'

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
