import * as React from 'react'
import type { DirectEditState } from './types'

const MIN_ZOOM = 0.1
const MAX_ZOOM = 5.0

export interface UseCanvasOptions {
  stateRef: React.MutableRefObject<DirectEditState>
  setState: React.Dispatch<React.SetStateAction<DirectEditState>>
}

export interface UseCanvasReturn {
  toggleCanvas: () => void
  exitCanvas: () => void
  setCanvasZoom: (zoom: number) => void
  fitCanvasToViewport: () => void
  zoomCanvasTo100: () => void
}

export function useCanvas({ stateRef, setState }: UseCanvasOptions): UseCanvasReturn {
  // Synchronous ref for canvas state (avoids stale closures in event handlers)
  const canvasRef = React.useRef({ active: false, zoom: 1, panX: 0, panY: 0 })

  // Saved state for restoring on exit
  const savedScrollRef = React.useRef({ x: 0, y: 0 })
  const savedBodyOverflowRef = React.useRef('')
  const savedHtmlOverflowRef = React.useRef('')
  const savedBodyDimensionsRef = React.useRef({ width: 0, height: 0 })

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

  const updateCanvas = React.useCallback((zoom: number, panX: number, panY: number) => {
    canvasRef.current = { ...canvasRef.current, zoom, panX, panY }
    applyTransform(zoom, panX, panY)
    setState((prev) => ({
      ...prev,
      canvas: { ...prev.canvas, zoom, panX, panY },
    }))
    dispatchCanvasChange()
  }, [applyTransform, dispatchCanvasChange, setState])

  const enterCanvas = React.useCallback(() => {
    const scrollX = window.scrollX
    const scrollY = window.scrollY
    savedScrollRef.current = { x: scrollX, y: scrollY }
    savedBodyOverflowRef.current = document.body.style.overflow
    savedHtmlOverflowRef.current = document.documentElement.style.overflow
    savedBodyDimensionsRef.current = {
      width: document.body.scrollWidth,
      height: document.body.scrollHeight,
    }

    const existingTransform = document.body.style.transform
    if (existingTransform && existingTransform !== 'none' && existingTransform !== '') {
      console.warn('[made-refine] canvas mode: overriding existing body transform:', existingTransform)
    }

    // Reset window scroll so transform does the positioning
    window.scrollTo(0, 0)
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'

    // Initial pan compensates for saved scroll position
    const initialPanX = -scrollX
    const initialPanY = -scrollY
    applyTransform(1, initialPanX, initialPanY)

    canvasRef.current = { active: true, zoom: 1, panX: initialPanX, panY: initialPanY }
    setState((prev) => ({
      ...prev,
      canvas: { active: true, zoom: 1, panX: initialPanX, panY: initialPanY },
    }))
    dispatchCanvasChange()
  }, [applyTransform, dispatchCanvasChange, setState])

  const exitCanvas = React.useCallback(() => {
    document.body.style.transform = ''
    document.body.style.transformOrigin = ''
    document.body.style.overflow = savedBodyOverflowRef.current
    document.documentElement.style.overflow = savedHtmlOverflowRef.current
    document.body.style.cursor = ''

    window.scrollTo(savedScrollRef.current.x, savedScrollRef.current.y)

    canvasRef.current = { active: false, zoom: 1, panX: 0, panY: 0 }
    setState((prev) => ({
      ...prev,
      canvas: { active: false, zoom: 1, panX: 0, panY: 0 },
    }))
    dispatchCanvasChange()
  }, [dispatchCanvasChange, setState])

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
    // Center content: at this zoom, the content width in viewport = zoom * bodyWidth
    // We want it centered, so panX = (viewportWidth/zoom - bodyWidth) / 2
    const panX = (window.innerWidth / zoom - bodyWidth) / 2
    const panY = (window.innerHeight / zoom - bodyHeight) / 2
    updateCanvas(zoom, panX, panY)
  }, [updateCanvas])

  const zoomCanvasTo100 = React.useCallback(() => {
    const c = canvasRef.current
    if (!c.active) return
    updateCanvas(1, 0, 0)
  }, [updateCanvas])

  // Wheel handler: Ctrl/Cmd+scroll = zoom, plain scroll = pan
  React.useEffect(() => {
    function handleWheel(e: WheelEvent) {
      const c = canvasRef.current
      if (!c.active) return
      e.preventDefault()

      if (e.ctrlKey || e.metaKey) {
        const zoomFactor = Math.exp(-e.deltaY * 0.005)
        const oldZoom = c.zoom
        const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, oldZoom * zoomFactor))
        const cx = e.clientX
        const cy = e.clientY
        // Zoom-to-cursor: newPan = oldPan + cursor * (1/newZoom - 1/oldZoom)
        const newPanX = c.panX + cx * (1 / newZoom - 1 / oldZoom)
        const newPanY = c.panY + cy * (1 / newZoom - 1 / oldZoom)
        updateCanvas(newZoom, newPanX, newPanY)
      } else {
        // Pan: divide by zoom to convert viewport delta to content-space delta
        const newPanX = c.panX - e.deltaX / c.zoom
        const newPanY = c.panY - e.deltaY / c.zoom
        updateCanvas(c.zoom, newPanX, newPanY)
      }
    }

    window.addEventListener('wheel', handleWheel, { passive: false })
    return () => window.removeEventListener('wheel', handleWheel)
  }, [updateCanvas])

  // Space key tracking
  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.code !== 'Space' || e.repeat) return
      if (!canvasRef.current.active) return
      const active = document.activeElement
      const isInput =
        active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement ||
        (active instanceof HTMLElement && active.isContentEditable)
      if (isInput) return
      spaceHeldRef.current = true
      if (!isDraggingRef.current) {
        document.body.style.cursor = 'grab'
      }
      e.preventDefault()
    }

    function handleKeyUp(e: KeyboardEvent) {
      if (e.code !== 'Space') return
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

  // Pointer drag for pan (Space+drag or middle mouse button)
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

      function handlePointerMove(moveE: PointerEvent) {
        const current = canvasRef.current
        // Mouse delta in viewport pixels → convert to content-space delta
        const dx = (moveE.clientX - dragStartRef.current.x) / current.zoom
        const dy = (moveE.clientY - dragStartRef.current.y) / current.zoom
        const newPanX = dragStartRef.current.panX + dx
        const newPanY = dragStartRef.current.panY + dy
        updateCanvas(current.zoom, newPanX, newPanY)
      }

      function handlePointerUp() {
        isDraggingRef.current = false
        document.body.style.cursor = spaceHeldRef.current ? 'grab' : ''
        window.removeEventListener('pointermove', handlePointerMove)
        window.removeEventListener('pointerup', handlePointerUp)
      }

      window.addEventListener('pointermove', handlePointerMove)
      window.addEventListener('pointerup', handlePointerUp)
    }

    window.addEventListener('pointerdown', handlePointerDown, true)
    return () => window.removeEventListener('pointerdown', handlePointerDown, true)
  }, [updateCanvas])

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      if (canvasRef.current.active) {
        exitCanvas()
      }
    }
  }, [exitCanvas])

  return { toggleCanvas, exitCanvas, setCanvasZoom, fitCanvasToViewport, zoomCanvasTo100 }
}
