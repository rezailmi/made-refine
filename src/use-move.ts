import * as React from 'react'
import type { DragState, DropIndicator } from './types'
import {
  findContainerAtPoint,
  calculateDropPosition,
  getFlexDirection,
} from './utils'

interface UseMoveOptions {
  onMoveComplete?: (element: HTMLElement) => void
}

interface DropTarget {
  container: HTMLElement
  insertBefore: HTMLElement | null
  flexDirection: 'row' | 'row-reverse' | 'column' | 'column-reverse'
}

interface UseMoveResult {
  dragState: DragState
  dropTarget: DropTarget | null
  dropIndicator: DropIndicator | null
  startDrag: (e: React.PointerEvent, element: HTMLElement) => void
}

const INITIAL_DRAG_STATE: DragState = {
  isDragging: false,
  draggedElement: null,
  originalParent: null,
  originalNextSibling: null,
  ghostPosition: { x: 0, y: 0 },
  dragOffset: { x: 0, y: 0 },
}

export function useMove({ onMoveComplete }: UseMoveOptions): UseMoveResult {
  const [dragState, setDragState] = React.useState<DragState>(INITIAL_DRAG_STATE)
  const [dropTarget, setDropTarget] = React.useState<DropTarget | null>(null)
  const [dropIndicator, setDropIndicator] = React.useState<DropIndicator | null>(null)

  const dragStateRef = React.useRef(dragState)
  const dropTargetRef = React.useRef(dropTarget)
  const onMoveCompleteRef = React.useRef(onMoveComplete)

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
    setDragState(INITIAL_DRAG_STATE)
    setDropTarget(null)
    setDropIndicator(null)
  }, [])

  const completeDrag = React.useCallback(() => {
    const current = dragStateRef.current
    const target = dropTargetRef.current
    const { draggedElement, originalParent, originalNextSibling } = current

    if (!draggedElement) {
      cancelDrag()
      return
    }

    draggedElement.style.opacity = ''

    if (target) {
      const isSamePosition =
        target.container === originalParent &&
        target.insertBefore === originalNextSibling

      if (!isSamePosition) {
        if (target.insertBefore) {
          target.container.insertBefore(draggedElement, target.insertBefore)
        } else {
          target.container.appendChild(draggedElement)
        }
      }
    }

    setDragState(INITIAL_DRAG_STATE)
    setDropTarget(null)
    setDropIndicator(null)

    if (onMoveCompleteRef.current && draggedElement) {
      onMoveCompleteRef.current(draggedElement)
    }
  }, [cancelDrag])

  const startDrag = React.useCallback(
    (e: React.PointerEvent, element: HTMLElement) => {
      const rect = element.getBoundingClientRect()
      const parent = element.parentElement
      const nextSibling = element.nextElementSibling as HTMLElement | null

      setDragState({
        isDragging: true,
        draggedElement: element,
        originalParent: parent,
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
      const { draggedElement, dragOffset } = current

      setDragState((prev) => ({
        ...prev,
        ghostPosition: {
          x: e.clientX - dragOffset.x,
          y: e.clientY - dragOffset.y,
        },
      }))

      const container = findContainerAtPoint(
        e.clientX,
        e.clientY,
        draggedElement
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
            flexDirection: getFlexDirection(container),
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
