import { describe, it, expect } from 'vitest'
import { parseColorValue } from './color'

describe('parseColorValue', () => {
  describe('hex colors', () => {
    it('parses 6-digit hex', () => {
      const result = parseColorValue('#FF5733')
      expect(result.hex).toBe('FF5733')
      expect(result.alpha).toBe(100)
    })

    it('parses 3-digit hex shorthand', () => {
      const result = parseColorValue('#F00')
      expect(result.hex).toBe('FF0000')
      expect(result.alpha).toBe(100)
    })

    it('parses 4-digit hex shorthand (#RGBA)', () => {
      const result = parseColorValue('#F008')
      expect(result.hex).toBe('FF0000')
      expect(result.alpha).toBe(Math.round((0x88 / 255) * 100))
    })

    it('parses 8-digit hex with alpha', () => {
      const result = parseColorValue('#FF573380')
      expect(result.hex).toBe('FF5733')
      expect(result.alpha).toBe(Math.round((0x80 / 255) * 100))
    })

    it('parses 8-digit hex fully opaque', () => {
      const result = parseColorValue('#FF5733FF')
      expect(result.hex).toBe('FF5733')
      expect(result.alpha).toBe(100)
    })

    it('parses 8-digit hex fully transparent', () => {
      const result = parseColorValue('#FF573300')
      expect(result.hex).toBe('FF5733')
      expect(result.alpha).toBe(0)
    })
  })

  describe('rgb/rgba comma-separated (legacy)', () => {
    it('parses rgb(R, G, B)', () => {
      const result = parseColorValue('rgb(255, 87, 51)')
      expect(result.hex).toBe('FF5733')
      expect(result.alpha).toBe(100)
    })

    it('parses rgba(R, G, B, A)', () => {
      const result = parseColorValue('rgba(255, 87, 51, 0.5)')
      expect(result.hex).toBe('FF5733')
      expect(result.alpha).toBe(50)
    })

    it('parses rgba with percentage alpha', () => {
      const result = parseColorValue('rgba(255, 87, 51, 50%)')
      expect(result.hex).toBe('FF5733')
      expect(result.alpha).toBe(50)
    })
  })

  describe('rgb space-separated (modern)', () => {
    it('parses rgb(R G B)', () => {
      const result = parseColorValue('rgb(255 87 51)')
      expect(result.hex).toBe('FF5733')
      expect(result.alpha).toBe(100)
    })

    it('parses rgb(R G B / A) with decimal alpha', () => {
      const result = parseColorValue('rgb(255 87 51 / 0.5)')
      expect(result.hex).toBe('FF5733')
      expect(result.alpha).toBe(50)
    })

    it('parses rgb(R G B / A) with percentage alpha', () => {
      const result = parseColorValue('rgb(255 87 51 / 50%)')
      expect(result.hex).toBe('FF5733')
      expect(result.alpha).toBe(50)
    })

    it('parses rgb(R G B / 0)', () => {
      const result = parseColorValue('rgb(0 0 0 / 0)')
      expect(result.hex).toBe('000000')
      expect(result.alpha).toBe(0)
    })
  })

  describe('special values', () => {
    it('parses transparent', () => {
      const result = parseColorValue('transparent')
      expect(result.hex).toBe('000000')
      expect(result.alpha).toBe(0)
    })
  })

  describe('invalid input', () => {
    it('returns fallback for unrecognized format', () => {
      // parseNamedColor requires a canvas (not available in tests),
      // so unrecognized values fall through to named color path.
      // We just verify it doesn't throw.
      expect(() => parseColorValue('not-a-color')).not.toThrow()
    })
  })
})
