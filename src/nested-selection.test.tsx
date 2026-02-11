import * as React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, act } from '@testing-library/react'
import { computeHoverHighlight, resolveElementTarget, findChildAtPoint } from './utils'
import { SelectionOverlay } from './selection-overlay'

// Mock elementFromPointWithoutOverlays used by SelectionOverlay
const { elementFromPointMock } = vi.hoisted(() => ({
  elementFromPointMock: vi.fn<(x: number, y: number) => HTMLElement | null>(),
}))

vi.mock('./utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./utils')>()
  return {
    ...actual,
    elementFromPointWithoutOverlays: elementFromPointMock,
  }
})

function el(tag = 'div', style = ''): HTMLElement {
  const e = document.createElement(tag)
  if (style) e.style.cssText = style
  document.body.appendChild(e)
  return e
}

function dispatchPointer(type: 'pointermove' | 'pointerup', x = 0, y = 0) {
  const event = new Event(type) as PointerEvent
  Object.defineProperty(event, 'clientX', { value: x })
  Object.defineProperty(event, 'clientY', { value: y })
  window.dispatchEvent(event)
}

describe('computeHoverHighlight', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('returns null for null element', () => {
    expect(computeHoverHighlight(null, null)).toBeNull()
  })

  it('returns null for document.body', () => {
    expect(computeHoverHighlight(document.body, null)).toBeNull()
  })

  it('returns null for document.documentElement', () => {
    expect(computeHoverHighlight(document.documentElement, null)).toBeNull()
  })

  it('returns null when element equals selectedElement', () => {
    const selected = el()
    expect(computeHoverHighlight(selected, selected)).toBeNull()
  })

  it('returns null for elements inside data-direct-edit overlay', () => {
    const overlay = el()
    overlay.setAttribute('data-direct-edit', 'overlay')
    const child = document.createElement('span')
    overlay.appendChild(child)
    expect(computeHoverHighlight(child, null)).toBeNull()
  })

  it('returns null for elements inside data-direct-edit-host', () => {
    const host = el()
    host.setAttribute('data-direct-edit-host', '')
    const child = document.createElement('span')
    host.appendChild(child)
    expect(computeHoverHighlight(child, null)).toBeNull()
  })

  it('returns flex container with its children when element is a flex container', () => {
    const container = el('div', 'display: flex')
    const childA = document.createElement('div')
    const childB = document.createElement('div')
    container.appendChild(childA)
    container.appendChild(childB)

    const result = computeHoverHighlight(container, null)
    expect(result).not.toBeNull()
    expect(result!.flexContainer).toBe(container)
    expect(result!.children).toEqual([childA, childB])
  })

  it('walks up to find the nearest flex parent', () => {
    const flexParent = el('div', 'display: flex')
    const child = document.createElement('div')
    const grandchild = document.createElement('span')
    flexParent.appendChild(child)
    child.appendChild(grandchild)

    const result = computeHoverHighlight(grandchild, null)
    expect(result).not.toBeNull()
    expect(result!.flexContainer).toBe(flexParent)
    expect(result!.children).toContain(child)
  })

  it('returns element with empty children when no flex ancestor exists', () => {
    const plain = el('div', 'display: block')
    const child = document.createElement('span')
    plain.appendChild(child)

    const result = computeHoverHighlight(child, null)
    expect(result).not.toBeNull()
    expect(result!.flexContainer).toBe(child)
    expect(result!.children).toEqual([])
  })

  it('stops walk-up at selectedElement boundary', () => {
    // outer (flex) > selected (block) > inner (block) > target
    const outer = el('div', 'display: flex')
    const selected = document.createElement('div')
    selected.style.display = 'block'
    const inner = document.createElement('div')
    inner.style.display = 'block'
    const target = document.createElement('span')

    outer.appendChild(selected)
    selected.appendChild(inner)
    inner.appendChild(target)

    // Without boundary, walk-up would reach outer (flex) and return it
    const withoutBoundary = computeHoverHighlight(target, null)
    expect(withoutBoundary!.flexContainer).toBe(outer)

    // With boundary (selectedElement = selected), walk-up stops at selected
    const withBoundary = computeHoverHighlight(target, selected)
    expect(withBoundary!.flexContainer).toBe(target)
    expect(withBoundary!.children).toEqual([])
  })

  it('returns flex selectedElement as container when it is the flex parent of the hovered child', () => {
    const selected = el('div', 'display: flex')
    const childA = document.createElement('div')
    const childB = document.createElement('div')
    selected.appendChild(childA)
    selected.appendChild(childB)

    const result = computeHoverHighlight(childA, selected)
    expect(result).not.toBeNull()
    expect(result!.flexContainer).toBe(selected)
    expect(result!.children).toEqual([childA, childB])
  })

  it('handles inline-flex containers', () => {
    const container = el('div', 'display: inline-flex')
    const child = document.createElement('span')
    container.appendChild(child)

    const result = computeHoverHighlight(container, null)
    expect(result!.flexContainer).toBe(container)
    expect(result!.children).toEqual([child])
  })
})

