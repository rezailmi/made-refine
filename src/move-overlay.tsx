import type { DropIndicator } from './types'

const BLUE = '#0D99FF'

interface MoveOverlayProps {
  dropIndicator: DropIndicator | null
}

export function MoveOverlay({ dropIndicator }: MoveOverlayProps) {
  if (!dropIndicator) {
    return null
  }

  return (
    <svg
      data-direct-edit="move-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        zIndex: 99997,
      }}
    >
      <rect
        x={dropIndicator.x}
        y={dropIndicator.y}
        width={dropIndicator.width}
        height={dropIndicator.height}
        fill={BLUE}
      />
    </svg>
  )
}
