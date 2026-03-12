import * as React from 'react'
import { clamp } from './utils'

export const PANEL_WIDTH = 300
export const PANEL_HEIGHT = 420

const STORAGE_KEY = 'direct-edit-panel-position'
const PANEL_MARGIN = 8

interface Position {
  x: number
  y: number
}

function getPanelBounds() {
  const availableX = window.innerWidth - PANEL_WIDTH
  const availableY = window.innerHeight - PANEL_HEIGHT
  const minX = availableX <= 0 ? 0 : Math.min(PANEL_MARGIN, availableX)
  const minY = availableY <= 0 ? 0 : Math.min(PANEL_MARGIN, availableY)
  const maxX = availableX <= 0 ? 0 : Math.max(minX, availableX - PANEL_MARGIN)
  const maxY = availableY <= 0 ? 0 : Math.max(minY, availableY - PANEL_MARGIN)

  return { minX, maxX, minY, maxY }
}

function normalizePosition(position: Position): Position {
  const { minX, maxX, minY, maxY } = getPanelBounds()
  return {
    x: clamp(position.x, minX, maxX),
    y: clamp(position.y, minY, maxY),
  }
}

function snapToEdge(position: Position): Position {
  const { minX, maxX, minY, maxY } = getPanelBounds()
  const centerX = position.x + PANEL_WIDTH / 2
  const centerY = position.y + PANEL_HEIGHT / 2
  const vw = window.innerWidth
  const vh = window.innerHeight

  const distances = {
    top: centerY,
    bottom: vh - centerY,
    left: centerX,
    right: vw - centerX,
  }

  let nearest: 'top' | 'bottom' | 'left' | 'right' = 'right'
  let min = Infinity
  for (const [edge, dist] of Object.entries(distances) as ['top' | 'bottom' | 'left' | 'right', number][]) {
    if (dist < min) {
      min = dist
      nearest = edge
    }
  }

  const freeX = clamp(position.x, minX, maxX)
  const freeY = clamp(position.y, minY, maxY)

  switch (nearest) {
    case 'top':
      return { x: freeX, y: minY }
    case 'bottom':
      return { x: freeX, y: maxY }
    case 'left':
      return { x: minX, y: freeY }
    case 'right':
      return { x: maxX, y: freeY }
  }
}

function parseStoredPosition(raw: string): Position | null {
  const parsed: unknown = JSON.parse(raw)
  if (!parsed || typeof parsed !== 'object') return null

  const candidate = parsed as { x?: unknown; y?: unknown }
  if (typeof candidate.x !== 'number' || !Number.isFinite(candidate.x)) return null
  if (typeof candidate.y !== 'number' || !Number.isFinite(candidate.y)) return null
  return { x: candidate.x, y: candidate.y }
}

function getInitialPosition(): Position {
  if (typeof window === 'undefined') {
    return { x: 0, y: 0 }
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = parseStoredPosition(stored)
      if (parsed) {
        return snapToEdge(parsed)
      }
    }
  } catch {
    // Fall through to default
  }

  return snapToEdge({
    x: window.innerWidth - PANEL_WIDTH - PANEL_MARGIN,
    y: PANEL_MARGIN,
  })
}

export function usePanelPosition() {
  const [position, setPosition] = React.useState<Position>(getInitialPosition)
  const [isDragging, setIsDragging] = React.useState(false)
  const [isSnapping, setIsSnapping] = React.useState(false)
  const [dragOffset, setDragOffset] = React.useState<Position>({ x: 0, y: 0 })
  const snapTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const panelRef = React.useRef<HTMLDivElement>(null)
  const positionRef = React.useRef(position)

  React.useEffect(() => {
    positionRef.current = position
  }, [position])

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!panelRef.current) return

    // Don't start drag when clicking interactive elements (buttons, inputs, etc.)
    const target = e.target as HTMLElement
    if (target.closest('button, a, input, select, textarea, [role="button"]')) return

    const rect = panelRef.current.getBoundingClientRect()
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    })
    setIsDragging(true)
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // Ignore unsupported pointer capture environments.
    }
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return

    const next = normalizePosition({
      x: e.clientX - dragOffset.x,
      y: e.clientY - dragOffset.y,
    })
    positionRef.current = next
    setPosition(next)
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDragging) return

    setIsDragging(false)
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      // Ignore unsupported pointer capture environments.
    }

    const snapped = snapToEdge(positionRef.current)
    positionRef.current = snapped
    setPosition(snapped)
    setIsSnapping(true)

    if (snapTimerRef.current) clearTimeout(snapTimerRef.current)
    snapTimerRef.current = setTimeout(() => {
      snapTimerRef.current = null
      setIsSnapping(false)
    }, 350)

    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(snapped)) } catch {}
  }

  const handlePointerCancel = (e: React.PointerEvent) => {
    if (!isDragging) return
    setIsDragging(false)
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      // Ignore unsupported pointer capture environments.
    }
  }

  React.useEffect(() => {
    function handleResize() {
      setPosition((prev) => {
        const next = snapToEdge(prev)
        positionRef.current = next
        return next
      })
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  React.useEffect(() => {
    return () => {
      if (snapTimerRef.current) clearTimeout(snapTimerRef.current)
    }
  }, [])

  return {
    position,
    isDragging,
    isSnapping,
    panelRef,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerCancel,
  }
}
