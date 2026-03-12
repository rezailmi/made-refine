import type * as React from 'react'
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useMove } from './use-move'

const {
  findContainerAtPointMock,
  findLayoutContainerAtPointMock,
  calculateDropPositionMock,
  detectChildrenDirectionMock,
} = vi.hoisted(() => ({
  findContainerAtPointMock: vi.fn(),
  findLayoutContainerAtPointMock: vi.fn(),
  calculateDropPositionMock: vi.fn(),
  detectChildrenDirectionMock: vi.fn(() => ({ axis: 'vertical', reversed: false })),
}))

vi.mock('./utils', () => ({
  findContainerAtPoint: findContainerAtPointMock,
  findLayoutContainerAtPoint: findLayoutContainerAtPointMock,
  calculateDropPosition: calculateDropPositionMock,
  detectChildrenDirection: detectChildrenDirectionMock,
}))

function pointerEvent(x: number, y: number): React.PointerEvent {
  return { clientX: x, clientY: y } as React.PointerEvent
}

function dispatchPointer(type: 'pointermove' | 'pointerup' | 'pointercancel', x = 0, y = 0) {
  const event = new Event(type) as PointerEvent
  Object.defineProperty(event, 'clientX', { value: x })
  Object.defineProperty(event, 'clientY', { value: y })
  window.dispatchEvent(event)
}