describe('resolveElementTarget', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('returns the element itself when no flex parent exists', () => {
    const target = el('div', 'display: block')
    expect(resolveElementTarget(target, null)).toBe(target)
  })

  it('returns the direct child of a flex parent', () => {
    const flexParent = el('div', 'display: flex')
    const child = document.createElement('div')
    const grandchild = document.createElement('span')
    flexParent.appendChild(child)
    child.appendChild(grandchild)

    expect(resolveElementTarget(grandchild, null)).toBe(child)
  })

  it('stops at selectedElement boundary when inside selected element', () => {
    // outer (flex) > selected (block) > target
    const outer = el('div', 'display: flex')
    const selected = document.createElement('div')
    selected.style.display = 'block'
    const target = document.createElement('span')
    outer.appendChild(selected)
    selected.appendChild(target)

    // Without boundary: resolves to selected (child of outer flex)
    expect(resolveElementTarget(target, null)).toBe(selected)

    // With boundary: stops at selected, returns target
    expect(resolveElementTarget(target, selected)).toBe(target)
  })

  it('allows drilling into descendants of flex selectedElement', () => {
    const selected = el('div', 'display: flex')
    const child = document.createElement('div')
    const grandchild = document.createElement('span')
    selected.appendChild(child)
    child.appendChild(grandchild)

    // Walk-up from grandchild finds selected (flex) as boundary, drills down
    expect(resolveElementTarget(grandchild, selected)).toBe(grandchild)
  })

  it('handles inline-flex parent', () => {
    const flexParent = el('div', 'display: inline-flex')
    const child = document.createElement('div')
    flexParent.appendChild(child)

    expect(resolveElementTarget(child, null)).toBe(child)
  })
})

