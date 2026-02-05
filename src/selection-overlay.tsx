import * as React from 'react'

const BLUE = '#0D99FF'

interface SelectionOverlayProps {
  selectedElement: HTMLElement
  isDragging: boolean
  ghostPosition?: { x: number; y: number }
  onMoveStart: (e: React.PointerEvent) => void
}

export function SelectionOverlay({
  selectedElement,
  isDragging,
  ghostPosition,
  onMoveStart,
}: SelectionOverlayProps) {
  const [rect, setRect] = React.useState(() => selectedElement.getBoundingClientRect())

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

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onMoveStart(e)
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
          strokeWidth={1}
        />
      </svg>

      {!isDragging && (
        <div
          data-direct-edit="selection-handle"
          style={{
            position: 'fixed',
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height,
            zIndex: 99996,
            cursor: 'grab',
          }}
          onPointerDown={handlePointerDown}
        />
      )}
    </>
  )
}
