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

function dispatchPointer(type: 'pointermove' | 'pointerup' | 'pointercancel', x = 0, y = 0) {
  const event = new Event(type) as PointerEvent
  Object.defineProperty(event, 'clientX', { value: x })
  Object.defineProperty(event, 'clientY', { value: y })
  window.dispatchEvent(event)
}

describe('computeHoverHighlight', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    document.documentElement.style.userSelect = ''
    document.body.style.userSelect = ''
    document.body.style.cursor = ''
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
    expect(onMoveStart.mock.calls[0]?.[2]).toEqual({ mode: 'position' })
    expect(onClickThrough).not.toHaveBeenCalled()
  })

  it('suppresses selectstart while a selection drag gesture is pending and restores it on pointerup', () => {
    const { container } = render(
      <SelectionOverlay
        selectedElement={selectedElement}
        isDragging={false}
        onMoveStart={vi.fn()}
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

    const pendingSelectStart = new Event('selectstart', { bubbles: true, cancelable: true })
    document.dispatchEvent(pendingSelectStart)

    expect(pendingSelectStart.defaultPrevented).toBe(true)
    expect(document.documentElement.style.userSelect).toBe('none')
    expect(document.body.style.userSelect).toBe('none')

    act(() => {
      dispatchPointer('pointerup', 100, 50)
    })

    const releasedSelectStart = new Event('selectstart', { bubbles: true, cancelable: true })
    document.dispatchEvent(releasedSelectStart)

    expect(releasedSelectStart.defaultPrevented).toBe(false)
    expect(document.documentElement.style.userSelect).toBe('')
    expect(document.body.style.userSelect).toBe('')
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

  it('uses dragged element dimensions while dragging', () => {
    const draggedElement = document.createElement('div')
    draggedElement.getBoundingClientRect = () => ({
      left: 20,
      top: 10,
      width: 80,
      height: 40,
      right: 100,
      bottom: 50,
      x: 20,
      y: 10,
      toJSON: () => ({}),
    }) as DOMRect
    document.body.appendChild(draggedElement)

    const { container } = render(
      <SelectionOverlay
        selectedElement={selectedElement}
        draggedElement={draggedElement}
        isDragging={true}
        ghostPosition={{ x: 310, y: 190 }}
        onMoveStart={vi.fn()}
      />
    )

    const overlay = container.querySelector('[data-direct-edit="selection-overlay"]') as HTMLElement
    expect(overlay).not.toBeNull()
    expect(overlay.style.left).toBe('310px')
    expect(overlay.style.top).toBe('190px')
    expect(overlay.style.width).toBe('80px')
    expect(overlay.style.height).toBe('40px')
    expect(overlay.style.borderRadius).toBe('0px')
  })

  it('does not render move handle by default', () => {
    const { container } = render(
      <SelectionOverlay
        selectedElement={selectedElement}
        isDragging={false}
        onMoveStart={vi.fn()}
      />
    )

    expect(container.querySelector('[data-direct-edit="move-handle"]')).toBeNull()
  })

  it('renders all 8 resize handles when enabled', () => {
    const { container } = render(
      <SelectionOverlay
        selectedElement={selectedElement}
        isDragging={false}
        onMoveStart={vi.fn()}
        enableResizeHandles={true}
      />
    )

    const resizeHandles = container.querySelectorAll('[data-direct-edit="resize-handle"]')
    expect(resizeHandles).toHaveLength(8)
  })

  it('keeps resize handles visible when active tool is the comment alias', () => {
    const { container } = render(
      <SelectionOverlay
        selectedElement={selectedElement}
        isDragging={false}
        onMoveStart={vi.fn()}
        enableResizeHandles={true}
        activeTool="comment"
      />
    )

    expect(container.querySelectorAll('[data-direct-edit="resize-handle"]')).toHaveLength(8)
  })

  it('resize handles do not trigger move-start or click-through', () => {
    const onMoveStart = vi.fn()
    const onClickThrough = vi.fn()
    const onResizeSizingChange = vi.fn()
    const parent = document.createElement('div')
    Object.defineProperty(parent, 'clientWidth', { configurable: true, value: 400 })
    parent.appendChild(selectedElement)
    document.body.appendChild(parent)

    const { container } = render(
      <SelectionOverlay
        selectedElement={selectedElement}
        isDragging={false}
        onMoveStart={onMoveStart}
        onClickThrough={onClickThrough}
        enableResizeHandles={true}
        onResizeSizingChange={onResizeSizingChange}
      />
    )

    const rightHandle = container.querySelector('[data-resize-handle="right"]') as HTMLElement
    expect(rightHandle).not.toBeNull()

    act(() => {
      rightHandle.dispatchEvent(new PointerEvent('pointerdown', {
        clientX: 300,
        clientY: 90,
        bubbles: true,
      }))
    })

    act(() => {
      dispatchPointer('pointermove', 330, 90)
      dispatchPointer('pointerup', 330, 90)
    })

    expect(onMoveStart).not.toHaveBeenCalled()
    expect(onClickThrough).not.toHaveBeenCalled()
    expect(onResizeSizingChange).toHaveBeenCalled()
  })

  it('edge double-click sets fit sizing and does not trigger selection double-click', () => {
    const onDoubleClick = vi.fn()
    const onResizeSizingChange = vi.fn()
    selectedElement.appendChild(document.createElement('span'))

    const { container } = render(
      <SelectionOverlay
        selectedElement={selectedElement}
        isDragging={false}
        onMoveStart={vi.fn()}
        onDoubleClick={onDoubleClick}
        enableResizeHandles={true}
        onResizeSizingChange={onResizeSizingChange}
      />
    )

    const edgeHandle = container.querySelector('[data-resize-handle="right"]') as HTMLElement
    expect(edgeHandle).not.toBeNull()

    act(() => {
      edgeHandle.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
    })

    expect(onResizeSizingChange).toHaveBeenCalledWith(
      expect.objectContaining({
        width: expect.objectContaining({ mode: 'fit' }),
      }),
      undefined
    )
    expect(onDoubleClick).not.toHaveBeenCalled()
  })

  it('selection handle edge double-click applies fit sizing and does not trigger text double-click', () => {
    const onDoubleClick = vi.fn()
    const onResizeSizingChange = vi.fn()
    selectedElement.textContent = 'Editable container text'

    const { container } = render(
      <SelectionOverlay
        selectedElement={selectedElement}
        isDragging={false}
        onMoveStart={vi.fn()}
        onDoubleClick={onDoubleClick}
        enableResizeHandles={true}
        onResizeSizingChange={onResizeSizingChange}
      />
    )

    const handle = container.querySelector('[data-direct-edit="selection-handle"]') as HTMLElement
    expect(handle).not.toBeNull()

    act(() => {
      handle.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, clientX: 101, clientY: 100 }))
    })

    expect(onResizeSizingChange).toHaveBeenCalledWith(
      expect.objectContaining({
        width: expect.objectContaining({ mode: 'fit' }),
      })
    )
    expect(onDoubleClick).not.toHaveBeenCalled()
  })

  it('selection handle edge double-click on button text applies fit sizing and does not trigger text double-click', () => {
    const onDoubleClick = vi.fn()
    const onResizeSizingChange = vi.fn()

    selectedElement = document.createElement('button')
    selectedElement.textContent = 'Go to canvas playground page'
    selectedElement.getBoundingClientRect = () => defaultRect
    document.body.appendChild(selectedElement)

    const { container } = render(
      <SelectionOverlay
        selectedElement={selectedElement}
        isDragging={false}
        onMoveStart={vi.fn()}
        onDoubleClick={onDoubleClick}
        enableResizeHandles={true}
        onResizeSizingChange={onResizeSizingChange}
      />
    )

    const handle = container.querySelector('[data-direct-edit="selection-handle"]') as HTMLElement
    expect(handle).not.toBeNull()

    act(() => {
      handle.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, clientX: 101, clientY: 100 }))
    })

    expect(onResizeSizingChange).toHaveBeenCalledWith(
      expect.objectContaining({
        width: expect.objectContaining({ mode: 'fit' }),
      })
    )
    expect(onDoubleClick).not.toHaveBeenCalled()
  })

  it('renders move handle when enabled and starts drag immediately', () => {
    const onMoveStart = vi.fn()
    const onClickThrough = vi.fn()
    selectedElement.style.display = 'flex'

    const children = [0, 1, 2].map((idx) => {
      const child = document.createElement('div')
      child.getBoundingClientRect = () => ({
        left: 100 + idx * 70,
        top: 50,
        width: 60,
        height: 100,
        right: 160 + idx * 70,
        bottom: 150,
        x: 100 + idx * 70,
        y: 50,
        toJSON: () => ({}),
      }) as DOMRect
      selectedElement.appendChild(child)
      return child
    })

    const { container } = render(
      <SelectionOverlay
        selectedElement={selectedElement}
        isDragging={false}
        onMoveStart={onMoveStart}
        onClickThrough={onClickThrough}
        showMoveHandle={true}
      />
    )

    const moveHandles = container.querySelectorAll('[data-direct-edit="move-handle"]')
    expect(moveHandles.length).toBe(3)
    const moveHandle = moveHandles[1] as HTMLElement
    expect(moveHandle).not.toBeNull()
    expect(moveHandle.style.background).toBe('transparent')
    expect(moveHandle.style.border).toContain('1px solid')
    expect(moveHandle.style.boxShadow).toBe('none')

    act(() => {
      moveHandle.dispatchEvent(new PointerEvent('pointerdown', {
        clientX: 120,
        clientY: 70,
        bubbles: true,
      }))
    })

    act(() => {
      dispatchPointer('pointerup', 120, 70)
    })

    expect(onMoveStart).toHaveBeenCalledTimes(1)
    expect(onMoveStart.mock.calls[0]?.[1]).toBe(children[1])
    expect(onMoveStart.mock.calls[0]?.[2]).toEqual({ constrainToOriginalParent: true, mode: 'reorder' })
    expect(onClickThrough).not.toHaveBeenCalled()
  })

  it('does not re-measure move handle targets on unrelated rerenders', () => {
    selectedElement.style.display = 'flex'
    const onMoveStart = vi.fn()

    const childRect = vi.fn(() => ({
      left: 120,
      top: 60,
      width: 60,
      height: 80,
      right: 180,
      bottom: 140,
      x: 120,
      y: 60,
      toJSON: () => ({}),
    }) as DOMRect)

    const child = document.createElement('div')
    child.getBoundingClientRect = childRect
    selectedElement.appendChild(child)

    const child2 = document.createElement('div')
    child2.getBoundingClientRect = () => ({
      left: 200, top: 60, width: 60, height: 80,
      right: 260, bottom: 140, x: 200, y: 60,
      toJSON: () => ({}),
    }) as DOMRect
    selectedElement.appendChild(child2)

    const { container, rerender } = render(
      <SelectionOverlay
        selectedElement={selectedElement}
        isDragging={false}
        onMoveStart={onMoveStart}
        showMoveHandle={true}
      />
    )

    expect(container.querySelectorAll('[data-direct-edit="move-handle"]').length).toBe(2)
    const measureCallsBefore = childRect.mock.calls.length

    rerender(
      <SelectionOverlay
        selectedElement={selectedElement}
        isDragging={false}
        onMoveStart={vi.fn()}
        showMoveHandle={true}
      />
    )

    expect(container.querySelectorAll('[data-direct-edit="move-handle"]').length).toBe(2)
    expect(childRect.mock.calls.length).toBe(measureCallsBefore)
  })

  it('renders move handles for all flex siblings when a child item is selected', () => {
    const onMoveStart = vi.fn()
    const parent = document.createElement('div')
    parent.style.display = 'flex'
    parent.appendChild(selectedElement)
    document.body.appendChild(parent)

    selectedElement.getBoundingClientRect = () => ({
      left: 120,
      top: 70,
      width: 80,
      height: 80,
      right: 200,
      bottom: 150,
      x: 120,
      y: 70,
      toJSON: () => ({}),
    }) as DOMRect

    const sibling = document.createElement('div')
    sibling.getBoundingClientRect = () => ({
      left: 210,
      top: 70,
      width: 80,
      height: 80,
      right: 290,
      bottom: 150,
      x: 210,
      y: 70,
      toJSON: () => ({}),
    }) as DOMRect
    parent.appendChild(sibling)

    const { container } = render(
      <SelectionOverlay
        selectedElement={selectedElement}
        isDragging={false}
        onMoveStart={onMoveStart}
        showMoveHandle={true}
      />
    )

    const moveHandles = container.querySelectorAll('[data-direct-edit="move-handle"]')
    expect(moveHandles.length).toBe(2)

    const selectedHandle = moveHandles[0] as HTMLElement
    act(() => {
      selectedHandle.dispatchEvent(new PointerEvent('pointerdown', {
        clientX: 145,
        clientY: 95,
        bubbles: true,
      }))
    })

    expect(onMoveStart).toHaveBeenCalledTimes(1)
    expect(onMoveStart.mock.calls[0]?.[1]).toBe(selectedElement)
    expect(onMoveStart.mock.calls[0]?.[2]).toEqual({ constrainToOriginalParent: true, mode: 'reorder' })

    onMoveStart.mockClear()
    const siblingHandle = moveHandles[1] as HTMLElement
    act(() => {
      siblingHandle.dispatchEvent(new PointerEvent('pointerdown', {
        clientX: 235,
        clientY: 95,
        bubbles: true,
      }))
    })

    expect(onMoveStart).toHaveBeenCalledTimes(1)
    expect(onMoveStart.mock.calls[0]?.[1]).toBe(sibling)
    expect(onMoveStart.mock.calls[0]?.[2]).toEqual({ constrainToOriginalParent: true, mode: 'reorder' })
  })

  it('renders move handles for all flex items when selection is nested inside one item', () => {
    const onMoveStart = vi.fn()
    const flexParent = document.createElement('div')
    flexParent.style.display = 'flex'
    document.body.appendChild(flexParent)

    const flexItemA = document.createElement('div')
    flexItemA.getBoundingClientRect = () => ({
      left: 100,
      top: 60,
      width: 120,
      height: 80,
      right: 220,
      bottom: 140,
      x: 100,
      y: 60,
      toJSON: () => ({}),
    }) as DOMRect
    const nestedSelected = document.createElement('span')
    nestedSelected.getBoundingClientRect = () => ({
      left: 130,
      top: 80,
      width: 40,
      height: 20,
      right: 170,
      bottom: 100,
      x: 130,
      y: 80,
      toJSON: () => ({}),
    }) as DOMRect
    flexItemA.appendChild(nestedSelected)

    const flexItemB = document.createElement('div')
    flexItemB.getBoundingClientRect = () => ({
      left: 240,
      top: 60,
      width: 120,
      height: 80,
      right: 360,
      bottom: 140,
      x: 240,
      y: 60,
      toJSON: () => ({}),
    }) as DOMRect

    flexParent.appendChild(flexItemA)
    flexParent.appendChild(flexItemB)

    const { container } = render(
      <SelectionOverlay
        selectedElement={nestedSelected}
        isDragging={false}
        onMoveStart={onMoveStart}
        showMoveHandle={true}
      />
    )

    const moveHandles = container.querySelectorAll('[data-direct-edit="move-handle"]')
    expect(moveHandles.length).toBe(2)

    const firstItemHandle = moveHandles[0] as HTMLElement
    act(() => {
      firstItemHandle.dispatchEvent(new PointerEvent('pointerdown', {
        clientX: 140,
        clientY: 90,
        bubbles: true,
      }))
    })

    expect(onMoveStart).toHaveBeenCalledTimes(1)
    expect(onMoveStart.mock.calls[0]?.[1]).toBe(flexItemA)
    expect(onMoveStart.mock.calls[0]?.[2]).toEqual({ constrainToOriginalParent: true, mode: 'reorder' })

    onMoveStart.mockClear()
    const secondItemHandle = moveHandles[1] as HTMLElement
    act(() => {
      secondItemHandle.dispatchEvent(new PointerEvent('pointerdown', {
        clientX: 280,
        clientY: 90,
        bubbles: true,
      }))
    })

    expect(onMoveStart).toHaveBeenCalledTimes(1)
    expect(onMoveStart.mock.calls[0]?.[1]).toBe(flexItemB)
    expect(onMoveStart.mock.calls[0]?.[2]).toEqual({ constrainToOriginalParent: true, mode: 'reorder' })
  })

  it('renders sibling move handles when selected flex item has one child', () => {
    const onMoveStart = vi.fn()
    const flexParent = document.createElement('div')
    flexParent.style.display = 'flex'
    document.body.appendChild(flexParent)

    selectedElement.style.display = 'flex'
    selectedElement.getBoundingClientRect = () => ({
      left: 120,
      top: 70,
      width: 120,
      height: 80,
      right: 240,
      bottom: 150,
      x: 120,
      y: 70,
      toJSON: () => ({}),
    }) as DOMRect

    const onlyChild = document.createElement('div')
    onlyChild.getBoundingClientRect = () => ({
      left: 135,
      top: 85,
      width: 50,
      height: 30,
      right: 185,
      bottom: 115,
      x: 135,
      y: 85,
      toJSON: () => ({}),
    }) as DOMRect
    selectedElement.appendChild(onlyChild)

    const sibling = document.createElement('div')
    sibling.getBoundingClientRect = () => ({
      left: 260,
      top: 70,
      width: 120,
      height: 80,
      right: 380,
      bottom: 150,
      x: 260,
      y: 70,
      toJSON: () => ({}),
    }) as DOMRect

    flexParent.appendChild(selectedElement)
    flexParent.appendChild(sibling)

    const { container } = render(
      <SelectionOverlay
        selectedElement={selectedElement}
        isDragging={false}
        onMoveStart={onMoveStart}
        showMoveHandle={true}
      />
    )

    const moveHandles = container.querySelectorAll('[data-direct-edit="move-handle"]')
    expect(moveHandles.length).toBe(2)

    const selectedHandle = moveHandles[0] as HTMLElement
    act(() => {
      selectedHandle.dispatchEvent(new PointerEvent('pointerdown', {
        clientX: 140,
        clientY: 95,
        bubbles: true,
      }))
    })

    expect(onMoveStart).toHaveBeenCalledTimes(1)
    expect(onMoveStart.mock.calls[0]?.[1]).toBe(selectedElement)
    expect(onMoveStart.mock.calls[0]?.[2]).toEqual({ constrainToOriginalParent: true, mode: 'reorder' })

    onMoveStart.mockClear()
    const siblingHandle = moveHandles[1] as HTMLElement
    act(() => {
      siblingHandle.dispatchEvent(new PointerEvent('pointerdown', {
        clientX: 300,
        clientY: 95,
        bubbles: true,
      }))
    })

    expect(onMoveStart).toHaveBeenCalledTimes(1)
    expect(onMoveStart.mock.calls[0]?.[1]).toBe(sibling)
    expect(onMoveStart.mock.calls[0]?.[2]).toEqual({ constrainToOriginalParent: true, mode: 'reorder' })
  })

  it('prefers parent flex siblings over selected flex children', () => {
    const onMoveStart = vi.fn()
    const flexParent = document.createElement('div')
    flexParent.style.display = 'flex'
    document.body.appendChild(flexParent)

    selectedElement.style.display = 'flex'
    selectedElement.getBoundingClientRect = () => ({
      left: 120,
      top: 70,
      width: 120,
      height: 80,
      right: 240,
      bottom: 150,
      x: 120,
      y: 70,
      toJSON: () => ({}),
    }) as DOMRect

    const selectedChildA = document.createElement('div')
    selectedChildA.getBoundingClientRect = () => ({
      left: 125,
      top: 75,
      width: 40,
      height: 70,
      right: 165,
      bottom: 145,
      x: 125,
      y: 75,
      toJSON: () => ({}),
    }) as DOMRect
    const selectedChildB = document.createElement('div')
    selectedChildB.getBoundingClientRect = () => ({
      left: 175,
      top: 75,
      width: 40,
      height: 70,
      right: 215,
      bottom: 145,
      x: 175,
      y: 75,
      toJSON: () => ({}),
    }) as DOMRect
    selectedElement.appendChild(selectedChildA)
    selectedElement.appendChild(selectedChildB)

    const sibling = document.createElement('div')
    sibling.getBoundingClientRect = () => ({
      left: 260,
      top: 70,
      width: 120,
      height: 80,
      right: 380,
      bottom: 150,
      x: 260,
      y: 70,
      toJSON: () => ({}),
    }) as DOMRect

    flexParent.appendChild(selectedElement)
    flexParent.appendChild(sibling)

    const { container } = render(
      <SelectionOverlay
        selectedElement={selectedElement}
        isDragging={false}
        onMoveStart={onMoveStart}
        showMoveHandle={true}
      />
    )

    const moveHandles = container.querySelectorAll('[data-direct-edit="move-handle"]')
    expect(moveHandles.length).toBe(2)

    const selectedHandle = moveHandles[0] as HTMLElement
    act(() => {
      selectedHandle.dispatchEvent(new PointerEvent('pointerdown', {
        clientX: 180,
        clientY: 110,
        bubbles: true,
      }))
    })

    expect(onMoveStart).toHaveBeenCalledTimes(1)
    expect(onMoveStart.mock.calls[0]?.[1]).toBe(selectedElement)
    expect(onMoveStart.mock.calls[0]?.[2]).toEqual({ constrainToOriginalParent: true, mode: 'reorder' })

    onMoveStart.mockClear()
    const siblingHandle = moveHandles[1] as HTMLElement
    act(() => {
      siblingHandle.dispatchEvent(new PointerEvent('pointerdown', {
        clientX: 300,
        clientY: 110,
        bubbles: true,
      }))
    })

    expect(onMoveStart).toHaveBeenCalledTimes(1)
    expect(onMoveStart.mock.calls[0]?.[1]).toBe(sibling)
    expect(onMoveStart.mock.calls[0]?.[2]).toEqual({ constrainToOriginalParent: true, mode: 'reorder' })
  })

  it('does not render move handle for non-flex elements', () => {
    const blockParent = document.createElement('div')
    blockParent.style.display = 'block'
    document.body.appendChild(blockParent)

    selectedElement.getBoundingClientRect = () => ({
      left: 100, top: 50, width: 200, height: 100,
      right: 300, bottom: 150, x: 100, y: 50,
      toJSON: () => ({}),
    }) as DOMRect
    blockParent.appendChild(selectedElement)

    const { container } = render(
      <SelectionOverlay
        selectedElement={selectedElement}
        isDragging={false}
        onMoveStart={vi.fn()}
        showMoveHandle={true}
      />
    )

    expect(container.querySelector('[data-direct-edit="move-handle"]')).toBeNull()

    blockParent.remove()
  })

  it('recomputes move handle target when selected element is reparented', () => {
    const onMoveStart = vi.fn()

    const flexParentA = document.createElement('div')
    flexParentA.style.display = 'flex'
    document.body.appendChild(flexParentA)

    const flexItemA = document.createElement('div')
    flexItemA.getBoundingClientRect = () => ({
      left: 100,
      top: 60,
      width: 120,
      height: 80,
      right: 220,
      bottom: 140,
      x: 100,
      y: 60,
      toJSON: () => ({}),
    }) as DOMRect
    const flexSiblingA = document.createElement('div')
    flexSiblingA.getBoundingClientRect = () => ({
      left: 240,
      top: 60,
      width: 120,
      height: 80,
      right: 360,
      bottom: 140,
      x: 240,
      y: 60,
      toJSON: () => ({}),
    }) as DOMRect
    flexParentA.appendChild(flexItemA)
    flexParentA.appendChild(flexSiblingA)
    flexItemA.appendChild(selectedElement)

    const flexParentB = document.createElement('div')
    flexParentB.style.display = 'flex'
    document.body.appendChild(flexParentB)

    const flexItemB = document.createElement('div')
    flexItemB.getBoundingClientRect = () => ({
      left: 380,
      top: 60,
      width: 120,
      height: 80,
      right: 500,
      bottom: 140,
      x: 380,
      y: 60,
      toJSON: () => ({}),
    }) as DOMRect
    const flexSiblingB = document.createElement('div')
    flexSiblingB.getBoundingClientRect = () => ({
      left: 520,
      top: 60,
      width: 120,
      height: 80,
      right: 640,
      bottom: 140,
      x: 520,
      y: 60,
      toJSON: () => ({}),
    }) as DOMRect
    flexParentB.appendChild(flexItemB)
    flexParentB.appendChild(flexSiblingB)

    const { container, rerender } = render(
      <SelectionOverlay
        selectedElement={selectedElement}
        isDragging={false}
        onMoveStart={onMoveStart}
        showMoveHandle={true}
      />
    )

    let moveHandle = container.querySelector('[data-direct-edit="move-handle"]') as HTMLElement
    expect(moveHandle).not.toBeNull()

    act(() => {
      moveHandle.dispatchEvent(new PointerEvent('pointerdown', {
        clientX: 140,
        clientY: 90,
        bubbles: true,
      }))
    })

    expect(onMoveStart).toHaveBeenCalledTimes(1)
    expect(onMoveStart.mock.calls[0]?.[1]).toBe(flexItemA)
    expect(onMoveStart.mock.calls[0]?.[2]).toEqual({ constrainToOriginalParent: true, mode: 'reorder' })

    onMoveStart.mockClear()
    flexItemB.appendChild(selectedElement)

    rerender(
      <SelectionOverlay
        selectedElement={selectedElement}
        isDragging={false}
        onMoveStart={onMoveStart}
        showMoveHandle={true}
      />
    )

    moveHandle = container.querySelector('[data-direct-edit="move-handle"]') as HTMLElement
    expect(moveHandle).not.toBeNull()

    act(() => {
      moveHandle.dispatchEvent(new PointerEvent('pointerdown', {
        clientX: 420,
        clientY: 90,
        bubbles: true,
      }))
    })

    expect(onMoveStart).toHaveBeenCalledTimes(1)
    expect(onMoveStart.mock.calls[0]?.[1]).toBe(flexItemB)
    expect(onMoveStart.mock.calls[0]?.[2]).toEqual({ constrainToOriginalParent: true, mode: 'reorder' })
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

  it('calls onDoubleClick on content double-click (not edge)', () => {
    const onDoubleClick = vi.fn()
    const onResizeSizingChange = vi.fn()
    selectedElement.textContent = 'Editable container text'

    const { container } = render(
      <SelectionOverlay
        selectedElement={selectedElement}
        isDragging={false}
        onMoveStart={vi.fn()}
        onDoubleClick={onDoubleClick}
        enableResizeHandles={true}
        onResizeSizingChange={onResizeSizingChange}
      />
    )

    const handle = container.querySelector('[data-direct-edit="selection-handle"]') as HTMLElement

    act(() => {
      handle.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, clientX: 140, clientY: 77 }))
    })

    expect(onDoubleClick).toHaveBeenCalledWith(140, 77)
    expect(onResizeSizingChange).not.toHaveBeenCalled()
  })

  it('renders purple selection border when isComponentPrimitive is true', () => {
    const { container } = render(
      <SelectionOverlay
        selectedElement={selectedElement}
        isDragging={false}
        onMoveStart={vi.fn()}
        isComponentPrimitive={true}
      />
    )

    const overlay = container.querySelector('[data-direct-edit="selection-overlay"]') as HTMLElement
    expect(overlay).not.toBeNull()
    // jsdom converts hex to rgb
    expect(overlay.style.border).toContain('rgb(139, 92, 246)')
  })

  it('renders blue selection border when isComponentPrimitive is false', () => {
    const { container } = render(
      <SelectionOverlay
        selectedElement={selectedElement}
        isDragging={false}
        onMoveStart={vi.fn()}
        isComponentPrimitive={false}
      />
    )

    const overlay = container.querySelector('[data-direct-edit="selection-overlay"]') as HTMLElement
    expect(overlay).not.toBeNull()
    expect(overlay.style.border).toContain('rgb(13, 153, 255)')
  })

  it('renders purple dimension label background when isComponentPrimitive is true', () => {
    const { container } = render(
      <SelectionOverlay
        selectedElement={selectedElement}
        isDragging={false}
        onMoveStart={vi.fn()}
        isComponentPrimitive={true}
      />
    )

    const label = container.querySelector('[data-direct-edit="dimension-label"]') as HTMLElement
    expect(label).not.toBeNull()
    // The dimension text and badge are inside the label flex container
    // Check that the label's innerHTML contains purple color
    expect(label.innerHTML).toContain('rgb(139, 92, 246)')
  })

  it('renders purple resize corner handles when isComponentPrimitive is true', () => {
    // Mock getComputedStyle to return a valid display value for resize handles
    const origGCS = window.getComputedStyle
    vi.spyOn(window, 'getComputedStyle').mockImplementation((el) => {
      const result = origGCS(el)
      return result
    })

    const { container } = render(
      <SelectionOverlay
        selectedElement={selectedElement}
        isDragging={false}
        onMoveStart={vi.fn()}
        isComponentPrimitive={true}
        enableResizeHandles={true}
      />
    )

    const handles = container.querySelectorAll('button[data-resize-handle]')
    const cornerHandles = Array.from(handles).filter(h => {
      const style = (h as HTMLElement).style
      // Corner handles have width and height set explicitly
      return style.width === '8px' && style.height === '8px'
    })
    expect(cornerHandles.length).toBeGreaterThan(0)
    for (const handle of cornerHandles) {
      // jsdom converts hex to rgb
      expect((handle as HTMLElement).style.border).toContain('rgb(139, 92, 246)')
    }

    vi.restoreAllMocks()
  })
})
