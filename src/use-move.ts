import * as React from 'react'
import type { DragState, DropIndicator } from './types'
import {
  findContainerAtPoint,
  findLayoutContainerAtPoint,
  calculateDropPosition,
  detectChildrenDirection,
} from './utils'

export type MoveMode = 'free' | 'reorder' | 'position'

export interface MoveInfo {
  originalParent: HTMLElement
  originalPreviousSibling: HTMLElement | null
  originalNextSibling: HTMLElement | null
  mode?: MoveMode
  positionDelta?: { x: number; y: number }
}

export interface UseMoveOptions {
  onMoveComplete?: (element: HTMLElement, moveInfo: MoveInfo | null) => void
}

export interface UseMoveDropTarget {
  container: HTMLElement
  insertBefore: HTMLElement | null
  flexDirection: 'row' | 'row-reverse' | 'column' | 'column-reverse'
}

export interface StartDragOptions {
  constrainToOriginalParent?: boolean
  mode?: MoveMode
}

export interface UseMoveResult {
  dragState: DragState
  dropTarget: UseMoveDropTarget | null
  dropIndicator: DropIndicator | null
  startDrag: (e: React.PointerEvent, element: HTMLElement, options?: StartDragOptions) => void
}

const INITIAL_DRAG_STATE: DragState = {
  isDragging: false,
  draggedElement: null,
  originalParent: null,
  originalPreviousSibling: null,
  originalNextSibling: null,
  ghostPosition: { x: 0, y: 0 },
  dragOffset: { x: 0, y: 0 },
}

interface ActiveDragOptions {
  constrainToOriginalParent: boolean
  mode: MoveMode
}

const DEFAULT_DRAG_OPTIONS: ActiveDragOptions = {
  constrainToOriginalParent: false,
  mode: 'free',
}

function normalizeStartDragOptions(options?: StartDragOptions): ActiveDragOptions {
  const mode = options?.mode ?? (options?.constrainToOriginalParent ? 'reorder' : 'free')
  return {
    mode,
    constrainToOriginalParent: mode === 'reorder' || Boolean(options?.constrainToOriginalParent),
  }
}