describe('useMove', () => {
  beforeEach(() => {
    findContainerAtPointMock.mockReset()
    findLayoutContainerAtPointMock.mockReset()
    calculateDropPositionMock.mockReset()
    detectChildrenDirectionMock.mockReset()
    detectChildrenDirectionMock.mockReturnValue({ axis: 'vertical', reversed: false })
  })

  afterEach(() => {
    document.body.innerHTML = ''
    document.documentElement.style.userSelect = ''
    document.body.style.userSelect = ''
    document.body.style.cursor = ''
  })

  it('starts dragging and cancels with Escape', () => {
    const onMoveComplete = vi.fn()
    const parent = document.createElement('div')
    const dragged = document.createElement('div')
    parent.appendChild(dragged)
    document.body.appendChild(parent)

    dragged.getBoundingClientRect = () => ({
      left: 10,
      top: 20,
      width: 100,
      height: 40,
      right: 110,
      bottom: 60,
      x: 10,
      y: 20,
      toJSON: () => ({}),
    }) as DOMRect

    const { result } = renderHook(() => useMove({ onMoveComplete }))

    act(() => {
      result.current.startDrag(pointerEvent(30, 40), dragged)
    })

    expect(result.current.dragState.isDragging).toBe(true)
    expect(dragged.style.opacity).toBe('0.5')

    act(() => {
      dispatchPointer('pointermove', 60, 70)
    })

    // Element should visually follow the cursor via CSS transform
    // dragOffset = { x: 30-10, y: 40-20 } = { x: 20, y: 20 }
    // ghostPosition = { x: 60-20, y: 70-20 } = { x: 40, y: 50 }
    // dx = 40 - 10 = 30, dy = 50 - 20 = 30
    expect(dragged.style.transform).toBe('translate(30px, 30px)')

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    })

    expect(result.current.dragState.isDragging).toBe(false)
    expect(dragged.style.opacity).toBe('')
    expect(dragged.style.transform).toBe('')
    expect(onMoveComplete).not.toHaveBeenCalled()
  })

  it('suppresses selectstart and restores document styles when dragging completes', () => {
    const parent = document.createElement('div')
    const dragged = document.createElement('div')
    parent.appendChild(dragged)
    document.body.appendChild(parent)
    document.documentElement.style.userSelect = 'text'
    document.body.style.userSelect = 'text'
    document.body.style.cursor = 'crosshair'

    dragged.getBoundingClientRect = () => ({
      left: 10,
      top: 20,
      width: 100,
      height: 40,
      right: 110,
      bottom: 60,
      x: 10,
      y: 20,
      toJSON: () => ({}),
    }) as DOMRect

    const { result } = renderHook(() => useMove({ onMoveComplete: vi.fn() }))

    act(() => {
      result.current.startDrag(pointerEvent(30, 40), dragged)
    })

    const activeSelectStart = new Event('selectstart', { bubbles: true, cancelable: true })
    document.dispatchEvent(activeSelectStart)

    expect(activeSelectStart.defaultPrevented).toBe(true)
    expect(document.documentElement.style.userSelect).toBe('none')
    expect(document.body.style.userSelect).toBe('none')
    expect(document.body.style.cursor).toBe('crosshair')

    act(() => {
      dispatchPointer('pointerup', 30, 40)
    })

    const releasedSelectStart = new Event('selectstart', { bubbles: true, cancelable: true })
    document.dispatchEvent(releasedSelectStart)

    expect(releasedSelectStart.defaultPrevented).toBe(false)
    expect(document.documentElement.style.userSelect).toBe('text')
    expect(document.body.style.userSelect).toBe('text')
    expect(document.body.style.cursor).toBe('crosshair')
  })

  it('cancels drag and restores styles on pointercancel', () => {
    const parent = document.createElement('div')
    const dragged = document.createElement('div')
    parent.appendChild(dragged)
    document.body.appendChild(parent)

    dragged.getBoundingClientRect = () => ({
      left: 10,
      top: 20,
      width: 100,
      height: 40,
      right: 110,
      bottom: 60,
      x: 10,
      y: 20,
      toJSON: () => ({}),
    }) as DOMRect

    const { result } = renderHook(() => useMove({ onMoveComplete: vi.fn() }))

    act(() => {
      result.current.startDrag(pointerEvent(30, 40), dragged)
    })

    expect(result.current.dragState.isDragging).toBe(true)
    expect(document.body.style.cursor).toBe('')

    act(() => {
      dispatchPointer('pointercancel', 30, 40)
    })

    expect(result.current.dragState.isDragging).toBe(false)
    expect(dragged.style.opacity).toBe('')
    expect(dragged.style.transform).toBe('')
    expect(document.body.style.cursor).toBe('')
    expect(document.documentElement.style.userSelect).toBe('')
    expect(document.body.style.userSelect).toBe('')
  })

  it('cancels drag and restores styles on window blur', () => {
    const parent = document.createElement('div')
    const dragged = document.createElement('div')
    parent.appendChild(dragged)
    document.body.appendChild(parent)

    dragged.getBoundingClientRect = () => ({
      left: 10,
      top: 20,
      width: 100,
      height: 40,
      right: 110,
      bottom: 60,
      x: 10,
      y: 20,
      toJSON: () => ({}),
    }) as DOMRect

    const { result } = renderHook(() => useMove({ onMoveComplete: vi.fn() }))

    act(() => {
      result.current.startDrag(pointerEvent(30, 40), dragged)
    })

    expect(result.current.dragState.isDragging).toBe(true)

    act(() => {
      window.dispatchEvent(new Event('blur'))
    })

    expect(result.current.dragState.isDragging).toBe(false)
    expect(document.body.style.cursor).toBe('')
    expect(document.documentElement.style.userSelect).toBe('')
    expect(document.body.style.userSelect).toBe('')
  })

  it('moves element to drop target and reports move info on pointer up', () => {
    const onMoveComplete = vi.fn()
    const originalParent = document.createElement('div')
    const dragged = document.createElement('div')
    const originalSibling = document.createElement('div')
    originalParent.appendChild(dragged)
    originalParent.appendChild(originalSibling)

    const newContainer = document.createElement('div')
    const insertionPoint = document.createElement('span')
    newContainer.appendChild(insertionPoint)

    document.body.appendChild(originalParent)
    document.body.appendChild(newContainer)

    dragged.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      width: 80,
      height: 20,
      right: 80,
      bottom: 20,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }) as DOMRect

    findContainerAtPointMock.mockReturnValue(newContainer)
    calculateDropPositionMock.mockReturnValue({
      insertBefore: insertionPoint,
      indicator: { x: 0, y: 0, width: 100, height: 2 },
    })

    const { result } = renderHook(() => useMove({ onMoveComplete }))

    act(() => {
      result.current.startDrag(pointerEvent(10, 10), dragged)
    })

    act(() => {
      dispatchPointer('pointermove', 50, 60)
    })

    // dragOffset = { x: 10, y: 10 }, ghostPosition = { x: 40, y: 50 }
    // dx = 40 - 0 = 40, dy = 50 - 0 = 50
    expect(dragged.style.transform).toBe('translate(40px, 50px)')

    expect(result.current.dropTarget?.container).toBe(newContainer)
    expect(result.current.dropTarget?.insertBefore).toBe(insertionPoint)
    expect(result.current.dropTarget?.flexDirection).toBe('column')
    expect(result.current.dropIndicator).toEqual({ x: 0, y: 0, width: 100, height: 2 })

    act(() => {
      dispatchPointer('pointerup', 50, 60)
    })

    expect(result.current.dragState.isDragging).toBe(false)
    expect(dragged.style.transform).toBe('')
    expect(dragged.parentElement).toBe(newContainer)
    expect(newContainer.firstElementChild).toBe(dragged)
    expect(onMoveComplete).toHaveBeenCalledTimes(1)
    expect(onMoveComplete.mock.calls[0][0]).toBe(dragged)
    expect(onMoveComplete.mock.calls[0][1]).toMatchObject({
      originalParent,
      originalNextSibling: originalSibling,
      mode: 'free',
    })
    // visualDelta: ghostPosition { x: 40, y: 50 } - initialPos { x: 0, y: 0 }
    expect(onMoveComplete.mock.calls[0][1].visualDelta).toEqual({ x: 40, y: 50 })
  })

  it('keeps handle-initiated drag target inside the original parent', () => {
    const onMoveComplete = vi.fn()
    const originalParent = document.createElement('div')
    const dragged = document.createElement('div')
    const siblingA = document.createElement('div')
    const siblingB = document.createElement('div')
    originalParent.appendChild(dragged)
    originalParent.appendChild(siblingA)
    originalParent.appendChild(siblingB)

    const otherContainer = document.createElement('div')
    document.body.appendChild(originalParent)
    document.body.appendChild(otherContainer)

    dragged.getBoundingClientRect = () => ({
      left: 20,
      top: 20,
      width: 80,
      height: 30,
      right: 100,
      bottom: 50,
      x: 20,
      y: 20,
      toJSON: () => ({}),
    }) as DOMRect

    findContainerAtPointMock.mockReturnValue(otherContainer)
    calculateDropPositionMock.mockReturnValue({
      insertBefore: siblingB,
      indicator: { x: 0, y: 0, width: 2, height: 100 },
    })

    const { result } = renderHook(() => useMove({ onMoveComplete }))

    act(() => {
      result.current.startDrag(pointerEvent(30, 30), dragged, { constrainToOriginalParent: true })
    })

    act(() => {
      dispatchPointer('pointermove', 60, 65)
    })

    expect(findContainerAtPointMock).not.toHaveBeenCalled()
    expect(calculateDropPositionMock).toHaveBeenCalledWith(originalParent, 60, 65, dragged)
    expect(result.current.dropTarget?.container).toBe(originalParent)
    expect(result.current.dropTarget?.insertBefore).toBe(siblingB)

    act(() => {
      dispatchPointer('pointerup', 60, 65)
    })

    expect(Array.from(originalParent.children)).toEqual([siblingA, dragged, siblingB])
    expect(dragged.parentElement).toBe(originalParent)
    expect(onMoveComplete).toHaveBeenCalledTimes(1)
    expect(onMoveComplete.mock.calls[0]?.[1]).toMatchObject({
      originalParent,
      mode: 'reorder',
    })
  })

  it('position mode uses layout container detection and falls back to delta', () => {
    const onMoveComplete = vi.fn()
    const { result } = renderHook(() => useMove({ onMoveComplete }))

    const parent = document.createElement('div')
    const dragged = document.createElement('div')
    parent.appendChild(dragged)
    document.body.appendChild(parent)

    // Transform-aware mock: returns shifted position when style.transform is set,
    // ensuring the test fails if transform isn't restored before getBoundingClientRect.
    dragged.getBoundingClientRect = () => ({
      left: dragged.style.transform ? 100 : 50,
      top: dragged.style.transform ? 100 : 50,
      width: 100, height: 40,
      right: 150, bottom: 90, x: 50, y: 50,
      toJSON: () => ({}),
    }) as DOMRect

    // Parent rect encloses the pointer — no detach triggered
    parent.getBoundingClientRect = () => ({
      left: 0, top: 0, width: 300, height: 300,
      right: 300, bottom: 300, x: 0, y: 0,
      toJSON: () => ({}),
    }) as DOMRect

    findLayoutContainerAtPointMock.mockReturnValue(null)

    act(() => {
      result.current.startDrag(pointerEvent(70, 60), dragged, { mode: 'position' })
    })

    act(() => {
      dispatchPointer('pointermove', 120, 110)
    })

    // dragOffset = { x: 20, y: 10 }, ghostPosition = { x: 100, y: 100 }
    // dx = 100 - 50 = 50, dy = 100 - 50 = 50
    expect(dragged.style.transform).toBe('translate(50px, 50px)')
    expect(findLayoutContainerAtPointMock).toHaveBeenCalled()
    expect(findContainerAtPointMock).not.toHaveBeenCalled()
    expect(result.current.dropTarget).toBeNull()

    act(() => {
      dispatchPointer('pointerup', 120, 110)
    })

    expect(dragged.style.transform).toBe('')
    expect(dragged.parentElement).toBe(parent)
    expect(onMoveComplete).toHaveBeenCalledTimes(1)
    expect(onMoveComplete.mock.calls[0]?.[1]).toMatchObject({
      mode: 'position',
      positionDelta: { x: 50, y: 50 },
    })
  })

  it('position mode drops into flex container with DOM reparenting', () => {
    const onMoveComplete = vi.fn()
    const { result } = renderHook(() => useMove({ onMoveComplete }))

    const originalParent = document.createElement('div')
    const dragged = document.createElement('div')
    const originalSibling = document.createElement('div')
    originalParent.appendChild(dragged)
    originalParent.appendChild(originalSibling)

    const flexContainer = document.createElement('div')
    const insertionPoint = document.createElement('span')
    flexContainer.appendChild(insertionPoint)

    document.body.appendChild(originalParent)
    document.body.appendChild(flexContainer)

    dragged.getBoundingClientRect = () => ({
      left: 50, top: 50, width: 100, height: 40,
      right: 150, bottom: 90, x: 50, y: 50,
      toJSON: () => ({}),
    }) as DOMRect

    originalParent.getBoundingClientRect = () => ({
      left: 0, top: 0, width: 300, height: 300,
      right: 300, bottom: 300, x: 0, y: 0,
      toJSON: () => ({}),
    }) as DOMRect

    findLayoutContainerAtPointMock.mockReturnValue(flexContainer)
    calculateDropPositionMock.mockReturnValue({
      insertBefore: insertionPoint,
      indicator: { x: 10, y: 20, width: 100, height: 2 },
    })

    act(() => {
      result.current.startDrag(pointerEvent(70, 60), dragged, { mode: 'position' })
    })

    act(() => {
      dispatchPointer('pointermove', 200, 200)
    })

    expect(result.current.dropTarget?.container).toBe(flexContainer)
    expect(result.current.dropTarget?.insertBefore).toBe(insertionPoint)
    expect(result.current.dropIndicator).toEqual({ x: 10, y: 20, width: 100, height: 2 })

    act(() => {
      dispatchPointer('pointerup', 200, 200)
    })

    expect(dragged.parentElement).toBe(flexContainer)
    expect(flexContainer.firstElementChild).toBe(dragged)
    expect(onMoveComplete).toHaveBeenCalledTimes(1)
    expect(onMoveComplete.mock.calls[0]?.[1]).toMatchObject({
      originalParent,
      originalNextSibling: originalSibling,
      mode: 'free',
      resetPositionOffsets: true,
    })
    // visualDelta: ghostPosition { x: 180, y: 190 } - initialPos { x: 50, y: 50 }
    expect(onMoveComplete.mock.calls[0]?.[1].visualDelta).toEqual({ x: 130, y: 140 })
  })

  it('position mode detaches element when dragged outside parent bounds', () => {
    const onMoveComplete = vi.fn()
    const { result } = renderHook(() => useMove({ onMoveComplete }))

    const grandparent = document.createElement('div')
    const parent = document.createElement('div')
    const dragged = document.createElement('div')
    parent.appendChild(dragged)
    grandparent.appendChild(parent)
    document.body.appendChild(grandparent)

    dragged.getBoundingClientRect = () => ({
      left: 50, top: 50, width: 100, height: 40,
      right: 150, bottom: 90, x: 50, y: 50,
      toJSON: () => ({}),
    }) as DOMRect

    parent.getBoundingClientRect = () => ({
      left: 40, top: 40, width: 120, height: 60,
      right: 160, bottom: 100, x: 40, y: 40,
      toJSON: () => ({}),
    }) as DOMRect

    findLayoutContainerAtPointMock.mockReturnValue(null)
    findContainerAtPointMock.mockReturnValue(grandparent)
    calculateDropPositionMock.mockReturnValue({
      insertBefore: null,
      indicator: { x: 0, y: 0, width: 200, height: 2 },
    })

    act(() => {
      result.current.startDrag(pointerEvent(70, 60), dragged, { mode: 'position' })
    })

    // Move pointer outside parent bounds (200, 200 is outside parent rect 40,40 → 160,100)
    act(() => {
      dispatchPointer('pointermove', 200, 200)
    })

    expect(result.current.dropTarget?.container).toBe(grandparent)
    expect(result.current.dropIndicator).toEqual({ x: 0, y: 0, width: 200, height: 2 })

    act(() => {
      dispatchPointer('pointerup', 200, 200)
    })

    expect(dragged.parentElement).toBe(grandparent)
    expect(onMoveComplete).toHaveBeenCalledTimes(1)
    expect(onMoveComplete.mock.calls[0]?.[1]).toMatchObject({
      originalParent: parent,
      mode: 'free',
      resetPositionOffsets: true,
    })
  })

  it('position mode stays in parent when pointer is inside parent bounds', () => {
    const onMoveComplete = vi.fn()
    const { result } = renderHook(() => useMove({ onMoveComplete }))

    const grandparent = document.createElement('div')
    const parent = document.createElement('div')
    const dragged = document.createElement('div')
    parent.appendChild(dragged)
    grandparent.appendChild(parent)
    document.body.appendChild(grandparent)

    dragged.getBoundingClientRect = () => ({
      left: dragged.style.transform ? 80 : 50,
      top: dragged.style.transform ? 70 : 50,
      width: 100, height: 40,
      right: 150, bottom: 90, x: 50, y: 50,
      toJSON: () => ({}),
    }) as DOMRect

    parent.getBoundingClientRect = () => ({
      left: 0, top: 0, width: 300, height: 300,
      right: 300, bottom: 300, x: 0, y: 0,
      toJSON: () => ({}),
    }) as DOMRect

    findLayoutContainerAtPointMock.mockReturnValue(null)

    act(() => {
      result.current.startDrag(pointerEvent(70, 60), dragged, { mode: 'position' })
    })

    // Move pointer to (100, 90) — still inside parent bounds (0,0 → 300,300)
    act(() => {
      dispatchPointer('pointermove', 100, 90)
    })

    // No drop target since pointer is inside parent
    expect(result.current.dropTarget).toBeNull()
    expect(findContainerAtPointMock).not.toHaveBeenCalled()

    act(() => {
      dispatchPointer('pointerup', 100, 90)
    })

    // Element stays in parent, falls back to CSS position delta
    expect(dragged.parentElement).toBe(parent)
    expect(onMoveComplete).toHaveBeenCalledTimes(1)
    expect(onMoveComplete.mock.calls[0]?.[1]).toMatchObject({
      mode: 'position',
      positionDelta: expect.any(Object),
    })
  })

  it('preserves original transform on cancel', () => {
    const onMoveComplete = vi.fn()
    const parent = document.createElement('div')
    const dragged = document.createElement('div')
    parent.appendChild(dragged)
    document.body.appendChild(parent)

    dragged.style.transform = 'rotate(45deg)'
    dragged.getBoundingClientRect = () => ({
      left: 10, top: 20, width: 100, height: 40,
      right: 110, bottom: 60, x: 10, y: 20,
      toJSON: () => ({}),
    }) as DOMRect

    const { result } = renderHook(() => useMove({ onMoveComplete }))

    act(() => {
      result.current.startDrag(pointerEvent(30, 40), dragged)
    })

    act(() => {
      dispatchPointer('pointermove', 60, 70)
    })

    expect(dragged.style.transform).toContain('translate')

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    })

    expect(dragged.style.transform).toBe('rotate(45deg)')
  })

  it('preserves original transform on drop', () => {
    const onMoveComplete = vi.fn()
    const originalParent = document.createElement('div')
    const dragged = document.createElement('div')
    originalParent.appendChild(dragged)

    const newContainer = document.createElement('div')
    const insertionPoint = document.createElement('span')
    newContainer.appendChild(insertionPoint)

    document.body.appendChild(originalParent)
    document.body.appendChild(newContainer)

    dragged.style.transform = 'scale(1.2)'
    dragged.getBoundingClientRect = () => ({
      left: 0, top: 0, width: 80, height: 20,
      right: 80, bottom: 20, x: 0, y: 0,
      toJSON: () => ({}),
    }) as DOMRect

    findContainerAtPointMock.mockReturnValue(newContainer)
    calculateDropPositionMock.mockReturnValue({
      insertBefore: insertionPoint,
      indicator: { x: 0, y: 0, width: 100, height: 2 },
    })

    const { result } = renderHook(() => useMove({ onMoveComplete }))

    act(() => {
      result.current.startDrag(pointerEvent(10, 10), dragged)
    })

    act(() => {
      dispatchPointer('pointermove', 50, 60)
    })

    expect(dragged.style.transform).toContain('translate')

    act(() => {
      dispatchPointer('pointerup', 50, 60)
    })

    expect(dragged.style.transform).toBe('scale(1.2)')
  })

  it('scales translate delta by parent CSS scale (canvas mode)', () => {
    const onMoveComplete = vi.fn()
    const parent = document.createElement('div')
    const dragged = document.createElement('div')
    parent.appendChild(dragged)
    document.body.appendChild(parent)

    // rect.width = 100, offsetWidth = 50 → scaleX = 2
    // rect.height = 40, offsetHeight = 20 → scaleY = 2
    dragged.getBoundingClientRect = () => ({
      left: 0, top: 0, width: 100, height: 40,
      right: 100, bottom: 40, x: 0, y: 0,
      toJSON: () => ({}),
    }) as DOMRect
    Object.defineProperty(dragged, 'offsetWidth', { value: 50, configurable: true })
    Object.defineProperty(dragged, 'offsetHeight', { value: 20, configurable: true })

    const { result } = renderHook(() => useMove({ onMoveComplete }))

    act(() => {
      result.current.startDrag(pointerEvent(0, 0), dragged)
    })

    act(() => {
      dispatchPointer('pointermove', 100, 40)
    })

    // scaleX = 100/50 = 2, scaleY = 40/20 = 2
    // dx = (100 - 0 - 0) / 2 = 50, dy = (40 - 0 - 0) / 2 = 20
    expect(dragged.style.transform).toBe('translate(50px, 20px)')
  })

  it('position mode scales delta by canvas zoom', () => {
    const onMoveComplete = vi.fn()
    const { result } = renderHook(() => useMove({ onMoveComplete }))

    const parent = document.createElement('div')
    const dragged = document.createElement('div')
    parent.appendChild(dragged)
    document.body.appendChild(parent)

    // rect.width = 100, offsetWidth = 50 → scaleX = 2
    // rect.height = 40, offsetHeight = 20 → scaleY = 2
    dragged.getBoundingClientRect = () => ({
      left: dragged.style.transform ? 100 : 0,
      top: dragged.style.transform ? 40 : 0,
      width: 100, height: 40,
      right: 100, bottom: 40, x: 0, y: 0,
      toJSON: () => ({}),
    }) as DOMRect
    Object.defineProperty(dragged, 'offsetWidth', { value: 50, configurable: true })
    Object.defineProperty(dragged, 'offsetHeight', { value: 20, configurable: true })

    findLayoutContainerAtPointMock.mockReturnValue(null)

    act(() => {
      result.current.startDrag(pointerEvent(0, 0), dragged, { mode: 'position' })
    })

    act(() => {
      dispatchPointer('pointermove', 100, 40)
    })

    // ghostPosition = { x: 100, y: 40 }
    act(() => {
      dispatchPointer('pointerup', 100, 40)
    })

    // After transform is restored, rect returns { left: 0, top: 0 }
    // viewport delta = { x: 100, y: 40 }
    // CSS delta = { x: 50, y: 20 }  ← divided by scaleX=2, scaleY=2
    expect(onMoveComplete).toHaveBeenCalledTimes(1)
    expect(onMoveComplete.mock.calls[0]?.[1]).toMatchObject({
      mode: 'position',
      positionDelta: { x: 50, y: 20 },
    })
  })

  it('position mode clears indicator when leaving flex and falls back to CSS position', () => {
    const onMoveComplete = vi.fn()
    const { result } = renderHook(() => useMove({ onMoveComplete }))

    const parent = document.createElement('div')
    const dragged = document.createElement('div')
    parent.appendChild(dragged)
    document.body.appendChild(parent)

    const flexContainer = document.createElement('div')
    document.body.appendChild(flexContainer)

    dragged.getBoundingClientRect = () => ({
      left: 50, top: 50, width: 100, height: 40,
      right: 150, bottom: 90, x: 50, y: 50,
      toJSON: () => ({}),
    }) as DOMRect

    parent.getBoundingClientRect = () => ({
      left: 0, top: 0, width: 500, height: 500,
      right: 500, bottom: 500, x: 0, y: 0,
      toJSON: () => ({}),
    }) as DOMRect

    findLayoutContainerAtPointMock.mockReturnValue(flexContainer)
    calculateDropPositionMock.mockReturnValue({
      insertBefore: null,
      indicator: { x: 10, y: 20, width: 100, height: 2 },
    })

    act(() => {
      result.current.startDrag(pointerEvent(70, 60), dragged, { mode: 'position' })
    })

    act(() => {
      dispatchPointer('pointermove', 200, 200)
    })

    expect(result.current.dropTarget?.container).toBe(flexContainer)
    expect(result.current.dropIndicator).toBeTruthy()

    // Now move away — no flex container under pointer
    findLayoutContainerAtPointMock.mockReturnValue(null)

    act(() => {
      dispatchPointer('pointermove', 300, 300)
    })

    expect(result.current.dropTarget).toBeNull()
    expect(result.current.dropIndicator).toBeNull()

    act(() => {
      dispatchPointer('pointerup', 300, 300)
    })

    expect(dragged.parentElement).toBe(parent)
    expect(onMoveComplete).toHaveBeenCalledTimes(1)
    expect(onMoveComplete.mock.calls[0]?.[1]).toMatchObject({
      mode: 'position',
      positionDelta: expect.any(Object),
    })
  })

  it('position mode skips detach when parent has zero dimensions', () => {
    const onMoveComplete = vi.fn()
    const { result } = renderHook(() => useMove({ onMoveComplete }))

    const parent = document.createElement('div')
    const dragged = document.createElement('div')
    parent.appendChild(dragged)
    document.body.appendChild(parent)

    dragged.getBoundingClientRect = () => ({
      left: dragged.style.transform ? 200 : 50,
      top: dragged.style.transform ? 200 : 50,
      width: 100, height: 40,
      right: 150, bottom: 90, x: 50, y: 50,
      toJSON: () => ({}),
    }) as DOMRect

    // Collapsed/hidden parent — all zeros
    parent.getBoundingClientRect = () => ({
      left: 0, top: 0, width: 0, height: 0,
      right: 0, bottom: 0, x: 0, y: 0,
      toJSON: () => ({}),
    }) as DOMRect

    findLayoutContainerAtPointMock.mockReturnValue(null)

    act(() => {
      result.current.startDrag(pointerEvent(70, 60), dragged, { mode: 'position' })
    })

    // Pointer at (200, 200) — would be "outside" but hasSize guard prevents detach
    act(() => {
      dispatchPointer('pointermove', 200, 200)
    })

    expect(findContainerAtPointMock).not.toHaveBeenCalled()
    expect(result.current.dropTarget).toBeNull()

    act(() => {
      dispatchPointer('pointerup', 200, 200)
    })

    // Falls back to CSS delta
    expect(dragged.parentElement).toBe(parent)
    expect(onMoveComplete).toHaveBeenCalledTimes(1)
    expect(onMoveComplete.mock.calls[0]?.[1]).toMatchObject({
      mode: 'position',
      positionDelta: expect.any(Object),
    })
  })

  it('position mode does not detach when findContainerAtPoint returns original parent', () => {
    const onMoveComplete = vi.fn()
    const { result } = renderHook(() => useMove({ onMoveComplete }))

    const parent = document.createElement('div')
    const dragged = document.createElement('div')
    parent.appendChild(dragged)
    document.body.appendChild(parent)

    dragged.getBoundingClientRect = () => ({
      left: dragged.style.transform ? 200 : 50,
      top: dragged.style.transform ? 200 : 50,
      width: 100, height: 40,
      right: 150, bottom: 90, x: 50, y: 50,
      toJSON: () => ({}),
    }) as DOMRect

    // Small parent so pointer will be outside
    parent.getBoundingClientRect = () => ({
      left: 40, top: 40, width: 120, height: 60,
      right: 160, bottom: 100, x: 40, y: 40,
      toJSON: () => ({}),
    }) as DOMRect

    findLayoutContainerAtPointMock.mockReturnValue(null)
    // findContainerAtPoint returns the same originalParent — no detach
    findContainerAtPointMock.mockReturnValue(parent)

    act(() => {
      result.current.startDrag(pointerEvent(70, 60), dragged, { mode: 'position' })
    })

    // Pointer outside parent bounds
    act(() => {
      dispatchPointer('pointermove', 200, 200)
    })

    // container should NOT be set because found === originalParent
    expect(result.current.dropTarget).toBeNull()

    act(() => {
      dispatchPointer('pointerup', 200, 200)
    })

    // Falls back to CSS delta
    expect(dragged.parentElement).toBe(parent)
    expect(onMoveComplete).toHaveBeenCalledTimes(1)
    expect(onMoveComplete.mock.calls[0]?.[1]).toMatchObject({
      mode: 'position',
      positionDelta: expect.any(Object),
    })
  })

  it('makes way for reorder inside original container and restores transforms on drop', () => {
    const onMoveComplete = vi.fn()
    const parent = document.createElement('div')
    const siblingA = document.createElement('div')
    const dragged = document.createElement('div')
    const siblingB = document.createElement('div')
    const siblingC = document.createElement('div')
    parent.appendChild(siblingA)
    parent.appendChild(dragged)
    parent.appendChild(siblingB)
    parent.appendChild(siblingC)
    document.body.appendChild(parent)

    siblingB.style.transform = 'rotate(5deg)'
    siblingB.style.transition = 'opacity 80ms linear'

    dragged.getBoundingClientRect = () => ({
      left: 0, top: 0, width: 80, height: 20,
      right: 80, bottom: 20, x: 0, y: 0,
      toJSON: () => ({}),
    }) as DOMRect

    findContainerAtPointMock.mockReturnValue(parent)
    calculateDropPositionMock.mockReturnValue({
      insertBefore: siblingC,
      indicator: { x: 0, y: 0, width: 100, height: 2 },
    })

    const { result } = renderHook(() => useMove({ onMoveComplete }))

    act(() => {
      result.current.startDrag(pointerEvent(10, 10), dragged, { mode: 'reorder' })
    })

    act(() => {
      dispatchPointer('pointermove', 50, 60)
    })

    expect(siblingA.style.transform).toBe('')
    expect(siblingB.style.transform).toBe('rotate(5deg) translateY(-20px)')
    expect(siblingC.style.transform).toBe('')
    expect(siblingB.style.transition).toContain('opacity 80ms linear')
    expect(siblingB.style.transition).toContain('transform 140ms')

    act(() => {
      dispatchPointer('pointerup', 50, 60)
    })

    expect(siblingA.style.transform).toBe('')
    expect(siblingB.style.transform).toBe('rotate(5deg)')
    expect(siblingB.style.transition).toBe('opacity 80ms linear')
    expect(siblingC.style.transform).toBe('')
    expect(onMoveComplete).toHaveBeenCalledTimes(1)
    expect(onMoveComplete.mock.calls[0]?.[1]).toMatchObject({
      originalParent: parent,
      mode: 'reorder',
    })
  })

  it('makes way in target container and clears preview when leaving drop target', () => {
    const onMoveComplete = vi.fn()
    const originalParent = document.createElement('div')
    const dragged = document.createElement('div')
    originalParent.appendChild(dragged)

    const targetContainer = document.createElement('div')
    const targetA = document.createElement('div')
    const targetB = document.createElement('div')
    const targetC = document.createElement('div')
    targetContainer.appendChild(targetA)
    targetContainer.appendChild(targetB)
    targetContainer.appendChild(targetC)

    document.body.appendChild(originalParent)
    document.body.appendChild(targetContainer)

    dragged.getBoundingClientRect = () => ({
      left: 0, top: 0, width: 80, height: 20,
      right: 80, bottom: 20, x: 0, y: 0,
      toJSON: () => ({}),
    }) as DOMRect

    findContainerAtPointMock.mockReturnValue(targetContainer)
    calculateDropPositionMock.mockReturnValue({
      insertBefore: targetB,
      indicator: { x: 0, y: 0, width: 100, height: 2 },
    })

    const { result } = renderHook(() => useMove({ onMoveComplete }))

    act(() => {
      result.current.startDrag(pointerEvent(10, 10), dragged)
    })

    act(() => {
      dispatchPointer('pointermove', 50, 60)
    })

    expect(targetA.style.transform).toBe('')
    expect(targetB.style.transform).toBe('translateY(20px)')
    expect(targetC.style.transform).toBe('translateY(20px)')
    expect(targetB.style.transition).toContain('transform 140ms')
    expect(targetC.style.transition).toContain('transform 140ms')

    findContainerAtPointMock.mockReturnValue(null)

    act(() => {
      dispatchPointer('pointermove', 400, 400)
    })

    expect(result.current.dropTarget).toBeNull()
    expect(targetA.style.transform).toBe('')
    expect(targetB.style.transform).toBe('')
    expect(targetC.style.transform).toBe('')
    expect(targetB.style.transition).toBe('')
    expect(targetC.style.transition).toBe('')

    act(() => {
      dispatchPointer('pointerup', 400, 400)
    })

    expect(onMoveComplete).toHaveBeenCalledTimes(1)
    expect(onMoveComplete.mock.calls[0]?.[1]).toBeNull()
  })
})
