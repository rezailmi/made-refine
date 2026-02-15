import { describe, expect, it } from 'vitest'
import {
  createDefaultShadowLayer,
  parseShadowLayer,
  parseShadowLayers,
  serializeShadowLayers,
  splitShadowLayers,
} from './shadow-utils'

describe('shadow-utils', () => {
  it('splits multi-layer values while preserving function commas', () => {
    const layers = splitShadowLayers('0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)')
    expect(layers).toEqual([
      '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
      '0 2px 4px -2px rgba(0, 0, 0, 0.1)',
    ])
  })

  it('parses color-first syntax and unitless zero lengths', () => {
    const fallback = createDefaultShadowLayer(0)
    const parsed = parseShadowLayer('rgba(0, 0, 0, 0.2) 0 4px 6px -1px', fallback)

    expect(parsed.x).toBe(0)
    expect(parsed.y).toBe(4)
    expect(parsed.blur).toBe(6)
    expect(parsed.spread).toBe(-1)
    expect(parsed.color.alpha).toBe(20)
  })

  it('parses trailing color tokens that are not rgba/hsla', () => {
    const fallback = createDefaultShadowLayer(0)
    const parsed = parseShadowLayer('0 4px 6px -1px #112233', fallback)

    expect(parsed.x).toBe(0)
    expect(parsed.y).toBe(4)
    expect(parsed.blur).toBe(6)
    expect(parsed.spread).toBe(-1)
    expect(parsed.color.hex).toBe('112233')
    expect(parsed.color.alpha).toBe(100)
  })

  it('parses modern rgb slash alpha syntax', () => {
    const fallback = createDefaultShadowLayer(0)
    const parsed = parseShadowLayer('0 4px 6px -1px rgb(0 0 0 / 0.1)', fallback)

    expect(parsed.color.hex).toBe('000000')
    expect(parsed.color.alpha).toBe(10)
  })

  it('defaults blur and spread to zero for shorthand values', () => {
    const fallback = createDefaultShadowLayer(0)
    const parsed = parseShadowLayer('2px 2px #000', fallback)

    expect(parsed.x).toBe(2)
    expect(parsed.y).toBe(2)
    expect(parsed.blur).toBe(0)
    expect(parsed.spread).toBe(0)
  })

  it('round-trips parsed layers to CSS and serializes empty as none', () => {
    const layers = parseShadowLayers('0 4px 6px -1px rgba(0, 0, 0, 0.1)')
    expect(serializeShadowLayers([])).toBe('none')
    expect(serializeShadowLayers(layers)).toContain('0px 4px 6px -1px')
  })
})
