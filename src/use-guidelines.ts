import * as React from 'react'
import type { Guideline } from './types'
import { collectSnapTargets, findSnap, SNAP_THRESHOLD_PX } from './utils/snap-targets'

const STORAGE_KEY = 'direct-edit-guidelines'

function isGuidelineOrientation(value: unknown): value is Guideline['orientation'] {
  return value === 'horizontal' || value === 'vertical'
}

function isValidGuideline(value: unknown): value is Guideline {
  if (!value || typeof value !== 'object') return false

  const candidate = value as Partial<Guideline>
  return (
    typeof candidate.id === 'string'
    && candidate.id.length > 0
    && isGuidelineOrientation(candidate.orientation)
    && typeof candidate.position === 'number'
    && Number.isFinite(candidate.position)
  )
}

export interface UseGuidelinesResult {
  guidelines: Guideline[]
  activeGuideline: Guideline | null
  dragPosition: number | null
  isCreating: boolean
  isSnapped: boolean
  scrollOffset: { x: number; y: number }
  startCreate: (orientation: 'horizontal' | 'vertical', viewportPosition: number) => void
  startDrag: (guidelineId: string) => void
  deleteGuideline: (guidelineId: string) => void
  clearAll: () => void
}

function loadGuidelines(): Guideline[] {
  if (typeof window === 'undefined') return []
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return []

    const parsed: unknown = JSON.parse(stored)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isValidGuideline)
  } catch {
    return []
  }
}

export function getStoredGuidelines(): Guideline[] {
  return loadGuidelines()
}

function saveGuidelines(guidelines: Guideline[]) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(guidelines))
  } catch {
    // ignore
  }
}

let idCounter = 0
function generateId(): string {
  return `gl-${Date.now()}-${idCounter++}`
}

const RULER_SIZE = 20
const SNAP_VELOCITY_THRESHOLD = 3 // px/ms — snap only when dragging slower than this

function viewportToCssCoord(
  hostElement: HTMLElement | null,
  value: number,
  axis: 'x' | 'y',
): number {
  if (!hostElement) return value
  const rect = hostElement.getBoundingClientRect()
  const origin = axis === 'x' ? rect.left : rect.top
  const size = axis === 'x' ? rect.width : rect.height
  const cssSize = axis === 'x' ? hostElement.offsetWidth : hostElement.offsetHeight
  if (size === 0) return value
  return (value - origin) * (cssSize / size)
}

