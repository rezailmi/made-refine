import { describe, expect, it } from 'vitest'
import { attributeClassesForProperty, expandPropertyForAttribution } from './tailwind-attribution'

describe('attributeClassesForProperty', () => {
  it('exact preset: padding-top vs [pt-2, flex] → matched [pt-2]', () => {
    const result = attributeClassesForProperty('padding-top', ['pt-2', 'flex'])
    expect(result.matchedClasses).toEqual(['pt-2'])
    expect(result.variantMatches).toEqual([])
  })

  it('axis shorthand: padding-left vs [px-4] → matched', () => {
    const result = attributeClassesForProperty('padding-left', ['px-4'])
    expect(result.matchedClasses).toEqual(['px-4'])
    expect(result.variantMatches).toEqual([])
  })

  it('collapsed padding-inline vs [px-4] → matched', () => {
    const result = attributeClassesForProperty('padding-inline', ['px-4'])
    expect(result.matchedClasses).toEqual(['px-4'])
    expect(result.variantMatches).toEqual([])
  })

  it('arbitrary value: width vs [w-[372px]] → matched', () => {
    const result = attributeClassesForProperty('width', ['w-[372px]'])
    expect(result.matchedClasses).toEqual(['w-[372px]'])
    expect(result.variantMatches).toEqual([])
  })

  it('arbitrary property: border-top-style vs [[border-top-style:dashed]] → matched', () => {
    const result = attributeClassesForProperty('border-top-style', ['[border-top-style:dashed]'])
    expect(result.matchedClasses).toEqual(['[border-top-style:dashed]'])
    expect(result.variantMatches).toEqual([])
  })

  it('variant: padding-top vs [sm:pt-6, pt-2] → matched [pt-2], variant [sm:pt-6]', () => {
    const result = attributeClassesForProperty('padding-top', ['sm:pt-6', 'pt-2'])
    expect(result.matchedClasses).toEqual(['pt-2'])
    expect(result.variantMatches).toEqual(['sm:pt-6'])
  })

  it('stacked variant: md:hover:pt-8 → variantMatches', () => {
    const result = attributeClassesForProperty('padding-top', ['md:hover:pt-8'])
    expect(result.matchedClasses).toEqual([])
    expect(result.variantMatches).toEqual(['md:hover:pt-8'])
  })

  it('important modifier: [!pt-2] → matched, original string reported', () => {
    const result = attributeClassesForProperty('padding-top', ['!pt-2'])
    expect(result.matchedClasses).toEqual(['!pt-2'])
    expect(result.variantMatches).toEqual([])
  })

  describe('text-* disambiguation', () => {
    const classList = ['text-center', 'text-sm', 'text-[#FF0000]']

    it('text-align → only text-center', () => {
      const result = attributeClassesForProperty('text-align', classList)
      expect(result.matchedClasses).toEqual(['text-center'])
    })

    it('font-size → only text-sm', () => {
      const result = attributeClassesForProperty('font-size', classList)
      expect(result.matchedClasses).toEqual(['text-sm'])
    })

    it('color → only text-[#FF0000]', () => {
      const result = attributeClassesForProperty('color', classList)
      expect(result.matchedClasses).toEqual(['text-[#FF0000]'])
    })
  })

  it('negative margin: margin-top vs [-mt-2] → matched', () => {
    const result = attributeClassesForProperty('margin-top', ['-mt-2'])
    expect(result.matchedClasses).toEqual(['-mt-2'])
    expect(result.variantMatches).toEqual([])
  })

  it('colon inside brackets: [bg-[url(:x)]] does not split as a variant', () => {
    const result = attributeClassesForProperty('background-color', ['bg-[url(:x)]'])
    expect(result.matchedClasses).toEqual(['bg-[url(:x)]'])
    expect(result.variantMatches).toEqual([])
  })

  it('no match: opacity vs [flex] → both arrays empty', () => {
    const result = attributeClassesForProperty('opacity', ['flex'])
    expect(result.matchedClasses).toEqual([])
    expect(result.variantMatches).toEqual([])
  })

  it('border-width: border vs [border, border-solid, pt-2] → matched [border]', () => {
    const result = attributeClassesForProperty('border-width', ['border', 'border-solid', 'pt-2'])
    expect(result.matchedClasses).toEqual(['border'])
    expect(result.variantMatches).toEqual([])
  })

  it('border-style: border-dashed → matched', () => {
    const result = attributeClassesForProperty('border-style', ['border-dashed'])
    expect(result.matchedClasses).toEqual(['border-dashed'])
  })

  it('box-shadow: shadow-md → matched', () => {
    const result = attributeClassesForProperty('box-shadow', ['shadow-md', 'flex'])
    expect(result.matchedClasses).toEqual(['shadow-md'])
  })

  it('opacity: opacity-50 → matched', () => {
    const result = attributeClassesForProperty('opacity', ['opacity-50', 'flex'])
    expect(result.matchedClasses).toEqual(['opacity-50'])
  })

  it('overflow: overflow-hidden → matched', () => {
    const result = attributeClassesForProperty('overflow', ['overflow-hidden', 'flex'])
    expect(result.matchedClasses).toEqual(['overflow-hidden'])
  })

  it('object-fit: object-cover → matched', () => {
    const result = attributeClassesForProperty('object-fit', ['object-cover'])
    expect(result.matchedClasses).toEqual(['object-cover'])
  })

  it('padding shorthand matches p-* → all four longhand sides + padding', () => {
    const result = attributeClassesForProperty('padding', ['p-4', 'flex'])
    expect(result.matchedClasses).toEqual(['p-4'])
  })

  it('padding shorthand also matches pt-* since it expands padding→includes padding-top', () => {
    const result = attributeClassesForProperty('padding', ['pt-2', 'flex'])
    expect(result.matchedClasses).toEqual(['pt-2'])
  })

  describe('flex-wrap attribution (v6)', () => {
    it('flex-wrap: flex-wrap → matched', () => {
      const result = attributeClassesForProperty('flex-wrap', ['flex-wrap', 'flex-row'])
      expect(result.matchedClasses).toEqual(['flex-wrap'])
      expect(result.variantMatches).toEqual([])
    })

    it('flex-wrap: flex-nowrap → matched', () => {
      const result = attributeClassesForProperty('flex-wrap', ['flex-nowrap'])
      expect(result.matchedClasses).toEqual(['flex-nowrap'])
    })

    it('flex-wrap: flex-wrap-reverse → matched', () => {
      const result = attributeClassesForProperty('flex-wrap', ['flex-wrap-reverse'])
      expect(result.matchedClasses).toEqual(['flex-wrap-reverse'])
    })

    it('flex-direction vs [flex-wrap] → no match', () => {
      const result = attributeClassesForProperty('flex-direction', ['flex-wrap'])
      expect(result.matchedClasses).toEqual([])
    })

    it('display vs [flex-wrap] → no match', () => {
      const result = attributeClassesForProperty('display', ['flex-wrap'])
      expect(result.matchedClasses).toEqual([])
    })

    it('flex-wrap class does not leak into flex-direction attribution', () => {
      const result = attributeClassesForProperty('flex-direction', ['flex-row', 'flex-wrap'])
      expect(result.matchedClasses).toEqual(['flex-row'])
    })
  })
})

