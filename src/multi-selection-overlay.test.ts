import { afterEach, describe, expect, it } from 'vitest'
import { dedupeConnectedElements, getGroupBounds } from './multi-selection-overlay'

describe('multi-selection-overlay helpers', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('returns zero bounds for an empty group', () => {
    expect(getGroupBounds([])).toEqual({ left: 0, top: 0, right: 0, bottom: 0 })
  })

  it('returns the rect bounds for a single item', () => {
    expect(getGroupBounds([new DOMRect(10, 20, 30, 40)])).toEqual({
      left: 10,
      top: 20,
      right: 40,
      bottom: 60,
    })
  })

  it('returns the min/max envelope for multiple items', () => {
    expect(
      getGroupBounds([
        new DOMRect(10, 20, 30, 40),
        new DOMRect(5, 25, 10, 10),
        new DOMRect(50, 2, 8, 16),
      ])
    ).toEqual({
      left: 5,
      top: 2,
      right: 58,
      bottom: 60,
    })
  })

  it('dedupes connected elements in input order', () => {
    const first = document.createElement('div')
    const second = document.createElement('section')
    document.body.append(first, second)

    expect(dedupeConnectedElements([first, second, first])).toEqual([first, second])
  })

  it('filters detached elements', () => {
    const connected = document.createElement('div')
    const detached = document.createElement('aside')
    document.body.appendChild(connected)

    expect(dedupeConnectedElements([detached, connected])).toEqual([connected])
  })
})
