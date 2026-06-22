import { afterEach, describe, expect, it } from 'vitest'
import {
  compareDomOrder,
  isSelectableElement,
  normalizeMarqueeRect,
  rectsIntersect,
} from './interaction-overlay'

function rect(left: number, top: number, width: number, height: number): DOMRect {
  return new DOMRect(left, top, width, height)
}

function makeVisibleElement(tagName = 'div') {
  const element = document.createElement(tagName)
  element.getBoundingClientRect = () => rect(10, 20, 100, 50)
  document.body.appendChild(element)
  return element
}

describe('interaction-overlay helpers', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('normalizes marquee rectangles for down-right and up-left drags', () => {
    expect(normalizeMarqueeRect(10, 10, 40, 30)).toEqual({
      left: 10,
      top: 10,
      width: 30,
      height: 20,
    })

    expect(normalizeMarqueeRect(40, 30, 10, 10)).toEqual({
      left: 10,
      top: 10,
      width: 30,
      height: 20,
    })
  })

  it('detects overlapping, disjoint, and edge-touching rects', () => {
    expect(rectsIntersect({ left: 0, top: 0, width: 20, height: 20 }, rect(10, 10, 10, 10))).toBe(
      true
    )
    expect(rectsIntersect({ left: 0, top: 0, width: 20, height: 20 }, rect(30, 30, 10, 10))).toBe(
      false
    )
    expect(rectsIntersect({ left: 0, top: 0, width: 20, height: 20 }, rect(20, 5, 10, 10))).toBe(
      true
    )
  })

  it('compares elements by DOM order', () => {
    const first = document.createElement('div')
    const second = document.createElement('div')
    document.body.append(first, second)

    expect(compareDomOrder(first, second)).toBeLessThan(0)
    expect(compareDomOrder(second, first)).toBeGreaterThan(0)
    expect(compareDomOrder(first, first)).toBe(0)
  })

  it('rejects host and script elements as selectable', () => {
    const host = makeVisibleElement()
    host.setAttribute('data-direct-edit-host', '')
    const script = makeVisibleElement('script')

    expect(isSelectableElement(host)).toBe(false)
    expect(isSelectableElement(script)).toBe(false)
  })

  it('accepts visible connected elements as selectable', () => {
    expect(isSelectableElement(makeVisibleElement())).toBe(true)
  })
})
