import * as React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useSelectionResize } from './use-selection-resize'
import type { SizingPropertyKey, SizingValue, SizingChangeOptions } from './types'

function dispatchPointer(type: 'pointermove' | 'pointerup' | 'pointercancel', x: number, y: number) {
  const event = new Event(type) as PointerEvent
  Object.defineProperty(event, 'clientX', { value: x })
  Object.defineProperty(event, 'clientY', { value: y })
  window.dispatchEvent(event)
}

function createPointerEvent(clientX: number, clientY: number): React.PointerEvent<HTMLElement> {
  return {
    button: 0,
    clientX,
    clientY,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  } as unknown as React.PointerEvent<HTMLElement>
}

function createMouseEvent(): React.MouseEvent<HTMLElement> {
  return {
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  } as unknown as React.MouseEvent<HTMLElement>
}

function getLastUpdate(
  calls: Array<[Partial<Record<SizingPropertyKey, SizingValue>>, SizingChangeOptions | undefined]>
) {
  return [...calls].reverse().find(([changes, options]) => (
    options?.phase === 'update' && Object.keys(changes).length > 0
  ))
}

describe('useSelectionResize', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('maps edge drag to width updates', () => {
    const element = document.createElement('div')
    element.getBoundingClientRect = () => ({
      left: 20, top: 20, width: 200, height: 120,
      right: 220, bottom: 140, x: 20, y: 20,
      toJSON: () => ({}),
    }) as DOMRect
    document.body.appendChild(element)

    const onResize = vi.fn<(
      changes: Partial<Record<SizingPropertyKey, SizingValue>>,
      options?: SizingChangeOptions
    ) => void>()

    const { result } = renderHook(() => useSelectionResize({
      selectedElement: element,
      enabled: true,
      onResizeSizingChange: onResize,
    }))

    act(() => {
      result.current.getResizeHandlePointerDown('right')(createPointerEvent(100, 100))
    })
    act(() => {
      dispatchPointer('pointermove', 130, 100)
    })
    act(() => {
      dispatchPointer('pointerup', 130, 100)
    })

    const update = getLastUpdate(onResize.mock.calls)
    expect(update).toBeDefined()
    expect(update?.[0].width?.mode).toBe('fixed')
    expect(update?.[0].width?.value.numericValue).toBe(230)
  })

  it('preserves aspect ratio for corner drags', () => {
    const element = document.createElement('div')
    element.getBoundingClientRect = () => ({
      left: 10, top: 10, width: 200, height: 100,
      right: 210, bottom: 110, x: 10, y: 10,
      toJSON: () => ({}),
    }) as DOMRect
    document.body.appendChild(element)

    const onResize = vi.fn<(
      changes: Partial<Record<SizingPropertyKey, SizingValue>>,
      options?: SizingChangeOptions
    ) => void>()

    const { result } = renderHook(() => useSelectionResize({
      selectedElement: element,
      enabled: true,
      onResizeSizingChange: onResize,
    }))

    act(() => {
      result.current.getResizeHandlePointerDown('bottom-right')(createPointerEvent(200, 200))
    })
    act(() => {
      dispatchPointer('pointermove', 250, 200)
    })
    act(() => {
      dispatchPointer('pointerup', 250, 200)
    })

    const update = getLastUpdate(onResize.mock.calls)
    expect(update).toBeDefined()
    expect(update?.[0].width?.value.numericValue).toBe(250)
    expect(update?.[0].height?.value.numericValue).toBe(125)
  })

  it('clamps drag size to minimum', () => {
    const element = document.createElement('div')
    element.getBoundingClientRect = () => ({
      left: 0, top: 0, width: 50, height: 20,
      right: 50, bottom: 20, x: 0, y: 0,
      toJSON: () => ({}),
    }) as DOMRect
    document.body.appendChild(element)

    const onResize = vi.fn<(
      changes: Partial<Record<SizingPropertyKey, SizingValue>>,
      options?: SizingChangeOptions
    ) => void>()

    const { result } = renderHook(() => useSelectionResize({
      selectedElement: element,
      enabled: true,
      onResizeSizingChange: onResize,
    }))

    act(() => {
      result.current.getResizeHandlePointerDown('right')(createPointerEvent(100, 100))
    })
    act(() => {
      dispatchPointer('pointermove', -500, 100)
    })
    act(() => {
      dispatchPointer('pointerup', -500, 100)
    })

    const update = getLastUpdate(onResize.mock.calls)
    expect(update?.[0].width?.value.numericValue).toBe(1)
  })

  it('snaps width to fill and exits fill outside hysteresis', () => {
    const parent = document.createElement('div')
    Object.defineProperty(parent, 'clientWidth', { configurable: true, value: 300 })
    document.body.appendChild(parent)

    const element = document.createElement('div')
    element.style.boxSizing = 'border-box'
    element.getBoundingClientRect = () => ({
      left: 0, top: 0, width: 100, height: 40,
      right: 100, bottom: 40, x: 0, y: 0,
      toJSON: () => ({}),
    }) as DOMRect
    parent.appendChild(element)

    const onResize = vi.fn<(
      changes: Partial<Record<SizingPropertyKey, SizingValue>>,
      options?: SizingChangeOptions
    ) => void>()

    const { result } = renderHook(() => useSelectionResize({
      selectedElement: element,
      enabled: true,
      onResizeSizingChange: onResize,
    }))

    act(() => {
      result.current.getResizeHandlePointerDown('right')(createPointerEvent(100, 50))
    })
    act(() => {
      // 100 + 199 = 299 -> within SNAP_IN(2) to fill target 300
      dispatchPointer('pointermove', 299, 50)
    })
    act(() => {
      // 100 + 192 = 292 -> diff 8 > SNAP_OUT(6), should leave fill lock
      dispatchPointer('pointermove', 292, 50)
    })
    act(() => {
      dispatchPointer('pointerup', 292, 50)
    })

    const updateCalls = onResize.mock.calls.filter(([changes, options]) => (
      options?.phase === 'update' && Boolean(changes.width)
    ))

    expect(updateCalls[0]?.[0].width?.mode).toBe('fill')
    expect(updateCalls[updateCalls.length - 1]?.[0].width?.mode).toBe('fixed')
  })

  it('double-clicking edges sets fit sizing', () => {
    const element = document.createElement('div')
    const child = document.createElement('span')
    element.appendChild(child)
    element.getBoundingClientRect = () => ({
      left: 0, top: 0, width: 180, height: 90,
      right: 180, bottom: 90, x: 0, y: 0,
      toJSON: () => ({}),
    }) as DOMRect
    document.body.appendChild(element)

    const onResize = vi.fn<(
      changes: Partial<Record<SizingPropertyKey, SizingValue>>,
      options?: SizingChangeOptions
    ) => void>()

    const { result } = renderHook(() => useSelectionResize({
      selectedElement: element,
      enabled: true,
      onResizeSizingChange: onResize,
    }))

    act(() => {
      result.current.getResizeHandleDoubleClick('right')(createMouseEvent())
      result.current.getResizeHandleDoubleClick('top')(createMouseEvent())
    })

    expect(onResize).toHaveBeenCalledWith(
      expect.objectContaining({ width: expect.objectContaining({ mode: 'fit' }) }),
      undefined
    )
    expect(onResize).toHaveBeenCalledWith(
      expect.objectContaining({ height: expect.objectContaining({ mode: 'fit' }) }),
      undefined
    )
  })

  it('does not apply fit on edge double-click when div has no children', () => {
    const element = document.createElement('div')
    element.getBoundingClientRect = () => ({
      left: 0, top: 0, width: 180, height: 90,
      right: 180, bottom: 90, x: 0, y: 0,
      toJSON: () => ({}),
    }) as DOMRect
    document.body.appendChild(element)

    const onResize = vi.fn<(
      changes: Partial<Record<SizingPropertyKey, SizingValue>>,
      options?: SizingChangeOptions
    ) => void>()

    const { result } = renderHook(() => useSelectionResize({
      selectedElement: element,
      enabled: true,
      onResizeSizingChange: onResize,
    }))

    act(() => {
      result.current.getResizeHandleDoubleClick('right')(createMouseEvent())
    })

    expect(onResize).not.toHaveBeenCalled()
  })

  it('applies fit on edge double-click when div has text content only', () => {
    const element = document.createElement('div')
    element.textContent = 'hello'
    element.getBoundingClientRect = () => ({
      left: 0, top: 0, width: 180, height: 90,
      right: 180, bottom: 90, x: 0, y: 0,
      toJSON: () => ({}),
    }) as DOMRect
    document.body.appendChild(element)

    const onResize = vi.fn<(
      changes: Partial<Record<SizingPropertyKey, SizingValue>>,
      options?: SizingChangeOptions
    ) => void>()

    const { result } = renderHook(() => useSelectionResize({
      selectedElement: element,
      enabled: true,
      onResizeSizingChange: onResize,
    }))

    act(() => {
      result.current.getResizeHandleDoubleClick('right')(createMouseEvent())
    })

    expect(onResize).toHaveBeenCalledWith(
      expect.objectContaining({ width: expect.objectContaining({ mode: 'fit' }) }),
      undefined
    )
  })
})
