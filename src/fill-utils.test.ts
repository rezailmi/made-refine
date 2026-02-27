import { describe, expect, it } from 'vitest'
import { parseFillLayers, serializeFillLayers } from './fill-utils'
import type { ColorValue } from './types'

describe('parseFillLayers', () => {
  it('returns empty array for transparent background', () => {
    expect(parseFillLayers('transparent', '')).toEqual([])
    expect(parseFillLayers('rgba(0, 0, 0, 0)', '')).toEqual([])
  })

  it('parses a single background color', () => {
    const layers = parseFillLayers('rgb(255, 0, 0)', '')
    expect(layers).toHaveLength(1)
    expect(layers[0].hex).toBe('FF0000')
    expect(layers[0].alpha).toBe(100)
  })

  it('parses linear-gradient layers from background shorthand', () => {
    const layers = parseFillLayers(
      'rgb(255, 0, 0)',
      'linear-gradient(#FF0000, #FF0000), linear-gradient(rgba(0, 0, 255, 0.5), rgba(0, 0, 255, 0.5))',
    )
    expect(layers).toHaveLength(2)
    expect(layers[0].hex).toBe('FF0000')
    expect(layers[0].alpha).toBe(100)
    expect(layers[1].hex).toBe('0000FF')
    expect(layers[1].alpha).toBe(50)
  })

  it('returns empty for empty string', () => {
    expect(parseFillLayers('', '')).toEqual([])
  })
})

describe('serializeFillLayers', () => {
  it('serializes 0 layers to transparent background-color', () => {
    const { properties } = serializeFillLayers([])
    expect(properties['background-color']).toBe('transparent')
    expect(properties.background).toBe('')
  })

  it('serializes 1 layer to background-color', () => {
    const layer: ColorValue = { hex: 'FF0000', alpha: 100, raw: '#FF0000' }
    const { properties } = serializeFillLayers([layer])
    expect(properties['background-color']).toBe('#FF0000')
    expect(properties.background).toBe('')
  })

  it('serializes multiple layers to background gradients', () => {
    const layers: ColorValue[] = [
      { hex: 'FF0000', alpha: 100, raw: '#FF0000' },
      { hex: '0000FF', alpha: 50, raw: 'rgba(0, 0, 255, 0.5)' },
    ]
    const { properties } = serializeFillLayers(layers)
    expect(properties.background).toBe(
      'linear-gradient(#FF0000, #FF0000), linear-gradient(rgba(0, 0, 255, 0.5), rgba(0, 0, 255, 0.5))',
    )
    expect(properties['background-color']).toBe('')
  })
})
