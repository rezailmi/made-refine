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

function dispatchPointer(type: 'pointermove' | 'pointerup', x = 0, y = 0) {
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
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    })

    expect(result.current.dragState.isDragging).toBe(false)
    expect(dragged.style.opacity).toBe('')
    expect(onMoveComplete).not.toHaveBeenCalled()
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

    expect(result.current.dropTarget?.container).toBe(newContainer)
    expect(result.current.dropTarget?.insertBefore).toBe(insertionPoint)
    expect(result.current.dropTarget?.flexDirection).toBe('column')
    expect(result.current.dropIndicator).toEqual({ x: 0, y: 0, width: 100, height: 2 })

    act(() => {
      dispatchPointer('pointerup', 50, 60)
    })

    expect(result.current.dragState.isDragging).toBe(false)
    expect(dragged.parentElement).toBe(newContainer)
    expect(newContainer.firstElementChild).toBe(dragged)
    expect(onMoveComplete).toHaveBeenCalledTimes(1)
    expect(onMoveComplete.mock.calls[0][0]).toBe(dragged)
    expect(onMoveComplete.mock.calls[0][1]).toMatchObject({
      originalParent,
      originalNextSibling: originalSibling,
      mode: 'free',
    })
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

    dragged.getBoundingClientRect = () => ({
      left: 50, top: 50, width: 100, height: 40,
      right: 150, bottom: 90, x: 50, y: 50,
      toJSON: () => ({}),
    }) as DOMRect

    findLayoutContainerAtPointMock.mockReturnValue(null)

    act(() => {
      result.current.startDrag(pointerEvent(70, 60), dragged, { mode: 'position' })
    })

    act(() => {
      dispatchPointer('pointermove', 120, 110)
    })

    expect(findLayoutContainerAtPointMock).toHaveBeenCalled()
    expect(findContainerAtPointMock).not.toHaveBeenCalled()
    expect(result.current.dropTarget).toBeNull()

    act(() => {
      dispatchPointer('pointerup', 120, 110)
    })

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
})
