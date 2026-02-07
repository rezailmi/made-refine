import * as React from 'react'
import type { Guideline } from './types'

const STORAGE_KEY = 'direct-edit-guidelines'

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
    return stored ? JSON.parse(stored) : []
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

export function useGuidelines(enabled: boolean): UseGuidelinesResult {
  const [guidelines, setGuidelines] = React.useState<Guideline[]>(loadGuidelines)
  const [activeGuidelineId, setActiveGuidelineId] = React.useState<string | null>(null)
  const [dragPosition, setDragPosition] = React.useState<number | null>(null)
  const [isCreating, setIsCreating] = React.useState(false)
  const [scrollOffset, setScrollOffset] = React.useState({
    x: typeof window !== 'undefined' ? window.scrollX : 0,
    y: typeof window !== 'undefined' ? window.scrollY : 0,
  })

  const [dragging, setDragging] = React.useState(false)

  const guidelinesRef = React.useRef(guidelines)
  guidelinesRef.current = guidelines

  const dragInfoRef = React.useRef<{
    guidelineId: string
    orientation: 'horizontal' | 'vertical'
    isCreating: boolean
  } | null>(null)

  // Persist to localStorage on change
  React.useEffect(() => {
    saveGuidelines(guidelines)
  }, [guidelines])

  // Track scroll and resize
  React.useEffect(() => {
    if (!enabled) return

    function update() {
      setScrollOffset({ x: window.scrollX, y: window.scrollY })
    }

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

    function onPointerMove(e: PointerEvent) {
      const pos = orientation === 'horizontal' ? e.clientY : e.clientX
      setDragPosition(pos)
      const currentScroll = orientation === 'horizontal' ? window.scrollY : window.scrollX
      setGuidelines((prev) =>
        prev.map((g) => (g.id === guidelineId ? { ...g, position: pos + currentScroll } : g)),
      )
    }

    function onPointerUp(e: PointerEvent) {
      const pos = orientation === 'horizontal' ? e.clientY : e.clientX
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
      const scrollPos = orientation === 'horizontal' ? window.scrollY : window.scrollX
      const id = generateId()
      const newGuideline: Guideline = { id, orientation, position: viewportPosition + scrollPos }

      setGuidelines((prev) => [...prev, newGuideline])
      setActiveGuidelineId(id)
      setDragPosition(viewportPosition)
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