describe('expandPropertyForAttribution', () => {
  it('padding expands to itself and four sides', () => {
    expect(expandPropertyForAttribution('padding')).toEqual([
      'padding',
      'padding-top',
      'padding-right',
      'padding-bottom',
      'padding-left',
    ])
  })

  it('padding-inline expands to left/right/itself', () => {
    expect(expandPropertyForAttribution('padding-inline')).toContain('padding-left')
    expect(expandPropertyForAttribution('padding-inline')).toContain('padding-right')
  })

  it('unknown property returns itself only', () => {
    expect(expandPropertyForAttribution('font-size')).toEqual(['font-size'])
  })
})

describe('attribution misclassification fixes (plan 035)', () => {
  it('border-color vs [border-x-2] — not a color class', () => {
    const result = attributeClassesForProperty('border-color', ['border-x-2'])
    expect(result.matchedClasses).toEqual([])
  })

  it('border-left-width vs [border-x-2] — IS a width class', () => {
    const result = attributeClassesForProperty('border-left-width', ['border-x-2'])
    expect(result.matchedClasses).toEqual(['border-x-2'])
  })

  it('border-color vs [border-3] — numeric suffix is width, not color', () => {
    const result = attributeClassesForProperty('border-color', ['border-3'])
    expect(result.matchedClasses).toEqual([])
  })

  it('border-color vs [border-[3px]] — arbitrary-length suffix is width, not color', () => {
    const result = attributeClassesForProperty('border-color', ['border-[3px]'])
    expect(result.matchedClasses).toEqual([])
  })

  it('color vs [text-nowrap] — text-nowrap is not a color class', () => {
    const result = attributeClassesForProperty('color', ['text-nowrap'])
    expect(result.matchedClasses).toEqual([])
  })

  it('color vs [text-balance] — text-balance is not a color class', () => {
    const result = attributeClassesForProperty('color', ['text-balance'])
    expect(result.matchedClasses).toEqual([])
  })

  it('color vs [text-ellipsis] — text-ellipsis is not a color class', () => {
    const result = attributeClassesForProperty('color', ['text-ellipsis'])
    expect(result.matchedClasses).toEqual([])
  })

  it('background vs [bg-red-500] — bg-* now attributed to background shorthand too', () => {
    const result = attributeClassesForProperty('background', ['bg-red-500'])
    expect(result.matchedClasses).toEqual(['bg-red-500'])
  })

  it('border-y vs border-y-2 — attributed to border-top-width', () => {
    const result = attributeClassesForProperty('border-top-width', ['border-y-2'])
    expect(result.matchedClasses).toEqual(['border-y-2'])
  })
})
