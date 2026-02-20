import * as React from 'react'
import { clamp } from './utils'

export type DockedEdge = 'top' | 'bottom' | 'left' | 'right'

const STORAGE_KEY = 'direct-edit-toolbar-dock'
const EDGE_MARGIN = 8
const DRAG_THRESHOLD = 3

function getInitialEdge(): DockedEdge {
  if (typeof window === 'undefined') return 'bottom'
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'top' || stored === 'bottom' || stored === 'left' || stored === 'right') {
      return stored
    }
  } catch {}
  return 'bottom'
}

function getToolbarBounds(width: number, height: number) {
  const availableX = window.innerWidth - width
  const availableY = window.innerHeight - height
  const minX = availableX <= 0 ? 0 : Math.min(EDGE_MARGIN, availableX)
  const maxX = availableX <= 0 ? 0 : Math.max(minX, availableX - EDGE_MARGIN)
  const minY = availableY <= 0 ? 0 : Math.min(EDGE_MARGIN, availableY)
  const maxY = availableY <= 0 ? 0 : Math.max(minY, availableY - EDGE_MARGIN)
  return { minX, maxX, minY, maxY }
}

function getDockedPosition(edge: DockedEdge, width: number, height: number, currentX?: number, currentY?: number) {
  const { minX, maxX, minY, maxY } = getToolbarBounds(width, height)
  const freeX = currentX !== undefined ? clamp(currentX, minX, maxX) : clamp((window.innerWidth - width) / 2, minX, maxX)
  const freeY = currentY !== undefined ? clamp(currentY, minY, maxY) : clamp((window.innerHeight - height) / 2, minY, maxY)

  switch (edge) {
    case 'bottom':
      return { x: freeX, y: maxY }
    case 'top':
      return { x: freeX, y: minY }
    case 'left':
      return { x: minX, y: freeY }
    case 'right':
      return { x: maxX, y: freeY }
  }
}

function getNearestEdge(centerX: number, centerY: number): DockedEdge {
  const vw = window.innerWidth
  const vh = window.innerHeight

  const distances: Record<DockedEdge, number> = {
    top: centerY,
    bottom: vh - centerY,
    left: centerX,
    right: vw - centerX,
  }

  let nearest: DockedEdge = 'bottom'
  let min = Infinity
  for (const [edge, dist] of Object.entries(distances) as [DockedEdge, number][]) {
    if (dist < min) {
      min = dist
      nearest = edge
    }
  }
  return nearest
}

type Phase = 'docked' | 'dragging' | 'snapping'

