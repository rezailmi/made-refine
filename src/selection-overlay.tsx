import * as React from 'react'

const BLUE = '#0D99FF'
const DRAG_THRESHOLD = 4

export interface SelectionOverlayProps {
  selectedElement: HTMLElement
  isDragging: boolean
  ghostPosition?: { x: number; y: number }
  onMoveStart: (e: React.PointerEvent) => void
  isTextEditing?: boolean
  onDoubleClick?: () => void
}

export function SelectionOverlay({
  selectedElement,
  isDragging,
  ghostPosition,
  onMoveStart,
  isTextEditing,
  onDoubleClick,
}: SelectionOverlayProps) {
  const [rect, setRect] = React.useState(() => selectedElement.getBoundingClientRect())
  const cleanupRef = React.useRef<(() => void) | null>(null)

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
    return () => { cleanupRef.current?.() }
  }, [])

  const handlePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation()
    // No preventDefault — allows browser to generate native dblclick events

    cleanupRef.current?.()

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

    const onUp = () => {
      cleanup()
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
    onDoubleClick?.()
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
        <rect
          x={displayX}
          y={displayY}
          width={rect.width}
          height={rect.height}
          fill="transparent"
          stroke={BLUE}
          strokeWidth={2}
        />
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
        />
      )}
    </>
  )
}
