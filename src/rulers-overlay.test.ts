import { describe, expect, it } from 'vitest'
import { computeCanvasRulerScrollOffset } from './rulers-overlay'

function guidelineViewportPos(position: number, pan: number, zoom: number, bodyOffset: number): number {
  return bodyOffset + (position - bodyOffset + pan) * zoom
}

function rulerViewportPos(position: number, pan: number, zoom: number, bodyOffset: number): number {
  const scrollOffset = computeCanvasRulerScrollOffset(pan, zoom, bodyOffset)
  return (position - scrollOffset) * zoom
}

describe('computeCanvasRulerScrollOffset', () => {
  it('matches guideline viewport mapping when body offset is present', () => {
    const cases = [
      { position: 100, pan: 0, zoom: 2, bodyOffset: 8 },
      { position: 420, pan: -180, zoom: 1.25, bodyOffset: 8 },
      { position: 64, pan: 32, zoom: 3.5, bodyOffset: 12 },
      { position: -40, pan: 10, zoom: 0.75, bodyOffset: 16 },
    ]

    for (const entry of cases) {
      expect(
        rulerViewportPos(entry.position, entry.pan, entry.zoom, entry.bodyOffset),
      ).toBeCloseTo(
        guidelineViewportPos(entry.position, entry.pan, entry.zoom, entry.bodyOffset),
        10,
      )
    }
  })

  it('falls back to pan-only behavior at 1x zoom', () => {
    expect(computeCanvasRulerScrollOffset(24, 1, 8)).toBe(-24)
    expect(computeCanvasRulerScrollOffset(-120, 1, 16)).toBe(120)
  })
})