export function useToolbarDock(toolbarRef: React.RefObject<HTMLDivElement | null>) {
  const [dockedEdge, setDockedEdge] = React.useState<DockedEdge>(getInitialEdge)
  const [phase, setPhase] = React.useState<Phase>('docked')
  const [dragPosition, setDragPosition] = React.useState<{ x: number; y: number } | null>(null)

  const dragOffsetRef = React.useRef({ x: 0, y: 0 })
  const dockedPosRef = React.useRef({ x: 0, y: 0 })
  const pointerStartRef = React.useRef({ x: 0, y: 0 })
  const pendingDragRef = React.useRef(false)
  const capturedElementRef = React.useRef<HTMLElement | null>(null)
  const snapTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  // Compute docked position based on current edge and toolbar size
  const getDockedPos = React.useCallback(() => {
    const el = toolbarRef.current
    if (!el) return { x: 0, y: 0 }
    const rect = el.getBoundingClientRect()
    return getDockedPosition(dockedEdge, rect.width, rect.height)
  }, [dockedEdge, toolbarRef])

  // Docked pixel position (recalculated on edge change / resize)
  const [dockedPos, setDockedPos] = React.useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [ready, setReady] = React.useState(false)

  // Initialize docked position once toolbar mounts
  React.useEffect(() => {
    const el = toolbarRef.current
    if (!el) return
    // Wait one frame so the element has layout
    const raf = requestAnimationFrame(() => {
      const pos = getDockedPos()
      dockedPosRef.current = pos
      setDockedPos(pos)
      setReady(true)
    })
    return () => cancelAnimationFrame(raf)
  }, [getDockedPos, toolbarRef])

  // Resize observer + window resize to recalculate docked position
  React.useEffect(() => {
    const el = toolbarRef.current
    if (!el) return

    function recalc() {
      if (!el) return
      const rect = el.getBoundingClientRect()
      const pos = getDockedPosition(dockedEdge, rect.width, rect.height, dockedPosRef.current.x, dockedPosRef.current.y)
      dockedPosRef.current = pos
      setDockedPos(pos)
    }

    const ro = new ResizeObserver(recalc)
    ro.observe(el)
    window.addEventListener('resize', recalc)

    return () => {
      ro.disconnect()
      window.removeEventListener('resize', recalc)
    }
  }, [dockedEdge, toolbarRef])

  const handlePointerDown = React.useCallback((e: React.PointerEvent) => {
    const el = toolbarRef.current
    if (!el) return

    const rect = el.getBoundingClientRect()
    dragOffsetRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
    pointerStartRef.current = { x: e.clientX, y: e.clientY }
    pendingDragRef.current = true
    capturedElementRef.current = e.currentTarget as HTMLElement
    try {
      capturedElementRef.current.setPointerCapture(e.pointerId)
    } catch {}
  }, [toolbarRef])

  const handlePointerMove = React.useCallback((e: React.PointerEvent) => {
    if (!pendingDragRef.current && phase !== 'dragging') return

    const dx = e.clientX - pointerStartRef.current.x
    const dy = e.clientY - pointerStartRef.current.y

    // Threshold check
    if (pendingDragRef.current) {
      if (Math.sqrt(dx * dx + dy * dy) < DRAG_THRESHOLD) return
      if (snapTimerRef.current) {
        clearTimeout(snapTimerRef.current)
        snapTimerRef.current = null
      }
      pendingDragRef.current = false
      setPhase('dragging')
    }

    const newX = Math.max(0, e.clientX - dragOffsetRef.current.x)
    const newY = Math.max(0, e.clientY - dragOffsetRef.current.y)
    setDragPosition({ x: newX, y: newY })
  }, [phase])

  const handlePointerUp = React.useCallback((e: React.PointerEvent) => {
    if (capturedElementRef.current) {
      try {
        capturedElementRef.current.releasePointerCapture(e.pointerId)
      } catch {}
      capturedElementRef.current = null
    }

    if (pendingDragRef.current) {
      // Never exceeded threshold — treat as click
      pendingDragRef.current = false
      return
    }

    if (phase !== 'dragging') return

    const el = toolbarRef.current
    if (!el) {
      setPhase('docked')
      setDragPosition(null)
      return
    }

    const rect = el.getBoundingClientRect()
    const width = el.offsetWidth
    const height = el.offsetHeight
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    const newEdge = getNearestEdge(centerX, centerY)

    setDockedEdge(newEdge)
    try {
      localStorage.setItem(STORAGE_KEY, newEdge)
    } catch {}

    // Use offsetWidth/Height (unaffected by CSS transforms) for accurate snap positioning
    const newPos = getDockedPosition(newEdge, width, height, rect.left, rect.top)
    dockedPosRef.current = newPos
    setDockedPos(newPos)
    setPhase('snapping')
    setDragPosition(null)

    // After snap animation, settle to docked phase
    if (snapTimerRef.current) clearTimeout(snapTimerRef.current)
    snapTimerRef.current = setTimeout(() => {
      snapTimerRef.current = null
      setPhase('docked')
    }, 350)
  }, [phase, toolbarRef])

  const handlePointerCancel = React.useCallback((e: React.PointerEvent) => {
    if (capturedElementRef.current) {
      try {
        capturedElementRef.current.releasePointerCapture(e.pointerId)
      } catch {}
      capturedElementRef.current = null
    }
    pendingDragRef.current = false
    if (phase === 'dragging') {
      setPhase('docked')
      setDragPosition(null)
    }
  }, [phase])

  // Clean up snap timer on unmount
  React.useEffect(() => {
    return () => {
      if (snapTimerRef.current) clearTimeout(snapTimerRef.current)
    }
  }, [])

  const isDragging = phase === 'dragging'
  const isSnapping = phase === 'snapping'

  const style = React.useMemo((): React.CSSProperties => {
    const base: React.CSSProperties = {
      position: 'fixed',
      ...(!ready && { visibility: 'hidden' as const }),
    }

    if (phase === 'dragging' && dragPosition) {
      return {
        ...base,
        left: dragPosition.x,
        top: dragPosition.y,
        transform: 'rotate(1.5deg) scale(1.04)',
        transition: 'transform 150ms ease-out, box-shadow 150ms ease-out',
        willChange: 'left, top, transform',
      }
    }

    if (phase === 'snapping') {
      const snap = '300ms cubic-bezier(0.34, 1.56, 0.64, 1)'
      return {
        ...base,
        left: dockedPos.x,
        top: dockedPos.y,
        transition: `left ${snap}, top ${snap}, transform 150ms ease-out, box-shadow 150ms ease-out`,
      }
    }

    // docked
    return {
      ...base,
      left: dockedPos.x,
      top: dockedPos.y,
    }
  }, [phase, dragPosition, dockedPos, ready])

  return {
    dockedEdge,
    isDragging,
    isSnapping,
    style,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerCancel,
  }
}
