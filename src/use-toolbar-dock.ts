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

function getDockedPosition(edge: DockedEdge, width: number, height: number) {
  const { minX, maxX, minY, maxY } = getToolbarBounds(width, height)
  const centerX = clamp((window.innerWidth - width) / 2, minX, maxX)
  const centerY = clamp((window.innerHeight - height) / 2, minY, maxY)

  switch (edge) {
    case 'bottom':
      return { x: centerX, y: maxY }
    case 'top':
      return { x: centerX, y: minY }
    case 'left':
      return { x: minX, y: centerY }
    case 'right':
      return { x: maxX, y: centerY }
  }
}

function getInitialDockedPosition(edge: DockedEdge) {
  if (typeof window === 'undefined') return { x: 0, y: 0 }
  // Start near the target edge before measurement so we never flash from (0,0).
  return getDockedPosition(edge, 0, 0)
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
  const pointerStartRef = React.useRef({ x: 0, y: 0 })
  const pendingDragRef = React.useRef(false)
  const capturedElementRef = React.useRef<HTMLElement | null>(null)
  const snapTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const transitionTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const transitioningRef = React.useRef(false)
  const recalcRef = React.useRef<(() => void) | null>(null)

  // Compute docked position based on current edge and toolbar size
  const getDockedPos = React.useCallback(() => {
    const el = toolbarRef.current
    if (!el) return { x: 0, y: 0 }
    const rect = el.getBoundingClientRect()
    return getDockedPosition(dockedEdge, rect.width, rect.height)
  }, [dockedEdge, toolbarRef])

  // Docked pixel position (recalculated on edge change / resize)
  const [dockedPos, setDockedPos] = React.useState<{ x: number; y: number }>(() => (
    getInitialDockedPosition(dockedEdge)
  ))
  const [dockedTransitionEnabled, setDockedTransitionEnabled] = React.useState(false)

  // Compute initial position synchronously before the browser paints.
  // useLayoutEffect fires after DOM commit but before paint, so the browser
  // never sees the element at (0,0) — no flash, no fly-in, no visibility hack needed.
  React.useLayoutEffect(() => {
    const el = toolbarRef.current
    if (!el) return
    setDockedPos(getDockedPos())
  }, [getDockedPos, toolbarRef])

  // Keep docked transitions off for the first paint to avoid startup motion.
  React.useEffect(() => {
    const raf = requestAnimationFrame(() => {
      setDockedTransitionEnabled(true)
    })
    return () => cancelAnimationFrame(raf)
  }, [])

  // Predict the final size before an expand/collapse transition starts.
  // Sets the target position immediately so it transitions in parallel with the resize.
  const predictSize = React.useCallback((width: number, height: number) => {
    transitioningRef.current = true
    setDockedPos(getDockedPosition(dockedEdge, width, height))
    if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current)
    transitionTimerRef.current = setTimeout(() => {
      transitioningRef.current = false
      transitionTimerRef.current = null
      // Ensure we always settle to the measured final size/position.
      recalcRef.current?.()
    }, 350)
  }, [dockedEdge])

  // Resize observer + window resize to recalculate docked position.
  // Suppressed during predicted transitions to avoid cascading updates.
  React.useEffect(() => {
    const el = toolbarRef.current
    if (!el) return

    function recalc() {
      if (!el || transitioningRef.current) return
      const rect = el.getBoundingClientRect()
      setDockedPos(getDockedPosition(dockedEdge, rect.width, rect.height))
    }

    recalcRef.current = recalc
    const ro = new ResizeObserver(recalc)
    ro.observe(el)
    window.addEventListener('resize', recalc)

    return () => {
      recalcRef.current = null
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
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    const newEdge = getNearestEdge(centerX, centerY)

    setDockedEdge(newEdge)
    try {
      localStorage.setItem(STORAGE_KEY, newEdge)
    } catch {}

    setDockedPos(getDockedPosition(newEdge, el.offsetWidth, el.offsetHeight))
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

  // Clean up timers on unmount
  React.useEffect(() => {
    return () => {
      if (snapTimerRef.current) clearTimeout(snapTimerRef.current)
      if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current)
    }
  }, [])

  const isDragging = phase === 'dragging'
  const isSnapping = phase === 'snapping'

  const style = React.useMemo((): React.CSSProperties => {
    const base: React.CSSProperties = { position: 'fixed' }

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

    // docked — smooth re-centering when toolbar resizes (e.g. design mode toggle)
    return {
      ...base,
      left: dockedPos.x,
      top: dockedPos.y,
      ...(dockedTransitionEnabled && {
        transition: 'left 300ms cubic-bezier(0.25, 1, 0.5, 1), top 300ms cubic-bezier(0.25, 1, 0.5, 1), box-shadow 150ms ease-out',
      }),
    }
  }, [phase, dragPosition, dockedPos, dockedTransitionEnabled])

  return {
    dockedEdge,
    isDragging,
    isSnapping,
    style,
    predictSize,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerCancel,
  }
}
