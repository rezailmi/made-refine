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
  /** When true, the element was reparented — clear any position/left/top inline styles from prior position-mode moves. */
  resetPositionOffsets?: boolean
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

function resolveFlexDirection(
  container: HTMLElement,
  draggedElement: HTMLElement,
): UseMoveDropTarget['flexDirection'] {
  const { axis, reversed } = detectChildrenDirection(container, draggedElement)
  if (axis === 'horizontal') return reversed ? 'row-reverse' : 'row'
  return reversed ? 'column-reverse' : 'column'
}

function tryReparent(
  draggedElement: HTMLElement,
  target: UseMoveDropTarget,
  originalParent: HTMLElement | null,
  originalNextSibling: HTMLElement | null,
): boolean {
  const isSamePosition = target.container === originalParent
    && target.insertBefore === originalNextSibling
  const isInvalidTarget = target.container === draggedElement
    || draggedElement.contains(target.container)
    || (target.insertBefore ? draggedElement.contains(target.insertBefore) : false)
  if (isSamePosition || isInvalidTarget) return false
  try {
    if (target.insertBefore) {
      target.container.insertBefore(draggedElement, target.insertBefore)
    } else {
      target.container.appendChild(draggedElement)
    }
    return true
  } catch { return false }
}

export function useMove({ onMoveComplete }: UseMoveOptions): UseMoveResult {
  const [dragState, setDragState] = React.useState<DragState>(INITIAL_DRAG_STATE)
  const [dropTarget, setDropTarget] = React.useState<UseMoveDropTarget | null>(null)
  const [dropIndicator, setDropIndicator] = React.useState<DropIndicator | null>(null)

  const dragStateRef = React.useRef(dragState)
  const dropTargetRef = React.useRef(dropTarget)
  const onMoveCompleteRef = React.useRef(onMoveComplete)
  const dragOptionsRef = React.useRef<ActiveDragOptions>(DEFAULT_DRAG_OPTIONS)
  const initialRectRef = React.useRef<{ x: number; y: number; scaleX: number; scaleY: number }>(
    { x: 0, y: 0, scaleX: 1, scaleY: 1 }
  )
  const originalTransformRef = React.useRef('')

  React.useEffect(() => {
    dragStateRef.current = dragState
    dropTargetRef.current = dropTarget
    onMoveCompleteRef.current = onMoveComplete
  })

  const cancelDrag = React.useCallback(() => {
    const current = dragStateRef.current
    if (current.draggedElement) {
      current.draggedElement.style.opacity = ''
      current.draggedElement.style.transform = originalTransformRef.current
    }
    originalTransformRef.current = ''
    initialRectRef.current = { x: 0, y: 0, scaleX: 1, scaleY: 1 }
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

    const { scaleX, scaleY } = initialRectRef.current
    draggedElement.style.transform = originalTransformRef.current
    draggedElement.style.opacity = ''
    originalTransformRef.current = ''
    initialRectRef.current = { x: 0, y: 0, scaleX: 1, scaleY: 1 }
    const dragMode = dragOptionsRef.current.mode
    dragOptionsRef.current = DEFAULT_DRAG_OPTIONS

    let moveInfo: MoveInfo | null = null

    if (dragMode === 'position') {
      if (target && tryReparent(draggedElement, target, originalParent, originalNextSibling)) {
        if (originalParent) {
          moveInfo = { originalParent, originalPreviousSibling, originalNextSibling, mode: 'free', resetPositionOffsets: true }
        }
      }
      if (!moveInfo) {
        const rect = draggedElement.getBoundingClientRect()
        const deltaX = (current.ghostPosition.x - rect.left) / scaleX
        const deltaY = (current.ghostPosition.y - rect.top) / scaleY
        if ((Math.abs(deltaX) > 0.5 || Math.abs(deltaY) > 0.5) && originalParent) {
          moveInfo = { originalParent, originalPreviousSibling, originalNextSibling, mode: 'position', positionDelta: { x: deltaX, y: deltaY } }
        }
      }
    } else if (target && tryReparent(draggedElement, target, originalParent, originalNextSibling)) {
      if (originalParent) {
        moveInfo = { originalParent, originalPreviousSibling, originalNextSibling, mode: dragMode }
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
      initialRectRef.current = {
        x: rect.left,
        y: rect.top,
        scaleX: element.offsetWidth > 0 ? rect.width / element.offsetWidth : 1,
        scaleY: element.offsetHeight > 0 ? rect.height / element.offsetHeight : 1,
      }
      originalTransformRef.current = element.style.transform

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

      if (draggedElement) {
        const { x, y, scaleX, scaleY } = initialRectRef.current
        const dx = (e.clientX - dragOffset.x - x) / scaleX
        const dy = (e.clientY - dragOffset.y - y) / scaleY
        draggedElement.style.transform = `translate(${dx}px, ${dy}px)`
      }

      if (dragOptionsRef.current.mode === 'position') {
        let container = findLayoutContainerAtPoint(
          e.clientX, e.clientY, draggedElement, originalParent,
        )

        // If no layout container and pointer is outside original parent, look for any container to detach into
        if (!container && draggedElement && originalParent) {
          const parentRect = originalParent.getBoundingClientRect()
          const hasSize = parentRect.width > 0 || parentRect.height > 0
          const isOutside = hasSize && (
            e.clientX < parentRect.left || e.clientX > parentRect.right
            || e.clientY < parentRect.top || e.clientY > parentRect.bottom
          )
          if (isOutside) {
            const found = findContainerAtPoint(e.clientX, e.clientY, draggedElement, null)
            if (found && found !== originalParent) container = found
          }
        }

        if (container && draggedElement) {
          const dropPos = calculateDropPosition(container, e.clientX, e.clientY, draggedElement)
          if (dropPos) {
            setDropTarget({
              container,
              insertBefore: dropPos.insertBefore,
              flexDirection: resolveFlexDirection(container, draggedElement),
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
            flexDirection: resolveFlexDirection(container, draggedElement),
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
