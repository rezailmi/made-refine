import * as React from 'react'
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useCanvas } from './use-canvas'
import type { DirectEditState } from './types'
import { DirectEditProvider, useDirectEdit } from './provider'
import { getBodyOffset, setBodyOffset } from './canvas-store'

// --- Mocks ---

vi.mock('./mcp-client', () => ({
  sendEditToAgent: vi.fn().mockResolvedValue({ ok: true, id: 'e-1' }),
  sendCommentToAgent: vi.fn().mockResolvedValue({ ok: true, id: 'c-1' }),
}))

// --- Helpers ---

function stubMatchMedia() {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    })),
  )
}

function createMockCanvasOptions() {
  const initialState: DirectEditState = {
    isOpen: false,
    selectedElement: null,
    elementInfo: null,
    computedSpacing: null,
    computedBorderRadius: null,
    computedBorder: null,
    computedFlex: null,
    computedSizing: null,
    computedColor: null,
    computedBoxShadow: null,
    computedTypography: null,
    originalStyles: {},
    pendingStyles: {},
    editModeActive: false,
    activeTool: 'select',
    theme: 'system',
    borderStyleControlPreference: 'label',
    comments: [],
    activeCommentId: null,
    textEditingElement: null,
    canvas: { active: false, zoom: 1, panX: 0, panY: 0 },
  }
  const stateRef = { current: initialState } as React.MutableRefObject<DirectEditState>
  const setState = vi.fn((updater: React.SetStateAction<DirectEditState>) => {
    if (typeof updater === 'function') {
      stateRef.current = updater(stateRef.current)
    } else {
      stateRef.current = updater
    }
  })
  return { stateRef, setState }
}

function dispatchWheel(opts: {
  deltaX?: number
  deltaY?: number
  ctrlKey?: boolean
  clientX?: number
  clientY?: number
}) {
  window.dispatchEvent(
    new WheelEvent('wheel', {
      deltaX: opts.deltaX ?? 0,
      deltaY: opts.deltaY ?? 0,
      ctrlKey: opts.ctrlKey ?? false,
      clientX: opts.clientX ?? 0,
      clientY: opts.clientY ?? 0,
      bubbles: true,
      cancelable: true,
    }),
  )
}

function dispatchPointer(
  type: 'pointerdown' | 'pointermove' | 'pointerup',
  x = 0,
  y = 0,
  button = 0,
) {
  const event = new Event(type, { bubbles: true }) as PointerEvent
  Object.defineProperty(event, 'clientX', { value: x })
  Object.defineProperty(event, 'clientY', { value: y })
  Object.defineProperty(event, 'button', { value: button })
  Object.defineProperty(event, 'preventDefault', { value: vi.fn() })
  window.dispatchEvent(event)
}

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <DirectEditProvider>{children}</DirectEditProvider>
)

// --- Setup / Teardown ---

beforeEach(() => {
  stubMatchMedia()
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  // Make requestAnimationFrame synchronous so rAF-batched setState calls
  // resolve immediately within act(), keeping test assertions predictable.
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { cb(performance.now()); return 0 })
  vi.stubGlobal('cancelAnimationFrame', () => {})
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  document.body.style.cssText = ''
  document.documentElement.style.cssText = ''
  document.body.innerHTML = ''
  document.querySelectorAll('[data-direct-edit-host]').forEach((el) => el.remove())
  setBodyOffset({ x: 0, y: 0 })
})

// ─── Group 1: useCanvas hook lifecycle ───

