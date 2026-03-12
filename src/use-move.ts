import * as React from 'react'
import type { DragState, DropIndicator } from './types'
import { createDragInteractionGuard } from './drag-interaction-guard'
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
  visualDelta?: { x: number; y: number }
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

interface ReorderPreviewSnapshot {
  transform: string
  transition: string
}

const DEFAULT_DRAG_OPTIONS: ActiveDragOptions = {
  constrainToOriginalParent: false,
  mode: 'free',
}
const REORDER_PREVIEW_TRANSITION = 'transform 140ms cubic-bezier(0.2, 0, 0, 1)'

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

function isHorizontalDirection(direction: UseMoveDropTarget['flexDirection']): boolean {
  return direction === 'row' || direction === 'row-reverse'
}

function forwardVisualSign(direction: UseMoveDropTarget['flexDirection']): 1 | -1 {
  return direction === 'row-reverse' || direction === 'column-reverse' ? -1 : 1
}

function getInsertIndex(
  siblings: HTMLElement[],
  insertBefore: HTMLElement | null,
): number | null {
  if (!insertBefore) return siblings.length
  const index = siblings.indexOf(insertBefore)
  return index >= 0 ? index : null
}

function withAxisTranslate(baseTransform: string, axis: 'x' | 'y', value: number): string {
  const translate = axis === 'x'
    ? `translateX(${value}px)`
    : `translateY(${value}px)`
  return baseTransform ? `${baseTransform} ${translate}` : translate
}

