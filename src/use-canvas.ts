import * as React from 'react'
import type { DirectEditState } from './types'
import { isInputFocused } from './utils'
import { setCanvasSnapshot, getBodyOffset, setBodyOffset, registerCanvasStoreOwner } from './canvas-store'

const MIN_ZOOM = 0.1
const MAX_ZOOM = 5.0

// Zoom sensitivity applied to normalized pixel delta.
// macOS trackpad pinch: deltaY ≈ 1–2px/event → ~0.3–0.6% per event (smooth).
// Windows mouse Ctrl+scroll: deltaY ≈ 100px/notch → ~26% per notch.
const ZOOM_SENSITIVITY = 0.0145

// Wheel delta normalization constants (Facebook normalizeWheel convention).
// Required because Firefox can report DOM_DELTA_LINE and some Windows configs
// use DOM_DELTA_PAGE, giving very different deltaY magnitudes than pixel mode.
const LINE_HEIGHT_PX = 40
const PAGE_HEIGHT_PX = 800

function normalizeWheelDelta(e: WheelEvent): { deltaX: number; deltaY: number } {
  let { deltaX, deltaY } = e
  if (e.deltaMode === 1) {        // DOM_DELTA_LINE
    deltaX *= LINE_HEIGHT_PX
    deltaY *= LINE_HEIGHT_PX
  } else if (e.deltaMode === 2) { // DOM_DELTA_PAGE
    deltaX *= PAGE_HEIGHT_PX
    deltaY *= PAGE_HEIGHT_PX
  }
  return { deltaX, deltaY }
}

// Clamp pan so at least PAN_MARGIN of the viewport always shows content,
// preventing the user from panning content entirely off-screen.
// fitCanvasToViewport centering values always satisfy this constraint.
const PAN_MARGIN = 0.1

function clampPan(
  zoom: number,
  panX: number,
  panY: number,
  bodyW: number,
  bodyH: number,
): { panX: number; panY: number } {
  const vw = window.innerWidth
  const vh = window.innerHeight
  // Content right edge must remain >= MARGIN * vw in viewport space:
  //   (bodyW + panX) * zoom >= MARGIN * vw  →  panX >= MARGIN*vw/zoom - bodyW
  const minPanX = PAN_MARGIN * vw / zoom - bodyW
  // Content left edge must remain <= (1-MARGIN) * vw:
  //   panX * zoom <= (1-MARGIN)*vw  →  panX <= (1-MARGIN)*vw/zoom
  const maxPanX = (1 - PAN_MARGIN) * vw / zoom
  const minPanY = PAN_MARGIN * vh / zoom - bodyH
  const maxPanY = (1 - PAN_MARGIN) * vh / zoom
  return {
    panX: Math.max(minPanX, Math.min(maxPanX, panX)),
    panY: Math.max(minPanY, Math.min(maxPanY, panY)),
  }
}

export interface UseCanvasOptions {
  stateRef: React.MutableRefObject<DirectEditState>
  setState: React.Dispatch<React.SetStateAction<DirectEditState>>
}

export interface UseCanvasReturn {
  toggleCanvas: () => void
  enterCanvas: () => void
  exitCanvas: () => void
  setCanvasZoom: (zoom: number) => void
  fitCanvasToViewport: () => void
  zoomCanvasTo100: () => void
}