describe('useCanvas hook lifecycle', () => {
  it('starts inactive and returns expected functions', () => {
    const opts = createMockCanvasOptions()
    const { result } = renderHook(() => useCanvas(opts))

    expect(typeof result.current.toggleCanvas).toBe('function')
    expect(typeof result.current.exitCanvas).toBe('function')
    expect(typeof result.current.setCanvasZoom).toBe('function')
    expect(typeof result.current.fitCanvasToViewport).toBe('function')
    expect(typeof result.current.zoomCanvasTo100).toBe('function')
    expect(opts.stateRef.current.canvas.active).toBe(false)
    expect(document.body.style.transform).toBe('')
  })

  it('toggleCanvas enters canvas mode with DOM side effects', () => {
    Object.defineProperty(window, 'scrollX', { value: 100, configurable: true })
    Object.defineProperty(window, 'scrollY', { value: 200, configurable: true })

    const opts = createMockCanvasOptions()
    const { result } = renderHook(() => useCanvas(opts))

    act(() => {
      result.current.toggleCanvas()
    })

    expect(opts.stateRef.current.canvas.active).toBe(true)
    expect(opts.stateRef.current.canvas.zoom).toBe(1)
    expect(opts.stateRef.current.canvas.panX).toBe(-100)
    expect(opts.stateRef.current.canvas.panY).toBe(-200)
    expect(document.body.style.overflow).toBe('hidden')
    expect(document.body.style.transform).toBe('scale(1) translate(-100px, -200px)')
    expect(document.body.style.transformOrigin).toBe('0 0')
  })

  it('recomputes body offset on resize while canvas mode is active', () => {
    document.body.style.margin = '8px 10px 12px 14px'
    const opts = createMockCanvasOptions()
    const { result } = renderHook(() => useCanvas(opts))

    act(() => {
      result.current.toggleCanvas()
    })

    expect(getBodyOffset()).toEqual({ x: 14, y: 8 })

    document.body.style.margin = '16px 18px 20px 22px'

    act(() => {
      window.dispatchEvent(new Event('resize'))
    })

    expect(getBodyOffset()).toEqual({ x: 22, y: 16 })
  })

  it('toggleCanvas exits and restores DOM state', () => {
    Object.defineProperty(window, 'scrollX', { value: 50, configurable: true })
    Object.defineProperty(window, 'scrollY', { value: 75, configurable: true })

    const opts = createMockCanvasOptions()
    const { result } = renderHook(() => useCanvas(opts))

    act(() => {
      result.current.toggleCanvas()
    })
    expect(opts.stateRef.current.canvas.active).toBe(true)

    act(() => {
      result.current.toggleCanvas()
    })

    expect(opts.stateRef.current.canvas.active).toBe(false)
    expect(opts.stateRef.current.canvas.zoom).toBe(1)
    expect(opts.stateRef.current.canvas.panX).toBe(0)
    expect(opts.stateRef.current.canvas.panY).toBe(0)
    expect(document.body.style.transform).toBe('')
    expect(document.body.style.transformOrigin).toBe('')
    expect(document.body.style.cursor).toBe('')
    expect(window.scrollTo).toHaveBeenCalledWith(50, 75)
  })

  it('setCanvasZoom clamps to [0.1, 5.0]', () => {
    const opts = createMockCanvasOptions()
    const { result } = renderHook(() => useCanvas(opts))

    act(() => {
      result.current.toggleCanvas()
    })

    act(() => {
      result.current.setCanvasZoom(0.05)
    })
    expect(opts.stateRef.current.canvas.zoom).toBe(0.1)

    act(() => {
      result.current.setCanvasZoom(10)
    })
    expect(opts.stateRef.current.canvas.zoom).toBe(5)

    act(() => {
      result.current.setCanvasZoom(2.5)
    })
    expect(opts.stateRef.current.canvas.zoom).toBe(2.5)
    expect(document.body.style.transform).toContain('scale(2.5)')
  })

  it('setCanvasZoom is no-op when inactive', () => {
    const opts = createMockCanvasOptions()
    const { result } = renderHook(() => useCanvas(opts))

    opts.setState.mockClear()

    act(() => {
      result.current.setCanvasZoom(2)
    })

    expect(opts.setState).not.toHaveBeenCalled()
    expect(opts.stateRef.current.canvas.zoom).toBe(1)
  })

  it('zoomCanvasTo100 resets zoom and pan', () => {
    const opts = createMockCanvasOptions()
    const { result } = renderHook(() => useCanvas(opts))

    act(() => {
      result.current.toggleCanvas()
    })
    act(() => {
      result.current.setCanvasZoom(2)
    })
    act(() => {
      result.current.zoomCanvasTo100()
    })

    expect(opts.stateRef.current.canvas.zoom).toBe(1)
    expect(opts.stateRef.current.canvas.panX).toBe(0)
    expect(opts.stateRef.current.canvas.panY).toBe(0)
    expect(document.body.style.transform).toBe('scale(1) translate(0px, 0px)')
  })

  it('fitCanvasToViewport calculates zoom to fit content', () => {
    Object.defineProperty(window, 'innerWidth', { value: 1000, configurable: true })
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true })

    const opts = createMockCanvasOptions()
    const { result } = renderHook(() => useCanvas(opts))

    act(() => {
      result.current.toggleCanvas()
    })
    act(() => {
      result.current.fitCanvasToViewport()
    })

    // body.scrollWidth/Height are 0 in jsdom, so it falls back to innerWidth/innerHeight
    // scaleX = scaleY = 1, zoom = 0.9 (1 * 0.9)
    expect(opts.stateRef.current.canvas.zoom).toBeCloseTo(0.9, 1)
    expect(opts.stateRef.current.canvas.active).toBe(true)
  })

  it('enterCanvas expands scroll containers and captures full height', () => {
    // Create a root div simulating a scrollable app container
    const root = document.createElement('div')
    root.id = 'root'
    root.style.height = '100px'
    root.style.overflow = 'auto'
    root.style.overflowY = 'auto'
    root.style.maxHeight = '100px'
    document.body.appendChild(root)

    const tall = document.createElement('div')
    tall.style.height = '500px'
    root.appendChild(tall)

    // Fake scrollHeight > clientHeight for jsdom
    Object.defineProperty(root, 'scrollHeight', { value: 500, configurable: true })
    Object.defineProperty(root, 'clientHeight', { value: 100, configurable: true })

    const opts = createMockCanvasOptions()
    const { result } = renderHook(() => useCanvas(opts))

    act(() => {
      result.current.enterCanvas()
    })

    // Scroll container should be expanded
    expect(root.style.height).toBe('auto')
    expect(root.style.maxHeight).toBe('none')
    expect(root.style.overflow).toBe('visible')
    expect(root.style.overflowY).toBe('visible')

    // Exit should restore original styles
    act(() => {
      result.current.exitCanvas()
    })

    expect(root.style.height).toBe('100px')
    expect(root.style.maxHeight).toBe('100px')
    expect(root.style.overflow).toBe('auto')
    expect(root.style.overflowY).toBe('auto')
  })

  it('unmount exits canvas automatically', () => {
    const opts = createMockCanvasOptions()
    const { result, unmount } = renderHook(() => useCanvas(opts))

    act(() => {
      result.current.toggleCanvas()
    })
    expect(document.body.style.transform).not.toBe('')

    unmount()

    expect(document.body.style.transform).toBe('')
  })
})

