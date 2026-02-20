import * as React from 'react'
import type { Guideline } from './types'

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

export function useGuidelines(enabled: boolean, hostElement?: HTMLElement | null): UseGuidelinesResult {
  const [guidelines, setGuidelines] = React.useState<Guideline[]>([])
  const [hydrated, setHydrated] = React.useState(false)
  const [activeGuidelineId, setActiveGuidelineId] = React.useState<string | null>(null)
  const [dragPosition, setDragPosition] = React.useState<number | null>(null)
  const [isCreating, setIsCreating] = React.useState(false)
  const [scrollOffset, setScrollOffset] = React.useState({ x: 0, y: 0 })

  const hostRef = React.useRef<HTMLElement | null>(hostElement ?? null)
  hostRef.current = hostElement ?? null

  const [dragging, setDragging] = React.useState(false)

  const guidelinesRef = React.useRef(guidelines)
  guidelinesRef.current = guidelines

  const dragInfoRef = React.useRef<{
    guidelineId: string
    orientation: 'horizontal' | 'vertical'
    isCreating: boolean
  } | null>(null)

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
      setScrollOffset({ x: window.scrollX, y: window.scrollY })
    }

    update()
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [enabled])

  const endDrag = React.useCallback(() => {
    const wasCreating = dragInfoRef.current?.isCreating ?? false
    dragInfoRef.current = null
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

    function pointerToPos(e: PointerEvent): number {
      const raw = orientation === 'horizontal' ? e.clientY : e.clientX
      return viewportToCssCoord(hostRef.current, raw, axis)
    }

    function onPointerMove(e: PointerEvent) {
      const pos = pointerToPos(e)
      setDragPosition(pos)
      const currentScroll = orientation === 'horizontal' ? window.scrollY : window.scrollX
      setGuidelines((prev) =>
        prev.map((g) => (g.id === guidelineId ? { ...g, position: pos + currentScroll } : g)),
      )
    }

    function onPointerUp(e: PointerEvent) {
      const pos = pointerToPos(e)
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
      const scrollPos = orientation === 'horizontal' ? window.scrollY : window.scrollX
      const id = generateId()
      const newGuideline: Guideline = { id, orientation, position: pos + scrollPos }

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

    const scrollPos = guideline.orientation === 'horizontal' ? window.scrollY : window.scrollX
    setActiveGuidelineId(guidelineId)
    setDragPosition(guideline.position - scrollPos)
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
    scrollOffset,
    startCreate,
    startDrag,
    deleteGuideline,
    clearAll,
  }
}