describe('findChildAtPoint', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  function mockRect(element: HTMLElement, rect: { left: number; top: number; width: number; height: number }) {
    element.getBoundingClientRect = () => ({
      left: rect.left,
      top: rect.top,
      right: rect.left + rect.width,
      bottom: rect.top + rect.height,
      width: rect.width,
      height: rect.height,
      x: rect.left,
      y: rect.top,
      toJSON: () => ({}),
    })
  }

  it('returns null when parent has no children', () => {
    const parent = el()
    expect(findChildAtPoint(parent, 50, 50)).toBeNull()
  })

  it('returns child whose bbox contains the click', () => {
    const parent = el()
    const childA = document.createElement('div')
    const childB = document.createElement('div')
    parent.appendChild(childA)
    parent.appendChild(childB)

    mockRect(childA, { left: 0, top: 0, width: 100, height: 30 })
    mockRect(childB, { left: 0, top: 30, width: 100, height: 30 })

    expect(findChildAtPoint(parent, 50, 15)).toBe(childA)
    expect(findChildAtPoint(parent, 50, 45)).toBe(childB)
  })

  it('returns the single child even when click is outside its bbox', () => {
    const parent = el()
    const child = document.createElement('div')
    parent.appendChild(child)

    mockRect(child, { left: 0, top: 30, width: 100, height: 30 })

    // Click above the child (on bare text area)
    expect(findChildAtPoint(parent, 50, 10)).toBe(child)
  })

  it('returns null when click misses all children and multiple exist', () => {
    const parent = el()
    const childA = document.createElement('div')
    const childB = document.createElement('div')
    parent.appendChild(childA)
    parent.appendChild(childB)

    mockRect(childA, { left: 0, top: 20, width: 100, height: 30 })
    mockRect(childB, { left: 0, top: 60, width: 100, height: 30 })

    // Click in gap between children
    expect(findChildAtPoint(parent, 50, 55)).toBeNull()
  })

  it('ignores non-HTMLElement children', () => {
    const parent = el()
    parent.innerHTML = 'bare text'
    // No HTMLElement children
    expect(findChildAtPoint(parent, 50, 50)).toBeNull()
  })
})