// ─── Group 2: Provider integration + keyboard shortcuts ───

describe('provider integration and keyboard shortcuts', () => {
  it('exposes canvas state and actions through context', () => {
    const { result } = renderHook(() => useDirectEdit(), { wrapper })

    expect(result.current.canvas).toEqual({ active: false, zoom: 1, panX: 0, panY: 0 })
    expect(typeof result.current.toggleCanvas).toBe('function')
    expect(typeof result.current.setCanvasZoom).toBe('function')
    expect(typeof result.current.fitCanvasToViewport).toBe('function')
    expect(typeof result.current.zoomCanvasTo100).toBe('function')

    act(() => {
      result.current.toggleCanvas()
    })
    expect(result.current.canvas.active).toBe(true)
  })

  it('toggleEditMode enters canvas automatically and exits canvas when turning off', () => {
    const { result } = renderHook(() => useDirectEdit(), { wrapper })

    // Activate edit mode — canvas should auto-activate
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '.', code: 'Period', ctrlKey: true }))
    })
    expect(result.current.editModeActive).toBe(true)
    expect(result.current.canvas.active).toBe(true)

    // Turn off edit mode — should also exit canvas
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '.', code: 'Period', ctrlKey: true }))
    })
    expect(result.current.editModeActive).toBe(false)
    expect(result.current.canvas.active).toBe(false)
    expect(document.body.style.transform).toBe('')
  })

  it('Shift+Z toggles canvas when edit mode is active', () => {
    const { result } = renderHook(() => useDirectEdit(), { wrapper })

    // Activate edit mode — canvas auto-activates
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '.', code: 'Period', ctrlKey: true }))
    })
    expect(result.current.editModeActive).toBe(true)
    expect(result.current.canvas.active).toBe(true)

    // Shift+Z → canvas off
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Z', shiftKey: true }))
    })
    expect(result.current.canvas.active).toBe(false)

    // Shift+Z → canvas on
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Z', shiftKey: true }))
    })
    expect(result.current.canvas.active).toBe(true)
  })

  it('Ctrl+1 resets to 100% when canvas is active', () => {
    const { result } = renderHook(() => useDirectEdit(), { wrapper })

    // Activate edit mode — canvas auto-activates
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '.', code: 'Period', ctrlKey: true }))
    })
    act(() => {
      result.current.setCanvasZoom(2)
    })
    expect(result.current.canvas.zoom).toBe(2)

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '1', code: 'Digit1', ctrlKey: true }))
    })
    expect(result.current.canvas.zoom).toBe(1)
    expect(result.current.canvas.panX).toBe(0)
    expect(result.current.canvas.panY).toBe(0)
  })

  it('Ctrl+= zooms in and Ctrl+- zooms out', () => {
    const { result } = renderHook(() => useDirectEdit(), { wrapper })

    // Activate edit mode — canvas auto-activates
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '.', code: 'Period', ctrlKey: true }))
    })
    expect(result.current.canvas.zoom).toBe(1)

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '=', code: 'Equal', ctrlKey: true }))
    })
    expect(result.current.canvas.zoom).toBeCloseTo(1.1, 1)

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '-', code: 'Minus', ctrlKey: true }))
    })
    expect(result.current.canvas.zoom).toBeCloseTo(1.0, 1)
  })
})