export function useGuidelines(
  enabled: boolean,
  hostElement?: HTMLElement | null,
  canvas?: { active: boolean; zoom: number; panX: number; panY: number } | null,
): UseGuidelinesResult {
  const [guidelines, setGuidelines] = React.useState<Guideline[]>([])
  const [hydrated, setHydrated] = React.useState(false)
  const [activeGuidelineId, setActiveGuidelineId] = React.useState<string | null>(null)
  const [dragPosition, setDragPosition] = React.useState<number | null>(null)
  const [isCreating, setIsCreating] = React.useState(false)
  const [scrollOffset, setScrollOffset] = React.useState({ x: 0, y: 0 })

  const hostRef = React.useRef<HTMLElement | null>(hostElement ?? null)
  hostRef.current = hostElement ?? null

  const canvasRef = React.useRef(canvas)
  canvasRef.current = canvas

  const [dragging, setDragging] = React.useState(false)

  const guidelinesRef = React.useRef(guidelines)
  guidelinesRef.current = guidelines

  const dragInfoRef = React.useRef<{
    guidelineId: string
    orientation: 'horizontal' | 'vertical'
    isCreating: boolean
  } | null>(null)

  const snapTargetsRef = React.useRef<number[]>([])
  const isSnappedRef = React.useRef(false)
  const [isSnapped, setIsSnapped] = React.useState(false)

  // Hydrate from localStorage after mount (SSR-safe)
  React.useEffect(() => {
    setGuidelines(loadGuidelines())
    setHydrated(true)
  }, [])

  // Persist to localStorage on change
  React.useEffect(() => {
    if (!hydrated) return
    saveGuidelines(guidelines)
  }, [guidelines, hydrated])

  // Track scroll and resize
  React.useEffect(() => {
    if (!enabled) return

    function update() {
      setScrollOffset((prev) => {
        const x = window.scrollX
        const y = window.scrollY
        return prev.x === x && prev.y === y ? prev : { x, y }
      })
    }

    update()
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    window.addEventListener('direct-edit-canvas-change', update)
    return () => {
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
      window.removeEventListener('direct-edit-canvas-change', update)
    }
  }, [enabled])

  const endDrag = React.useCallback(() => {
    const wasCreating = dragInfoRef.current?.isCreating ?? false
    dragInfoRef.current = null
    snapTargetsRef.current = []
    isSnappedRef.current = false
    setIsSnapped(false)
    setDragging(false)
    setActiveGuidelineId(null)
    setDragPosition(null)
    if (wasCreating) setIsCreating(false)
  }, [])

  // Attach drag listeners via effect so cleanup happens on unmount
  React.useEffect(() => {
    if (!dragging) return

    const info = dragInfoRef.current
    if (!info) return

    const { guidelineId, orientation } = info
    const axis = orientation === 'horizontal' ? 'y' as const : 'x' as const

    let lastPos = NaN
    let lastTime = 0

    function onPointerMove(e: PointerEvent) {
      const rawViewportPos = orientation === 'horizontal' ? e.clientY : e.clientX

      // Compute velocity to gate snapping — only snap when dragging slowly
      const now = performance.now()
      const dt = now - lastTime
      const velocity = dt > 0 && !Number.isNaN(lastPos)
        ? Math.abs(rawViewportPos - lastPos) / dt
        : 0
      lastPos = rawViewportPos
      lastTime = now

      let effectiveViewportPos = rawViewportPos
      let snapped = false
      if (velocity < SNAP_VELOCITY_THRESHOLD) {
        const snapResult = findSnap(rawViewportPos, snapTargetsRef.current, SNAP_THRESHOLD_PX)
        if (snapResult !== null) {
          effectiveViewportPos = snapResult
          snapped = true
        }
      }

      isSnappedRef.current = snapped
      setIsSnapped(snapped)
      const pos = viewportToCssCoord(hostRef.current, effectiveViewportPos, axis)
      setDragPosition(pos)
      const c = canvasRef.current
      let storedPosition: number
      if (c?.active) {
        const pan = orientation === 'horizontal' ? (c.panY || 0) : (c.panX || 0)
        storedPosition = pos / (c.zoom || 1) - pan
      } else {
        const currentScroll = orientation === 'horizontal' ? window.scrollY : window.scrollX
        storedPosition = pos + currentScroll
      }
      setGuidelines((prev) =>
        prev.map((g) => (g.id === guidelineId ? { ...g, position: storedPosition } : g)),
      )
    }

    function onPointerUp(e: PointerEvent) {
      const rawViewportPos = orientation === 'horizontal' ? e.clientY : e.clientX
      const snapResult = findSnap(rawViewportPos, snapTargetsRef.current, SNAP_THRESHOLD_PX)
      const pos = viewportToCssCoord(hostRef.current, snapResult ?? rawViewportPos, axis)
      if (pos <= RULER_SIZE) {
        setGuidelines((prev) => prev.filter((g) => g.id !== guidelineId))
      }
      endDrag()
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)

    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }
  }, [dragging, endDrag])

  // Cancel drag when rulers are disabled mid-drag
  React.useEffect(() => {
    if (!enabled && dragging) {
      endDrag()
    }
  }, [enabled, dragging, endDrag])

  const activeGuideline = React.useMemo(
    () => guidelines.find((g) => g.id === activeGuidelineId) ?? null,
    [guidelines, activeGuidelineId],
  )

  const startCreate = React.useCallback(
    (orientation: 'horizontal' | 'vertical', viewportPosition: number) => {
      const axis = orientation === 'horizontal' ? 'y' as const : 'x' as const
      const pos = viewportToCssCoord(hostRef.current, viewportPosition, axis)
      const id = generateId()
      const c = canvasRef.current
      let storedPosition: number
      if (c?.active) {
        const pan = orientation === 'horizontal' ? (c.panY || 0) : (c.panX || 0)
        storedPosition = pos / (c.zoom || 1) - pan
      } else {
        const scrollPos = orientation === 'horizontal' ? window.scrollY : window.scrollX
        storedPosition = pos + scrollPos
      }
      const newGuideline: Guideline = { id, orientation, position: storedPosition }

      snapTargetsRef.current = collectSnapTargets(orientation)
      setGuidelines((prev) => [...prev, newGuideline])
      setActiveGuidelineId(id)
      setDragPosition(pos)
      setIsCreating(true)
      dragInfoRef.current = { guidelineId: id, orientation, isCreating: true }
      setDragging(true)
    },
    [],
  )

  const startDrag = React.useCallback((guidelineId: string) => {
    const guideline = guidelinesRef.current.find((g) => g.id === guidelineId)
    if (!guideline) return

    snapTargetsRef.current = collectSnapTargets(guideline.orientation)
    const c = canvasRef.current
    let viewportPos: number
    if (c?.active) {
      const pan = guideline.orientation === 'horizontal' ? (c.panY || 0) : (c.panX || 0)
      viewportPos = (guideline.position + pan) * (c.zoom || 1)
    } else {
      const scrollPos = guideline.orientation === 'horizontal' ? window.scrollY : window.scrollX
      viewportPos = guideline.position - scrollPos
    }
    setActiveGuidelineId(guidelineId)
    setDragPosition(viewportPos)
    dragInfoRef.current = { guidelineId, orientation: guideline.orientation, isCreating: false }
    setDragging(true)
  }, [])

  const deleteGuideline = React.useCallback((guidelineId: string) => {
    setGuidelines((prev) => prev.filter((g) => g.id !== guidelineId))
  }, [])

  const clearAll = React.useCallback(() => {
    setGuidelines([])
  }, [])

  return {
    guidelines,
    activeGuideline,
    dragPosition,
    isCreating,
    isSnapped,
    scrollOffset,
    startCreate,
    startDrag,
    deleteGuideline,
    clearAll,
  }
}
