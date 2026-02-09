import type * as React from 'react'
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useMove } from './use-move'

const {
  findContainerAtPointMock,
  calculateDropPositionMock,
  detectChildrenDirectionMock,
} = vi.hoisted(() => ({
  findContainerAtPointMock: vi.fn(),
  calculateDropPositionMock: vi.fn(),
  detectChildrenDirectionMock: vi.fn(() => ({ axis: 'vertical', reversed: false })),
}))

vi.mock('./utils', () => ({
  findContainerAtPoint: findContainerAtPointMock,
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
    })
  })
})