export function useMove({ onMoveComplete }: UseMoveOptions): UseMoveResult {
  const [dragState, setDragState] = React.useState<DragState>(INITIAL_DRAG_STATE)
  const [dropTarget, setDropTarget] = React.useState<UseMoveDropTarget | null>(null)
  const [dropIndicator, setDropIndicator] = React.useState<DropIndicator | null>(null)

  const dragStateRef = React.useRef(dragState)
  const dropTargetRef = React.useRef(dropTarget)
  const onMoveCompleteRef = React.useRef(onMoveComplete)
  const dragOptionsRef = React.useRef<ActiveDragOptions>(DEFAULT_DRAG_OPTIONS)

  React.useEffect(() => {
    dragStateRef.current = dragState
    dropTargetRef.current = dropTarget
    onMoveCompleteRef.current = onMoveComplete
  })

  const cancelDrag = React.useCallback(() => {
    const current = dragStateRef.current
    if (current.draggedElement) {
      current.draggedElement.style.opacity = ''
    }
    dragOptionsRef.current = DEFAULT_DRAG_OPTIONS
    setDragState(INITIAL_DRAG_STATE)
    setDropTarget(null)
    setDropIndicator(null)
  }, [])

  const completeDrag = React.useCallback(() => {
    const current = dragStateRef.current
    const target = dropTargetRef.current
    const { draggedElement, originalParent, originalPreviousSibling, originalNextSibling } = current

    if (!draggedElement) {
      cancelDrag()
      return
    }

    draggedElement.style.opacity = ''
    const dragMode = dragOptionsRef.current.mode
    dragOptionsRef.current = DEFAULT_DRAG_OPTIONS

    let moveInfo: MoveInfo | null = null

    if (dragMode === 'position') {
      if (target) {
        const isSamePosition = target.container === originalParent
          && target.insertBefore === originalNextSibling
        const isInvalidTarget = target.container === draggedElement
          || draggedElement.contains(target.container)
          || (target.insertBefore ? draggedElement.contains(target.insertBefore) : false)

        if (!isSamePosition && !isInvalidTarget) {
          try {
            if (target.insertBefore) {
              target.container.insertBefore(draggedElement, target.insertBefore)
            } else {
              target.container.appendChild(draggedElement)
            }
            if (originalParent) {
              moveInfo = { originalParent, originalPreviousSibling, originalNextSibling, mode: 'free' }
            }
          } catch { /* ignore invalid DOM moves */ }
        }
      }
      if (!moveInfo) {
        const rect = draggedElement.getBoundingClientRect()
        const deltaX = current.ghostPosition.x - rect.left
        const deltaY = current.ghostPosition.y - rect.top
        if ((Math.abs(deltaX) > 0.5 || Math.abs(deltaY) > 0.5) && originalParent) {
          moveInfo = { originalParent, originalPreviousSibling, originalNextSibling, mode: 'position', positionDelta: { x: deltaX, y: deltaY } }
        }
      }
    } else if (target) {
      const isSamePosition =
        target.container === originalParent &&
        target.insertBefore === originalNextSibling
      const isInvalidTarget =
        target.container === draggedElement ||
        draggedElement.contains(target.container) ||
        (target.insertBefore ? draggedElement.contains(target.insertBefore) : false)

      if (!isSamePosition && !isInvalidTarget) {
        try {
          if (target.insertBefore) {
            target.container.insertBefore(draggedElement, target.insertBefore)
          } else {
            target.container.appendChild(draggedElement)
          }
          if (originalParent) {
            moveInfo = { originalParent, originalPreviousSibling, originalNextSibling, mode: dragMode }
          }
        } catch {
          // Ignore invalid DOM moves and leave the element in place.
        }
      }
    }

    setDragState(INITIAL_DRAG_STATE)
    setDropTarget(null)
    setDropIndicator(null)

    onMoveCompleteRef.current?.(draggedElement, moveInfo)
  }, [cancelDrag])

  const startDrag = React.useCallback(
    (e: React.PointerEvent, element: HTMLElement, options?: StartDragOptions) => {
      const rect = element.getBoundingClientRect()
      const parent = element.parentElement
      const previousSibling = element.previousElementSibling as HTMLElement | null
      const nextSibling = element.nextElementSibling as HTMLElement | null
      dragOptionsRef.current = normalizeStartDragOptions(options)

      setDragState({
        isDragging: true,
        draggedElement: element,
        originalParent: parent,
        originalPreviousSibling: previousSibling,
        originalNextSibling: nextSibling,
        ghostPosition: { x: rect.left, y: rect.top },
        dragOffset: { x: e.clientX - rect.left, y: e.clientY - rect.top },
      })

      element.style.opacity = '0.5'
    },
    []
  )

  React.useEffect(() => {
    if (!dragState.isDragging) return

    function handlePointerMove(e: PointerEvent) {
      const current = dragStateRef.current
      const { draggedElement, dragOffset, originalParent } = current

      setDragState((prev) => ({
        ...prev,
        ghostPosition: {
          x: e.clientX - dragOffset.x,
          y: e.clientY - dragOffset.y,
        },
      }))

      if (dragOptionsRef.current.mode === 'position') {
        const layoutContainer = findLayoutContainerAtPoint(
          e.clientX, e.clientY, draggedElement, originalParent,
        )
        if (layoutContainer && draggedElement) {
          const dropPos = calculateDropPosition(layoutContainer, e.clientX, e.clientY, draggedElement)
          if (dropPos) {
            setDropTarget({
              container: layoutContainer,
              insertBefore: dropPos.insertBefore,
              flexDirection: (() => {
                const { axis, reversed } = detectChildrenDirection(layoutContainer, draggedElement)
                if (axis === 'horizontal') return reversed ? 'row-reverse' : 'row'
                return reversed ? 'column-reverse' : 'column'
              })(),
            })
            setDropIndicator(dropPos.indicator)
          }
        } else {
          setDropTarget(null)
          setDropIndicator(null)
        }
        return
      }

      const container = dragOptionsRef.current.constrainToOriginalParent
        ? originalParent
        : findContainerAtPoint(
            e.clientX,
            e.clientY,
            draggedElement,
            originalParent
          )

      if (container && draggedElement) {
        const dropPos = calculateDropPosition(
          container,
          e.clientX,
          e.clientY,
          draggedElement
        )

        if (dropPos) {
          setDropTarget({
            container,
            insertBefore: dropPos.insertBefore,
            flexDirection: (() => {
              const { axis, reversed } = detectChildrenDirection(container, draggedElement)
              if (axis === 'horizontal') return reversed ? 'row-reverse' : 'row'
              return reversed ? 'column-reverse' : 'column'
            })(),
          })
          setDropIndicator(dropPos.indicator)
        }
      } else {
        setDropTarget(null)
        setDropIndicator(null)
      }
    }

    function handlePointerUp() {
      completeDrag()
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        cancelDrag()
      }
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [dragState.isDragging, completeDrag, cancelDrag])

  return {
    dragState,
    dropTarget,
    dropIndicator,
    startDrag,
  }
}
