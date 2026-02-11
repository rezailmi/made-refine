import * as React from 'react'
import { elementFromPointWithoutOverlays } from './utils'

const BLUE = '#0D99FF'
const DRAG_THRESHOLD = 4
const DBLCLICK_DELAY = 300

export interface SelectionOverlayProps {
  selectedElement: HTMLElement
  isDragging: boolean
  ghostPosition?: { x: number; y: number }
  onMoveStart: (e: React.PointerEvent) => void
  isTextEditing?: boolean
  onDoubleClick?: (clientX: number, clientY: number) => void
  onHoverElement?: (element: HTMLElement | null) => void
  onClickThrough?: (clientX: number, clientY: number) => void
}

export function SelectionOverlay({
  selectedElement,
  isDragging,
  ghostPosition,
  onMoveStart,
  isTextEditing,
  onDoubleClick,
  onHoverElement,
  onClickThrough,
}: SelectionOverlayProps) {
  const [rect, setRect] = React.useState(() => selectedElement.getBoundingClientRect())
  const cleanupRef = React.useRef<(() => void) | null>(null)
  const clickThroughTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  React.useEffect(() => {
    function updateRect() {
      setRect(selectedElement.getBoundingClientRect())
    }

    updateRect()

    window.addEventListener('scroll', updateRect, true)
    window.addEventListener('resize', updateRect)

    const observer = new MutationObserver(updateRect)
    observer.observe(selectedElement, {
      attributes: true,
      childList: true,
      subtree: true,
    })

    return () => {
      window.removeEventListener('scroll', updateRect, true)
      window.removeEventListener('resize', updateRect)
      observer.disconnect()
    }
  }, [selectedElement])

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
        />
      )}
    </>
  )
}
