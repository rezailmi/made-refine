import * as React from 'react'
import { renderHook, act } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useToolbarDock } from './use-toolbar-dock'

type RectState = {
  left: number
  top: number
  width: number
  height: number
}

function toDOMRect(rect: RectState): DOMRect {
  return {
    x: rect.left,
    y: rect.top,
    width: rect.width,
    height: rect.height,
    top: rect.top,
    right: rect.left + rect.width,
    bottom: rect.top + rect.height,
    left: rect.left,
    toJSON: () => ({}),
  } as DOMRect
}

function createToolbarElement(rect: RectState): HTMLDivElement {
  const el = document.createElement('div')
  el.getBoundingClientRect = () => toDOMRect(rect)
  el.setPointerCapture = vi.fn()
  el.releasePointerCapture = vi.fn()
  return el
}

function createPointerEvent(el: HTMLDivElement, x: number, y: number, pointerId = 1): React.PointerEvent {
  return {
    clientX: x,
    clientY: y,
    pointerId,
    currentTarget: el,
  } as unknown as React.PointerEvent
}

describe('useToolbarDock', () => {
  beforeEach(() => {
    vi.useFakeTimers()

    const store = new Map<string, string>()
    const storageMock: Storage = {
      getItem: (key) => store.get(key) ?? null,
      setItem: (key, value) => {
        store.set(key, String(value))
      },
      removeItem: (key) => {
        store.delete(key)
      },
      clear: () => {
        store.clear()
      },
      key: (index) => Array.from(store.keys())[index] ?? null,
      get length() {
        return store.size
      },
    }

    vi.stubGlobal('localStorage', storageMock)

    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 1280,
      writable: true,
    })
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 800,
      writable: true,
    })

    class ResizeObserverMock {
      observe() {}
      disconnect() {}
    }

    vi.stubGlobal('ResizeObserver', ResizeObserverMock)
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => (
      setTimeout(() => cb(0), 0) as unknown as number
    ))
    vi.stubGlobal('cancelAnimationFrame', (id: number) => {
      clearTimeout(id)
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('returns to docked after a click while snapping', () => {
    const rect: RectState = { left: 560, top: 720, width: 160, height: 40 }
    const toolbarEl = createToolbarElement(rect)
    const ref: React.RefObject<HTMLDivElement | null> = { current: toolbarEl }

    const { result } = renderHook(() => useToolbarDock(ref))

    act(() => {
      vi.runOnlyPendingTimers()
    })

    act(() => {
      result.current.handlePointerDown(createPointerEvent(toolbarEl, 580, 730))
    })
    act(() => {
      result.current.handlePointerMove(createPointerEvent(toolbarEl, 590, 730))
    })
    act(() => {
      result.current.handlePointerUp(createPointerEvent(toolbarEl, 590, 730))
    })

    expect(result.current.isSnapping).toBe(true)

    act(() => {
      result.current.handlePointerDown(createPointerEvent(toolbarEl, 580, 730))
      result.current.handlePointerUp(createPointerEvent(toolbarEl, 580, 730))
    })

    act(() => {
      vi.advanceTimersByTime(400)
    })

    expect(result.current.isSnapping).toBe(false)
    expect(result.current.isDragging).toBe(false)
  })

  it('clears snap timer when drag restarts during snapping', () => {
    const rect: RectState = { left: 560, top: 720, width: 160, height: 40 }
    const toolbarEl = createToolbarElement(rect)
    const ref: React.RefObject<HTMLDivElement | null> = { current: toolbarEl }

    const { result } = renderHook(() => useToolbarDock(ref))

    act(() => {
      vi.runOnlyPendingTimers()
    })

    act(() => {
      result.current.handlePointerDown(createPointerEvent(toolbarEl, 580, 730))
    })
    act(() => {
      result.current.handlePointerMove(createPointerEvent(toolbarEl, 590, 730))
    })
    act(() => {
      result.current.handlePointerUp(createPointerEvent(toolbarEl, 590, 730))
    })

    expect(result.current.isSnapping).toBe(true)

    act(() => {
      result.current.handlePointerDown(createPointerEvent(toolbarEl, 580, 730))
    })
    act(() => {
      result.current.handlePointerMove(createPointerEvent(toolbarEl, 590, 730))
    })

    act(() => {
      vi.advanceTimersByTime(400)
    })

    expect(result.current.isDragging).toBe(true)
    expect(result.current.isSnapping).toBe(false)
  })
})
