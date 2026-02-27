import { afterEach, describe, expect, it } from 'vitest'
import {
  clampSize,
  computeCornerProportionalSize,
  computeEdgeSize,
  computeFillRenderedWidth,
} from './resize-geometry'

describe('resize-geometry', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('clamps invalid sizes', () => {
    expect(clampSize(-10)).toBe(1)
    expect(clampSize(Number.NaN)).toBe(1)
    expect(clampSize(10.2)).toBeCloseTo(10.2)
  })

  it('computes edge-based size deltas', () => {
    expect(computeEdgeSize({
      handle: 'right',
      startWidth: 100,
      startHeight: 40,
      dx: 25,
      dy: 0,
    })).toEqual({ width: 125, height: 40 })

    expect(computeEdgeSize({
      handle: 'left',
      startWidth: 100,
      startHeight: 40,
      dx: 25,
      dy: 0,
    })).toEqual({ width: 75, height: 40 })

    expect(computeEdgeSize({
      handle: 'top',
      startWidth: 100,
      startHeight: 40,
      dx: 0,
      dy: 20,
    })).toEqual({ width: 100, height: 20 })
  })

  it('preserves aspect ratio for corner drags', () => {
    const next = computeCornerProportionalSize({
      handle: 'bottom-right',
      startWidth: 200,
      startHeight: 100,
      dx: 80,
      dy: 10,
    })

    expect(next.width).toBe(280)
    expect(next.height).toBe(140)
  })

  it('computes fill rendered width for content-box children', () => {
    const parent = document.createElement('div')
    parent.style.paddingLeft = '10px'
    parent.style.paddingRight = '20px'
    Object.defineProperty(parent, 'clientWidth', { configurable: true, value: 220 })

    const child = document.createElement('div')
    child.style.boxSizing = 'content-box'
    child.style.paddingLeft = '8px'
    child.style.paddingRight = '7px'
    child.style.borderLeftWidth = '2px'
    child.style.borderRightWidth = '3px'
    child.style.borderLeftStyle = 'solid'
    child.style.borderRightStyle = 'solid'

    parent.appendChild(child)
    document.body.appendChild(parent)

    // parent content width = 220 - 10 - 20 = 190
    // content-box border-box width = 190 + 8 + 7 + 2 + 3 = 210
    expect(computeFillRenderedWidth(child)).toBe(210)
  })

  it('computes fill rendered width for border-box children', () => {
    const parent = document.createElement('div')
    parent.style.paddingLeft = '12px'
    parent.style.paddingRight = '8px'
    Object.defineProperty(parent, 'clientWidth', { configurable: true, value: 200 })

    const child = document.createElement('div')
    child.style.boxSizing = 'border-box'
    parent.appendChild(child)
    document.body.appendChild(parent)

    // parent content width = 200 - 12 - 8 = 180
    expect(computeFillRenderedWidth(child)).toBe(180)
  })
})