// ─── Group 3: Wheel event handling ───

describe('wheel event handling', () => {
  it('plain scroll pans the canvas', () => {
    const opts = createMockCanvasOptions()
    const { result } = renderHook(() => useCanvas(opts))

    act(() => {
      result.current.toggleCanvas()
    })
    const initialPanX = opts.stateRef.current.canvas.panX
    const initialPanY = opts.stateRef.current.canvas.panY

    act(() => {
      dispatchWheel({ deltaX: 50, deltaY: 100 })
    })

    expect(opts.stateRef.current.canvas.panX).toBe(initialPanX - 50)
    expect(opts.stateRef.current.canvas.panY).toBe(initialPanY - 100)
  })

  it('Ctrl+scroll zooms the canvas', () => {
    const opts = createMockCanvasOptions()
    const { result } = renderHook(() => useCanvas(opts))

    act(() => {
      result.current.toggleCanvas()
    })

    act(() => {
      dispatchWheel({ deltaY: -100, ctrlKey: true, clientX: 400, clientY: 300 })
    })

    // negative deltaY with Math.exp(-deltaY * ZOOM_SENSITIVITY=0.0145) → zoomFactor > 1 → zoom in
    expect(opts.stateRef.current.canvas.zoom).toBeGreaterThan(1)
    expect(document.body.style.transform).toContain('scale(')
  })

  it('zoom clamps at max on extreme Ctrl+scroll', () => {
    const opts = createMockCanvasOptions()
    const { result } = renderHook(() => useCanvas(opts))

    act(() => {
      result.current.toggleCanvas()
    })
    act(() => {
      result.current.setCanvasZoom(4.9)
    })

    act(() => {
      dispatchWheel({ deltaY: -50000, ctrlKey: true })
    })

    expect(opts.stateRef.current.canvas.zoom).toBe(5)
  })

  it('wheel events are ignored when canvas is inactive', () => {
    const opts = createMockCanvasOptions()
    renderHook(() => useCanvas(opts))

    opts.setState.mockClear()

    act(() => {
      dispatchWheel({ deltaY: 100 })
    })

    expect(opts.setState).not.toHaveBeenCalled()
  })
})