export function useCanvas({ stateRef, setState }: UseCanvasOptions): UseCanvasReturn {
  React.useEffect(() => registerCanvasStoreOwner(), [])

  // Synchronous ref for canvas state (avoids stale closures in event handlers)
  const canvasRef = React.useRef({ active: false, zoom: 1, panX: 0, panY: 0 })

  // Saved state for restoring on exit
  const savedScrollRef = React.useRef({ x: 0, y: 0 })
  const savedBodyOverflowRef = React.useRef('')
  const savedHtmlOverflowRef = React.useRef('')
  const savedHtmlBgColorRef = React.useRef('')
  const savedBodyDimensionsRef = React.useRef({ width: 0, height: 0 })
  const savedScrollContainersRef = React.useRef<Array<{
    el: HTMLElement
    height: string
    maxHeight: string
    overflowX: string
    overflowY: string
  }>>([])

  // rAF batching for setState: DOM transform is applied immediately for visual
  // smoothness; React state is deferred to avoid 60fps re-renders across all consumers.
  // Note: RulersOverlay reads canvas state from React context and will lag by
  // one frame during rapid interaction — this is an accepted visual tradeoff.
  const rafIdRef = React.useRef<number | null>(null)
  const rafPendingRef = React.useRef(false)

  // Space key and drag state
  const spaceHeldRef = React.useRef(false)
  const isDraggingRef = React.useRef(false)
  const dragStartRef = React.useRef({ x: 0, y: 0, panX: 0, panY: 0 })

  const applyTransform = React.useCallback((zoom: number, panX: number, panY: number) => {
    document.body.style.transformOrigin = '0 0'
    document.body.style.transform = `scale(${zoom}) translate(${panX}px, ${panY}px)`
  }, [])

  const dispatchCanvasChange = React.useCallback(() => {
    window.dispatchEvent(new Event('direct-edit-canvas-change'))
  }, [])

  const readBodyOffset = React.useCallback(() => {
    const bodyStyle = getComputedStyle(document.body)
    return {
      x: parseFloat(bodyStyle.marginLeft) || 0,
      y: parseFloat(bodyStyle.marginTop) || 0,
    }
  }, [])

  const updateBodyOffset = React.useCallback(() => {
    const next = readBodyOffset()
    const prev = getBodyOffset()
    if (prev.x === next.x && prev.y === next.y) return false
    setBodyOffset(next)
    return true
  }, [readBodyOffset])

  const cancelPendingRaf = React.useCallback(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current)
      rafIdRef.current = null
      rafPendingRef.current = false
    }
  }, [])

  const updateCanvas = React.useCallback((zoom: number, panX: number, panY: number) => {
    const dims = savedBodyDimensionsRef.current
    const bodyW = dims.width || window.innerWidth
    const bodyH = dims.height || window.innerHeight
    const clamped = clampPan(zoom, panX, panY, bodyW, bodyH)

    canvasRef.current = { ...canvasRef.current, zoom, panX: clamped.panX, panY: clamped.panY }
    setCanvasSnapshot(canvasRef.current)
    applyTransform(zoom, clamped.panX, clamped.panY)
    dispatchCanvasChange()

    // Batch React state update via rAF. The snapshot is read at fire time so
    // rapid events (e.g. 60fps wheel) collapse into a single setState per frame.
    if (!rafPendingRef.current) {
      rafPendingRef.current = true
      rafIdRef.current = requestAnimationFrame(() => {
        rafPendingRef.current = false
        rafIdRef.current = null
        const s = canvasRef.current
        setState((prev) => ({
          ...prev,
          canvas: { active: s.active, zoom: s.zoom, panX: s.panX, panY: s.panY },
        }))
      })
    }
  }, [applyTransform, dispatchCanvasChange, setState])

  function isScrollableContainer(el: HTMLElement): boolean {
    if (el.scrollHeight <= el.clientHeight + 1) return false
    const style = getComputedStyle(el)
    const overflowY = style.overflowY || style.overflow
    // Skip intentionally clipped containers; expanding them can inflate canvas bounds.
    if (overflowY === 'hidden' || overflowY === 'clip') return false
    return overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay'
  }

  function expandScrollContainers(): void {
    const saved: typeof savedScrollContainersRef.current = []
    const queue: HTMLElement[] = Array.from(document.body.children).filter(
      (el): el is HTMLElement => el instanceof HTMLElement
    )
    let visited = 0
    const maxNodes = 5000
    while (queue.length > 0 && visited < maxNodes) {
      const nextQueue: HTMLElement[] = []
      for (const el of queue) {
        if (visited >= maxNodes) break
        visited++
        if (isScrollableContainer(el)) {
          const style = el.style
          saved.push({
            el,
            height: style.height,
            maxHeight: style.maxHeight,
            overflowX: style.overflowX,
            overflowY: style.overflowY,
          })
          style.height = 'auto'
          style.maxHeight = 'none'
          style.overflowX = 'visible'
          style.overflowY = 'visible'
        }
        for (const child of el.children) {
          if (child instanceof HTMLElement) nextQueue.push(child)
        }
      }
      queue.length = 0
      queue.push(...nextQueue)
    }
    savedScrollContainersRef.current = saved
  }

  function restoreScrollContainers(): void {
    for (let i = savedScrollContainersRef.current.length - 1; i >= 0; i--) {
      const { el, height, maxHeight, overflowX, overflowY } = savedScrollContainersRef.current[i]
      el.style.height = height
      el.style.maxHeight = maxHeight
      el.style.overflowX = overflowX
      el.style.overflowY = overflowY
    }
    savedScrollContainersRef.current = []
  }

  const enterCanvas = React.useCallback(() => {
    const scrollX = window.scrollX
    const scrollY = window.scrollY
    savedScrollRef.current = { x: scrollX, y: scrollY }
    savedBodyOverflowRef.current = document.body.style.overflow
    savedHtmlOverflowRef.current = document.documentElement.style.overflow
    savedHtmlBgColorRef.current = document.documentElement.style.backgroundColor

    const existingTransform = document.body.style.transform
    if (existingTransform && existingTransform !== 'none' && existingTransform !== '') {
      console.warn('[made-refine] canvas mode: overriding existing body transform:', existingTransform)
    }

    // Reset window scroll so transform does the positioning
    window.scrollTo(0, 0)

    // Expand scroll containers so body reflects full content dimensions
    expandScrollContainers()

    savedBodyDimensionsRef.current = {
      width: document.body.scrollWidth,
      height: document.body.scrollHeight,
    }

    // Measure body margin before applying transform — needed for guideline math.
    updateBodyOffset()

    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
    document.documentElement.style.backgroundColor = '#F5F5F5'

    // Initial pan compensates for saved scroll position
    const initialPanX = -scrollX
    const initialPanY = -scrollY
    applyTransform(1, initialPanX, initialPanY)

    canvasRef.current = { active: true, zoom: 1, panX: initialPanX, panY: initialPanY }
    setCanvasSnapshot(canvasRef.current)
    setState((prev) => ({
      ...prev,
      canvas: { active: true, zoom: 1, panX: initialPanX, panY: initialPanY },
    }))
    dispatchCanvasChange()
  }, [applyTransform, dispatchCanvasChange, setState, updateBodyOffset])

  const exitCanvas = React.useCallback(() => {
    // Cancel any pending rAF first to prevent stale setState firing after exit
    // has already reset canvas state to { active: false, zoom: 1, panX: 0, panY: 0 }.
    cancelPendingRaf()

    document.body.style.transform = ''
    document.body.style.transformOrigin = ''
    restoreScrollContainers()
    document.body.style.overflow = savedBodyOverflowRef.current
    document.documentElement.style.overflow = savedHtmlOverflowRef.current
    document.documentElement.style.backgroundColor = savedHtmlBgColorRef.current
    document.body.style.cursor = ''

    window.scrollTo(savedScrollRef.current.x, savedScrollRef.current.y)

    setBodyOffset({ x: 0, y: 0 })
    canvasRef.current = { active: false, zoom: 1, panX: 0, panY: 0 }
    setCanvasSnapshot(canvasRef.current)
    setState((prev) => ({
      ...prev,
      canvas: { active: false, zoom: 1, panX: 0, panY: 0 },
    }))
    dispatchCanvasChange()
  }, [cancelPendingRaf, dispatchCanvasChange, setState])

  const toggleCanvas = React.useCallback(() => {
    if (canvasRef.current.active) {
      exitCanvas()
    } else {
      enterCanvas()
    }
  }, [enterCanvas, exitCanvas])

  const setCanvasZoom = React.useCallback((zoom: number) => {
    const c = canvasRef.current
    if (!c.active) return
    const clampedZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom))
    updateCanvas(clampedZoom, c.panX, c.panY)
  }, [updateCanvas])

  const fitCanvasToViewport = React.useCallback(() => {
    const c = canvasRef.current
    if (!c.active) return
    const bodyWidth = savedBodyDimensionsRef.current.width || window.innerWidth
    const bodyHeight = savedBodyDimensionsRef.current.height || window.innerHeight
    const scaleX = window.innerWidth / bodyWidth
    const scaleY = window.innerHeight / bodyHeight
    const zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.min(scaleX, scaleY) * 0.9))
    // Center content: panX = (viewportWidth/zoom - bodyWidth) / 2
    // These centering values always satisfy the pan clamp bounds.
    const panX = (window.innerWidth / zoom - bodyWidth) / 2
    const panY = (window.innerHeight / zoom - bodyHeight) / 2
    updateCanvas(zoom, panX, panY)
  }, [updateCanvas])

  const zoomCanvasTo100 = React.useCallback(() => {
    const c = canvasRef.current
    if (!c.active) return
    updateCanvas(1, 0, 0)
  }, [updateCanvas])

  // Wheel handler: Ctrl/Cmd+scroll = zoom-to-cursor, plain scroll = pan
  React.useEffect(() => {
    function handleWheel(e: WheelEvent) {
      const c = canvasRef.current
      if (!c.active) return
      e.preventDefault()

      const { deltaX, deltaY } = normalizeWheelDelta(e)

      if (e.ctrlKey || e.metaKey) {
        const zoomFactor = Math.exp(-deltaY * ZOOM_SENSITIVITY)
        const oldZoom = c.zoom
        const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, oldZoom * zoomFactor))
        const cx = e.clientX
        const cy = e.clientY
        // Zoom-to-cursor: account for body margin offset
        const bo = getBodyOffset()
        const newPanX = c.panX + (cx - bo.x) * (1 / newZoom - 1 / oldZoom)
        const newPanY = c.panY + (cy - bo.y) * (1 / newZoom - 1 / oldZoom)
        updateCanvas(newZoom, newPanX, newPanY)
      } else {
        // Pan: divide by zoom to convert viewport delta to content-space delta
        const newPanX = c.panX - deltaX / c.zoom
        const newPanY = c.panY - deltaY / c.zoom
        updateCanvas(c.zoom, newPanX, newPanY)
      }
    }

    window.addEventListener('wheel', handleWheel, { passive: false })
    return () => window.removeEventListener('wheel', handleWheel)
  }, [updateCanvas])

  // Body margins can change on responsive breakpoints; keep canvas math in sync.
  React.useEffect(() => {
    function handleResize() {
      if (!canvasRef.current.active) return
      if (updateBodyOffset()) {
        dispatchCanvasChange()
      }
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [dispatchCanvasChange, updateBodyOffset])

  // Space key tracking for grab cursor
  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.code !== 'Space' || e.repeat) return
      if (!canvasRef.current.active) return
      if (isInputFocused()) return
      spaceHeldRef.current = true
      if (!isDraggingRef.current) {
        document.body.style.cursor = 'grab'
      }
      e.preventDefault()
    }

    function handleKeyUp(e: KeyboardEvent) {
      if (e.code !== 'Space') return
      if (!canvasRef.current.active) return
      spaceHeldRef.current = false
      if (!isDraggingRef.current) {
        document.body.style.cursor = ''
      }
    }

    window.addEventListener('keydown', handleKeyDown, true)
    window.addEventListener('keyup', handleKeyUp, true)
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true)
      window.removeEventListener('keyup', handleKeyUp, true)
    }
  }, [])

  // Pointer drag for pan (Space+drag or middle mouse button).
  // Uses AbortController so all nested listeners are always removed together.
  // Also handles pointercancel and window blur to prevent stuck drag state.
  React.useEffect(() => {
    function handlePointerDown(e: PointerEvent) {
      const c = canvasRef.current
      if (!c.active) return
      const isMiddleMouse = e.button === 1
      const isSpaceDrag = spaceHeldRef.current && e.button === 0
      if (!isMiddleMouse && !isSpaceDrag) return

      e.preventDefault()
      isDraggingRef.current = true
      dragStartRef.current = { x: e.clientX, y: e.clientY, panX: c.panX, panY: c.panY }
      document.body.style.cursor = 'grabbing'

      const dragAbort = new AbortController()
      const opts = { signal: dragAbort.signal }

      function endDrag() {
        isDraggingRef.current = false
        document.body.style.cursor = spaceHeldRef.current ? 'grab' : ''
        dragAbort.abort()
      }

      window.addEventListener('pointermove', (moveE: PointerEvent) => {
        const current = canvasRef.current
        const dx = (moveE.clientX - dragStartRef.current.x) / current.zoom
        const dy = (moveE.clientY - dragStartRef.current.y) / current.zoom
        updateCanvas(current.zoom, dragStartRef.current.panX + dx, dragStartRef.current.panY + dy)
      }, opts)

      // pointercancel: pointer cancelled by system gesture or browser intervention
      // blur: tab switch or window focus loss mid-drag
      window.addEventListener('pointerup', endDrag, opts)
      window.addEventListener('pointercancel', endDrag, opts)
      window.addEventListener('blur', endDrag, opts)
    }

    window.addEventListener('pointerdown', handlePointerDown, true)
    return () => window.removeEventListener('pointerdown', handlePointerDown, true)
  }, [updateCanvas])

  // Cleanup on unmount: cancel pending rAF then restore DOM state
  React.useEffect(() => {
    return () => {
      cancelPendingRaf()
      if (canvasRef.current.active) {
        exitCanvas()
      }
    }
  }, [cancelPendingRaf, exitCanvas])

  return { toggleCanvas, enterCanvas, exitCanvas, setCanvasZoom, fitCanvasToViewport, zoomCanvasTo100 }
}
