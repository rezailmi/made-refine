import * as React from 'react'
import { elementFromPointWithoutOverlays } from './utils'

const BLUE = '#0D99FF'
const MAGENTA = '#E11BB6'
const DRAG_THRESHOLD = 4
const DBLCLICK_DELAY = 300
const HANDLE_SIZE = 12

interface MoveStartOptions {
  constrainToOriginalParent?: boolean
}

export interface SelectionOverlayProps {
  selectedElement: HTMLElement
  draggedElement?: HTMLElement | null
  isDragging: boolean
  ghostPosition?: { x: number; y: number }
  onMoveStart: (
    e: React.PointerEvent,
    targetElement?: HTMLElement,
    options?: MoveStartOptions
  ) => void
  showMoveHandle?: boolean
  isTextEditing?: boolean
  onDoubleClick?: (clientX: number, clientY: number) => void
  onHoverElement?: (element: HTMLElement | null) => void
  onClickThrough?: (clientX: number, clientY: number) => void
}

export function SelectionOverlay({
  selectedElement,
  draggedElement,
  isDragging,
  ghostPosition,
  onMoveStart,
  showMoveHandle = false,
  isTextEditing,
  onDoubleClick,
  onHoverElement,
  onClickThrough,
}: SelectionOverlayProps) {
  const rectElement = isDragging && draggedElement ? draggedElement : selectedElement
  const [rect, setRect] = React.useState(() => rectElement.getBoundingClientRect())
  const [moveHandleRects, setMoveHandleRects] = React.useState<Array<{
    target: HTMLElement
    left: number
    top: number
    width: number
    height: number
  }>>([])
  const cleanupRef = React.useRef<(() => void) | null>(null)
  const clickThroughTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  React.useEffect(() => {
    function updateRect() {
      setRect(rectElement.getBoundingClientRect())
    }

    updateRect()

    window.addEventListener('scroll', updateRect, true)
    window.addEventListener('resize', updateRect)
    window.addEventListener('direct-edit-canvas-change', updateRect)

    const observer = new MutationObserver(updateRect)
    observer.observe(rectElement, {
      attributes: true,
      childList: true,
      subtree: true,
    })

    return () => {
      window.removeEventListener('scroll', updateRect, true)
      window.removeEventListener('resize', updateRect)
      window.removeEventListener('direct-edit-canvas-change', updateRect)
      observer.disconnect()
    }
  }, [rectElement])

  React.useEffect(() => {
    return () => {
      cleanupRef.current?.()
      if (clickThroughTimerRef.current) clearTimeout(clickThroughTimerRef.current)
    }
  }, [])

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return
    e.stopPropagation()
    // No preventDefault — allows browser to generate native dblclick events

    cleanupRef.current?.()
    if (clickThroughTimerRef.current) {
      clearTimeout(clickThroughTimerRef.current)
      clickThroughTimerRef.current = null
    }

    const origin = { x: e.clientX, y: e.clientY }
    const savedEvent = e

    const onMove = (moveEvent: PointerEvent) => {
      const dx = moveEvent.clientX - origin.x
      const dy = moveEvent.clientY - origin.y
      if (dx * dx + dy * dy >= DRAG_THRESHOLD * DRAG_THRESHOLD) {
        cleanup()
        onMoveStart(savedEvent)
      }
    }

    const onUp = (upEvent: PointerEvent) => {
      cleanup()
      if (onClickThrough) {
        const { clientX, clientY } = upEvent
        clickThroughTimerRef.current = setTimeout(() => {
          clickThroughTimerRef.current = null
          onClickThrough(clientX, clientY)
        }, DBLCLICK_DELAY)
      }
    }

    const cleanup = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      cleanupRef.current = null
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    cleanupRef.current = cleanup
  }

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    cleanupRef.current?.()
    if (clickThroughTimerRef.current) {
      clearTimeout(clickThroughTimerRef.current)
      clickThroughTimerRef.current = null
    }
    onDoubleClick?.(e.clientX, e.clientY)
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!onHoverElement) return
    const elementUnder = elementFromPointWithoutOverlays(e.clientX, e.clientY)
    onHoverElement(elementUnder)
  }

  const handleMouseLeave = () => {
    onHoverElement?.(null)
  }

  const getMoveHandleTargets = React.useCallback(() => {
    if (!showMoveHandle) return []
    const selectedDisplay = window.getComputedStyle(selectedElement).display
    const selectedIsFlexContainer = selectedDisplay === 'flex' || selectedDisplay === 'inline-flex'

    if (selectedIsFlexContainer && selectedElement.children.length > 1) {
      return Array.from(selectedElement.children).filter((child): child is HTMLElement => child instanceof HTMLElement)
    }

    let flexParent: HTMLElement | null = selectedElement.parentElement
    while (flexParent) {
      const display = window.getComputedStyle(flexParent).display
      const isFlex = display === 'flex' || display === 'inline-flex'
      if (isFlex && flexParent.children.length > 1) {
        break
      }
      flexParent = flexParent.parentElement
    }

    if (!flexParent) {
      return [selectedElement]
    }

    let target: HTMLElement = selectedElement
    while (target.parentElement && target.parentElement !== flexParent) {
      target = target.parentElement
    }

    return [target]
  }, [selectedElement, showMoveHandle])

  React.useEffect(() => {
    if (!showMoveHandle || isDragging || isTextEditing) {
      setMoveHandleRects([])
      return
    }

    const targets = getMoveHandleTargets()
    setMoveHandleRects(targets.map((target) => {
      const targetRect = target.getBoundingClientRect()
      return {
        target,
        left: targetRect.left,
        top: targetRect.top,
        width: targetRect.width,
        height: targetRect.height,
      }
    }))
  }, [
    rect,
    selectedElement,
    selectedElement.parentElement,
    selectedElement.childElementCount,
    showMoveHandle,
    isDragging,
    isTextEditing,
    getMoveHandleTargets,
  ])

  const handleMoveHandlePointerDown = (target: HTMLElement) => (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    cleanupRef.current?.()
    if (clickThroughTimerRef.current) {
      clearTimeout(clickThroughTimerRef.current)
      clickThroughTimerRef.current = null
    }
    onMoveStart(e, target, { constrainToOriginalParent: true })
  }

  const displayX = isDragging && ghostPosition ? ghostPosition.x : rect.left
  const displayY = isDragging && ghostPosition ? ghostPosition.y : rect.top

  return (
    <>
      <svg
        data-direct-edit="selection-overlay"
        style={{
          position: 'fixed',
          inset: 0,
          width: '100vw',
          height: '100vh',
          pointerEvents: 'none',
          zIndex: 99996,
        }}
      >
        {!isTextEditing && (
          <rect
            x={displayX}
            y={displayY}
            width={rect.width}
            height={rect.height}
            fill="transparent"
            stroke={BLUE}
            strokeWidth={1}
          />
        )}
      </svg>

      {!isDragging && !isTextEditing && (
        <div
          data-direct-edit="selection-handle"
          style={{
            position: 'fixed',
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height,
            zIndex: 99996,
            cursor: 'default',
            pointerEvents: 'auto',
          }}
          onPointerDown={handlePointerDown}
          onDoubleClick={handleDoubleClick}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          {moveHandleRects.map((targetRect) => {
            return (
              <button
                key={`${targetRect.left}-${targetRect.top}-${targetRect.width}-${targetRect.height}`}
                type="button"
                data-direct-edit="move-handle"
                aria-label="Move element"
                title="Drag to reorder"
                style={{
                  position: 'absolute',
                  left: targetRect.left - rect.left + targetRect.width / 2 - HANDLE_SIZE / 2,
                  top: targetRect.top - rect.top + targetRect.height / 2 - HANDLE_SIZE / 2,
                  width: HANDLE_SIZE,
                  height: HANDLE_SIZE,
                  borderRadius: 9999,
                  border: `1px solid ${MAGENTA}`,
                  background: 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: 'none',
                  cursor: 'grab',
                  pointerEvents: 'auto',
                  padding: 0,
                }}
                onPointerDown={handleMoveHandlePointerDown(targetRect.target)}
              />
            )
          })}
        </div>
      )}
    </>
  )
}