// ─── Group 4: Pointer drag panning ───

describe('pointer drag panning', () => {
  it('middle mouse drag pans the canvas', () => {
    const opts = createMockCanvasOptions()
    const { result } = renderHook(() => useCanvas(opts))

    act(() => {
      result.current.toggleCanvas()
    })
    const initialPanX = opts.stateRef.current.canvas.panX
    const initialPanY = opts.stateRef.current.canvas.panY

    act(() => {
      dispatchPointer('pointerdown', 100, 100, 1)
    })
    expect(document.body.style.cursor).toBe('grabbing')

    act(() => {
      dispatchPointer('pointermove', 150, 200)
    })
    // Delta: 50 in x, 100 in y. At zoom=1 → pan += delta/zoom
    expect(opts.stateRef.current.canvas.panX).toBe(initialPanX + 50)
    expect(opts.stateRef.current.canvas.panY).toBe(initialPanY + 100)

    act(() => {
      dispatchPointer('pointerup')
    })
    expect(document.body.style.cursor).toBe('')
  })

  it('space+drag pans with left mouse', () => {
    const opts = createMockCanvasOptions()
    const { result } = renderHook(() => useCanvas(opts))

    act(() => {
      result.current.toggleCanvas()
    })

    // Hold space
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true }))
    })
    expect(document.body.style.cursor).toBe('grab')

    // Left click drag
    act(() => {
      dispatchPointer('pointerdown', 200, 200, 0)
    })
    expect(document.body.style.cursor).toBe('grabbing')

    act(() => {
      dispatchPointer('pointermove', 250, 300)
    })

    act(() => {
      dispatchPointer('pointerup')
    })
    // Space still held → cursor should revert to grab
    expect(document.body.style.cursor).toBe('grab')

    // Release space
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', bubbles: true }))
    })
    expect(document.body.style.cursor).toBe('')
  })

  it('space keydown is ignored when focus is in an input element', () => {
    const opts = createMockCanvasOptions()
    const { result } = renderHook(() => useCanvas(opts))

    act(() => {
      result.current.toggleCanvas()
    })

    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true }))
    })

    expect(document.body.style.cursor).not.toBe('grab')
  })

  it('regular left click without space does not pan', () => {
    const opts = createMockCanvasOptions()
    const { result } = renderHook(() => useCanvas(opts))

    act(() => {
      result.current.toggleCanvas()
    })
    opts.setState.mockClear()

    act(() => {
      dispatchPointer('pointerdown', 100, 100, 0)
    })
    act(() => {
      dispatchPointer('pointermove', 200, 200)
    })

    expect(opts.setState).not.toHaveBeenCalled()
    expect(document.body.style.cursor).not.toBe('grabbing')
  })

  it('dispatches direct-edit-canvas-change on enter, pan, and exit', () => {
    const handler = vi.fn()
    window.addEventListener('direct-edit-canvas-change', handler)

    const opts = createMockCanvasOptions()
    const { result } = renderHook(() => useCanvas(opts))

    // Enter
    act(() => {
      result.current.toggleCanvas()
    })
    expect(handler).toHaveBeenCalled()
    handler.mockClear()

    // Pan via wheel
    act(() => {
      dispatchWheel({ deltaY: 50 })
    })
    expect(handler).toHaveBeenCalled()
    handler.mockClear()

    // Exit
    act(() => {
      result.current.toggleCanvas()
    })
    expect(handler).toHaveBeenCalled()

    window.removeEventListener('direct-edit-canvas-change', handler)
  })
})