describe('SelectionOverlay', () => {
  const defaultRect = {
    left: 100, top: 50, width: 200, height: 100,
    right: 300, bottom: 150, x: 100, y: 50,
    toJSON: () => ({}),
  } as DOMRect

  let selectedElement: HTMLElement

  beforeEach(() => {
    elementFromPointMock.mockReset()
    selectedElement = document.createElement('div')
    selectedElement.getBoundingClientRect = () => defaultRect
    document.body.appendChild(selectedElement)
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('calls onHoverElement with the element under cursor on mousemove', () => {
    const onHoverElement = vi.fn()
    const childElement = document.createElement('span')
    elementFromPointMock.mockReturnValue(childElement)

    const { container } = render(
      <SelectionOverlay
        selectedElement={selectedElement}
        isDragging={false}
        onMoveStart={vi.fn()}
        onHoverElement={onHoverElement}
      />
    )

    const handle = container.querySelector('[data-direct-edit="selection-handle"]') as HTMLElement
    expect(handle).not.toBeNull()

    act(() => {
      handle.dispatchEvent(new MouseEvent('mousemove', {
        clientX: 150,
        clientY: 80,
        bubbles: true,
      }))
    })

    expect(elementFromPointMock).toHaveBeenCalledWith(150, 80)
    expect(onHoverElement).toHaveBeenCalledWith(childElement)
  })

  it('calls onHoverElement with null on mouseleave', () => {
    const onHoverElement = vi.fn()

    const { container } = render(
      <SelectionOverlay
        selectedElement={selectedElement}
        isDragging={false}
        onMoveStart={vi.fn()}
        onHoverElement={onHoverElement}
      />
    )

    const handle = container.querySelector('[data-direct-edit="selection-handle"]') as HTMLElement

    // mouseleave does not bubble, so we must use the React-compatible approach
    act(() => {
      const event = new MouseEvent('mouseleave', { bubbles: false })
      Object.defineProperty(event, 'target', { value: handle })
      handle.dispatchEvent(event)
    })

    // If jsdom doesn't trigger React's onMouseLeave via raw DOM events,
    // verify the callback is at least wired up by simulating a mouseout
    // which React uses internally to synthesize mouseleave
    if (!onHoverElement.mock.calls.length) {
      onHoverElement.mockClear()
      act(() => {
        handle.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }))
      })
    }

    expect(onHoverElement).toHaveBeenCalledWith(null)
  })

  it('calls onClickThrough on pointerup without drag (after dblclick delay)', () => {
    vi.useFakeTimers()
    const onClickThrough = vi.fn()

    const { container } = render(
      <SelectionOverlay
        selectedElement={selectedElement}
        isDragging={false}
        onMoveStart={vi.fn()}
        onClickThrough={onClickThrough}
      />
    )

    const handle = container.querySelector('[data-direct-edit="selection-handle"]') as HTMLElement

    act(() => {
      handle.dispatchEvent(new PointerEvent('pointerdown', {
        clientX: 150,
        clientY: 80,
        bubbles: true,
      }))
    })

    act(() => {
      dispatchPointer('pointerup', 151, 81)
    })

    // Not called immediately — delayed to avoid racing with dblclick
    expect(onClickThrough).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(300)
    })

    expect(onClickThrough).toHaveBeenCalledWith(151, 81)
    vi.useRealTimers()
  })

  it('ignores non-primary pointerdown and does not call onClickThrough', () => {
    const onClickThrough = vi.fn()
    const onMoveStart = vi.fn()

    const { container } = render(
      <SelectionOverlay
        selectedElement={selectedElement}
        isDragging={false}
        onMoveStart={onMoveStart}
        onClickThrough={onClickThrough}
      />
    )

    const handle = container.querySelector('[data-direct-edit="selection-handle"]') as HTMLElement

    act(() => {
      handle.dispatchEvent(new PointerEvent('pointerdown', {
        button: 2,
        clientX: 100,
        clientY: 50,
        bubbles: true,
      }))
    })

    act(() => {
      dispatchPointer('pointermove', 120, 70)
      dispatchPointer('pointerup', 120, 70)
    })

    expect(onMoveStart).not.toHaveBeenCalled()
    expect(onClickThrough).not.toHaveBeenCalled()
  })

  it('does NOT call onClickThrough when drag threshold is exceeded', () => {
    const onClickThrough = vi.fn()
    const onMoveStart = vi.fn()

    const { container } = render(
      <SelectionOverlay
        selectedElement={selectedElement}
        isDragging={false}
        onMoveStart={onMoveStart}
        onClickThrough={onClickThrough}
      />
    )

    const handle = container.querySelector('[data-direct-edit="selection-handle"]') as HTMLElement

    act(() => {
      handle.dispatchEvent(new PointerEvent('pointerdown', {
        clientX: 100,
        clientY: 50,
        bubbles: true,
      }))
    })

    // Move beyond threshold (4px)
    act(() => {
      dispatchPointer('pointermove', 110, 60)
    })

    expect(onMoveStart).toHaveBeenCalled()
    expect(onClickThrough).not.toHaveBeenCalled()
  })

  it('hides handle div when isDragging is true', () => {
    const { container } = render(
      <SelectionOverlay
        selectedElement={selectedElement}
        isDragging={true}
        onMoveStart={vi.fn()}
      />
    )

    const handle = container.querySelector('[data-direct-edit="selection-handle"]')
    expect(handle).toBeNull()
  })

  it('hides handle div when isTextEditing is true', () => {
    const { container } = render(
      <SelectionOverlay
        selectedElement={selectedElement}
        isDragging={false}
        isTextEditing={true}
        onMoveStart={vi.fn()}
      />
    )

    const handle = container.querySelector('[data-direct-edit="selection-handle"]')
    expect(handle).toBeNull()
  })

  it('hides selection rectangle when isTextEditing is true', () => {
    const { container } = render(
      <SelectionOverlay
        selectedElement={selectedElement}
        isDragging={false}
        isTextEditing={true}
        onMoveStart={vi.fn()}
      />
    )

    const rect = container.querySelector('rect')
    expect(rect).toBeNull()
  })

  it('calls onDoubleClick on double-click', () => {
    const onDoubleClick = vi.fn()

    const { container } = render(
      <SelectionOverlay
        selectedElement={selectedElement}
        isDragging={false}
        onMoveStart={vi.fn()}
        onDoubleClick={onDoubleClick}
      />
    )

    const handle = container.querySelector('[data-direct-edit="selection-handle"]') as HTMLElement

    act(() => {
      handle.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, clientX: 140, clientY: 77 }))
    })

    expect(onDoubleClick).toHaveBeenCalledWith(140, 77)
  })
})