function withTransformTransition(baseTransition: string): string {
  if (!baseTransition) return REORDER_PREVIEW_TRANSITION
  const hasTransformTransition = baseTransition
    .split(',')
    .some((part) => /(^|\s)(transform|all)(\s|$)/.test(part))
  if (hasTransformTransition) return baseTransition
  return `${baseTransition}, ${REORDER_PREVIEW_TRANSITION}`
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
  const dragGuardRef = React.useRef(createDragInteractionGuard())
  const initialRectRef = React.useRef<{ x: number; y: number; scaleX: number; scaleY: number }>(
    { x: 0, y: 0, scaleX: 1, scaleY: 1 }
  )
  const originalTransformRef = React.useRef('')
  const reorderPreviewRef = React.useRef(new Map<HTMLElement, ReorderPreviewSnapshot>())

  React.useEffect(() => {
    dragStateRef.current = dragState
    dropTargetRef.current = dropTarget
    onMoveCompleteRef.current = onMoveComplete
  })

  const clearReorderPreview = React.useCallback(() => {
    for (const [element, snapshot] of reorderPreviewRef.current) {
      element.style.transform = snapshot.transform
      element.style.transition = snapshot.transition
    }
    reorderPreviewRef.current.clear()
  }, [])

  const setReorderPreviewTransform = React.useCallback((element: HTMLElement, transform: string) => {
    const existing = reorderPreviewRef.current.get(element)
    if (!existing) {
      reorderPreviewRef.current.set(element, {
        transform: element.style.transform,
        transition: element.style.transition,
      })
    }
    const originalTransition = reorderPreviewRef.current.get(element)?.transition ?? element.style.transition
    element.style.transition = withTransformTransition(originalTransition)
    element.style.transform = transform
  }, [])

  const applyReorderPreview = React.useCallback((
    target: UseMoveDropTarget | null,
    draggedElement: HTMLElement | null,
    originalParent: HTMLElement | null,
  ) => {
    if (!target || !draggedElement) {
      clearReorderPreview()
      return
    }

    const container = target.container
    const containerChildren = Array.from(container.children).filter(
      (child): child is HTMLElement => child instanceof HTMLElement
    )
    const siblings = containerChildren.filter((child) => child !== draggedElement)
    const insertIndex = getInsertIndex(siblings, target.insertBefore)
    if (insertIndex === null) {
      clearReorderPreview()
      return
    }

    const draggedRect = draggedElement.getBoundingClientRect()
    const isHorizontal = isHorizontalDirection(target.flexDirection)
    const dragSize = isHorizontal ? draggedRect.width : draggedRect.height
    if (!Number.isFinite(dragSize) || dragSize <= 0) {
      clearReorderPreview()
      return
    }

    const sign = forwardVisualSign(target.flexDirection)
    const shiftedElements = new Map<HTMLElement, number>()

    if (container === originalParent) {
      const originalIndex = containerChildren.indexOf(draggedElement)
      if (originalIndex >= 0) {
        if (insertIndex > originalIndex) {
          const shift = -sign * dragSize
          for (let i = originalIndex; i < insertIndex; i++) {
            const sibling = siblings[i]
            if (sibling) shiftedElements.set(sibling, shift)
          }
        } else if (insertIndex < originalIndex) {
          const shift = sign * dragSize
          for (let i = insertIndex; i < originalIndex; i++) {
            const sibling = siblings[i]
            if (sibling) shiftedElements.set(sibling, shift)
          }
        }
      }
    } else {
      const shift = sign * dragSize
      for (let i = insertIndex; i < siblings.length; i++) {
        shiftedElements.set(siblings[i], shift)
      }
    }

    const axis: 'x' | 'y' = isHorizontal ? 'x' : 'y'
    const keep = new Set(shiftedElements.keys())

    for (const [element, snapshot] of reorderPreviewRef.current) {
      if (!keep.has(element)) {
        element.style.transform = snapshot.transform
        element.style.transition = snapshot.transition
        reorderPreviewRef.current.delete(element)
      }
    }

    for (const [element, shift] of shiftedElements) {
      const baseTransform = reorderPreviewRef.current.get(element)?.transform ?? element.style.transform
      setReorderPreviewTransform(element, withAxisTranslate(baseTransform, axis, shift))
    }
  }, [clearReorderPreview, setReorderPreviewTransform])

  const cancelDrag = React.useCallback(() => {
    const current = dragStateRef.current
    if (current.draggedElement) {
      current.draggedElement.style.opacity = ''
      current.draggedElement.style.transform = originalTransformRef.current
    }
    clearReorderPreview()
    originalTransformRef.current = ''
    initialRectRef.current = { x: 0, y: 0, scaleX: 1, scaleY: 1 }
    dragOptionsRef.current = DEFAULT_DRAG_OPTIONS
    dragGuardRef.current.deactivate()
    setDragState(INITIAL_DRAG_STATE)
    setDropTarget(null)
    setDropIndicator(null)
  }, [clearReorderPreview])

  const completeDrag = React.useCallback(() => {
    const current = dragStateRef.current
    const target = dropTargetRef.current
    const { draggedElement, originalParent, originalPreviousSibling, originalNextSibling } = current

    if (!draggedElement) {
      cancelDrag()
      return
    }

    const initialPos = { x: initialRectRef.current.x, y: initialRectRef.current.y }
    const { scaleX, scaleY } = initialRectRef.current
    draggedElement.style.transform = originalTransformRef.current
    draggedElement.style.opacity = ''
    clearReorderPreview()
    originalTransformRef.current = ''
    initialRectRef.current = { x: 0, y: 0, scaleX: 1, scaleY: 1 }
    const dragMode = dragOptionsRef.current.mode
    dragOptionsRef.current = DEFAULT_DRAG_OPTIONS
    dragGuardRef.current.deactivate()

    const vd = {
      x: Math.round(current.ghostPosition.x - initialPos.x),
      y: Math.round(current.ghostPosition.y - initialPos.y),
    }
    const hasVisualDelta = vd.x !== 0 || vd.y !== 0

    let moveInfo: MoveInfo | null = null

    if (dragMode === 'position') {
      if (target && tryReparent(draggedElement, target, originalParent, originalNextSibling)) {
        if (originalParent) {
          moveInfo = {
            originalParent,
            originalPreviousSibling,
            originalNextSibling,
            mode: 'free',
            resetPositionOffsets: true,
            visualDelta: hasVisualDelta ? vd : undefined,
          }
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
        moveInfo = {
          originalParent,
          originalPreviousSibling,
          originalNextSibling,
          mode: dragMode,
          visualDelta: hasVisualDelta ? vd : undefined,
        }
      }
    }

    setDragState(INITIAL_DRAG_STATE)
    setDropTarget(null)
    setDropIndicator(null)

    onMoveCompleteRef.current?.(draggedElement, moveInfo)
  }, [cancelDrag, clearReorderPreview])

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
      dragGuardRef.current.activate()

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
            const nextTarget = {
              container,
              insertBefore: dropPos.insertBefore,
              flexDirection: resolveFlexDirection(container, draggedElement),
            }
            setDropTarget(nextTarget)
            setDropIndicator(dropPos.indicator)
            applyReorderPreview(nextTarget, draggedElement, originalParent)
          } else {
            setDropTarget(null)
            setDropIndicator(null)
            clearReorderPreview()
          }
        } else {
          setDropTarget(null)
          setDropIndicator(null)
          clearReorderPreview()
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
          const nextTarget = {
            container,
            insertBefore: dropPos.insertBefore,
            flexDirection: resolveFlexDirection(container, draggedElement),
          }
          setDropTarget(nextTarget)
          setDropIndicator(dropPos.indicator)
          applyReorderPreview(nextTarget, draggedElement, originalParent)
        } else {
          setDropTarget(null)
          setDropIndicator(null)
          clearReorderPreview()
        }
      } else {
        setDropTarget(null)
        setDropIndicator(null)
        clearReorderPreview()
      }
    }

    function handlePointerUp() {
      completeDrag()
    }

    function handlePointerCancel() {
      cancelDrag()
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        cancelDrag()
      }
    }

    function handleBlur() {
      cancelDrag()
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerCancel)
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('blur', handleBlur)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerCancel)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('blur', handleBlur)
    }
  }, [dragState.isDragging, completeDrag, cancelDrag, applyReorderPreview, clearReorderPreview])

  React.useEffect(() => {
    return () => {
      dragGuardRef.current.deactivate()
    }
  }, [])

  return {
    dragState,
    dropTarget,
    dropIndicator,
    startDrag,
  }
}
