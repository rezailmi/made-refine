import * as React from 'react'
import { createPortal } from 'react-dom'
import { usePortalContainer } from './portal-container'
import { useDirectEdit } from './hooks'
import { useGuidelines } from './use-guidelines'
import type { Guideline } from './types'

const RULER_SIZE = 20
const GUIDELINE_COLOR = '#FF6B6B'
const RULER_BG = 'rgba(245, 245, 245, 0.95)'
const RULER_BORDER = 'rgba(0, 0, 0, 0.1)'
const TICK_COLOR = 'rgba(0, 0, 0, 0.3)'
const LABEL_COLOR = 'rgba(0, 0, 0, 0.5)'
const HIT_ZONE = 9

const rulerFont: React.CSSProperties = {
  fontFamily: 'system-ui, -apple-system, sans-serif',
  fontSize: '9px',
  fontVariantNumeric: 'tabular-nums',
}

// --- HorizontalRuler ---

function HorizontalRuler({
  scrollOffset,
  onPointerDown,
}: {
  scrollOffset: { x: number; y: number }
  onPointerDown: (e: React.PointerEvent) => void
}) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const viewportWidth = useViewportWidth()

  React.useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    const width = viewportWidth - RULER_SIZE
    const height = RULER_SIZE

    canvas.width = width * dpr
    canvas.height = height * dpr
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`

    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, width, height)

    const startPx = Math.floor(scrollOffset.x / 10) * 10
    const endPx = scrollOffset.x + width

    for (let px = startPx; px <= endPx; px += 10) {
      const x = px - scrollOffset.x
      const isMajor = px % 100 === 0
      const isMid = px % 50 === 0

      ctx.beginPath()
      ctx.moveTo(x, height)
      ctx.lineTo(x, height - (isMajor ? 10 : isMid ? 7 : 4))
      ctx.strokeStyle = TICK_COLOR
      ctx.lineWidth = 1
      ctx.stroke()

      if (isMajor && px !== 0) {
        ctx.fillStyle = LABEL_COLOR
        ctx.font = '9px system-ui, -apple-system, sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(String(px), x, 9)
      }
    }
  }, [scrollOffset.x, viewportWidth])

  return (
    <div
      data-direct-edit="ruler-horizontal"
      style={{
        position: 'fixed',
        top: 0,
        left: RULER_SIZE,
        right: 0,
        height: RULER_SIZE,
        background: RULER_BG,
        borderBottom: `1px solid ${RULER_BORDER}`,
        zIndex: 99994,
        cursor: 's-resize',
        pointerEvents: 'auto',
        overflow: 'hidden',
      }}
      onPointerDown={onPointerDown}
    >
      <canvas ref={canvasRef} style={{ display: 'block' }} />
    </div>
  )
}

// --- VerticalRuler ---

function VerticalRuler({
  scrollOffset,
  onPointerDown,
}: {
  scrollOffset: { x: number; y: number }
  onPointerDown: (e: React.PointerEvent) => void
}) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const viewportHeight = useViewportHeight()

  React.useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    const width = RULER_SIZE
    const height = viewportHeight - RULER_SIZE

    canvas.width = width * dpr
    canvas.height = height * dpr
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`

    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, width, height)

    const startPx = Math.floor(scrollOffset.y / 10) * 10
    const endPx = scrollOffset.y + height

    for (let px = startPx; px <= endPx; px += 10) {
      const y = px - scrollOffset.y
      const isMajor = px % 100 === 0
      const isMid = px % 50 === 0

      ctx.beginPath()
      ctx.moveTo(width, y)
      ctx.lineTo(width - (isMajor ? 10 : isMid ? 7 : 4), y)
      ctx.strokeStyle = TICK_COLOR
      ctx.lineWidth = 1
      ctx.stroke()

      if (isMajor && px !== 0) {
        ctx.save()
        ctx.fillStyle = LABEL_COLOR
        ctx.font = '9px system-ui, -apple-system, sans-serif'
        ctx.textAlign = 'center'
        ctx.translate(9, y)
        ctx.rotate(-Math.PI / 2)
        ctx.fillText(String(px), 0, 0)
        ctx.restore()
      }
    }
  }, [scrollOffset.y, viewportHeight])

  return (
    <div
      data-direct-edit="ruler-vertical"
      style={{
        position: 'fixed',
        top: RULER_SIZE,
        left: 0,
        bottom: 0,
        width: RULER_SIZE,
        background: RULER_BG,
        borderRight: `1px solid ${RULER_BORDER}`,
        zIndex: 99994,
        cursor: 'e-resize',
        pointerEvents: 'auto',
        overflow: 'hidden',
      }}
      onPointerDown={onPointerDown}
    >
      <canvas ref={canvasRef} style={{ display: 'block' }} />
    </div>
  )
}

// --- CornerSquare ---

function CornerSquare() {
  return (
    <div
      data-direct-edit="ruler-corner"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: RULER_SIZE,
        height: RULER_SIZE,
        background: RULER_BG,
        borderRight: `1px solid ${RULER_BORDER}`,
        borderBottom: `1px solid ${RULER_BORDER}`,
        zIndex: 99994,
        pointerEvents: 'auto',
      }}
    />
  )
}

// --- GuidelineLine ---

function GuidelineLine({
  guideline,
  scrollOffset,
  isActive,
  dragPosition,
  onStartDrag,
  onDelete,
}: {
  guideline: Guideline
  scrollOffset: { x: number; y: number }
  isActive: boolean
  dragPosition: number | null
  onStartDrag: (id: string) => void
  onDelete: (id: string) => void
}) {
  const isHorizontal = guideline.orientation === 'horizontal'
  const scrollPos = isHorizontal ? scrollOffset.y : scrollOffset.x
  const viewportPos = guideline.position - scrollPos

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onStartDrag(guideline.id)
  }

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onDelete(guideline.id)
  }

  const displayPos = isActive && dragPosition !== null ? dragPosition : viewportPos

  if (isHorizontal) {
    return (
      <>
        {/* Visible line */}
        <div
          data-direct-edit="guideline"
          style={{
            position: 'fixed',
            top: displayPos,
            left: 0,
            right: 0,
            height: 1,
            background: GUIDELINE_COLOR,
            zIndex: 99993,
            pointerEvents: 'none',
          }}
        />
        {/* Hit zone */}
        <div
          style={{
            position: 'fixed',
            top: displayPos - Math.floor(HIT_ZONE / 2),
            left: RULER_SIZE,
            right: 0,
            height: HIT_ZONE,
            zIndex: 99993,
            cursor: 'ns-resize',
            pointerEvents: 'auto',
          }}
          onPointerDown={handlePointerDown}
          onDoubleClick={handleDoubleClick}
        />
        {/* Position label during drag */}
        {isActive && (
          <div
            style={{
              position: 'fixed',
              top: displayPos + 4,
              left: RULER_SIZE + 4,
              background: GUIDELINE_COLOR,
              color: '#fff',
              padding: '1px 4px',
              borderRadius: 2,
              zIndex: 99995,
              pointerEvents: 'none',
              ...rulerFont,
            }}
          >
            {Math.round(guideline.position)}
          </div>
        )}
      </>
    )
  }

  // Vertical guideline
  return (
    <>
      <div
        data-direct-edit="guideline"
        style={{
          position: 'fixed',
          left: displayPos,
          top: 0,
          bottom: 0,
          width: 1,
          background: GUIDELINE_COLOR,
          zIndex: 99993,
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'fixed',
          left: displayPos - Math.floor(HIT_ZONE / 2),
          top: RULER_SIZE,
          bottom: 0,
          width: HIT_ZONE,
          zIndex: 99993,
          cursor: 'ew-resize',
          pointerEvents: 'auto',
        }}
        onPointerDown={handlePointerDown}
        onDoubleClick={handleDoubleClick}
      />
      {isActive && (
        <div
          style={{
            position: 'fixed',
            left: displayPos + 4,
            top: RULER_SIZE + 4,
            background: GUIDELINE_COLOR,
            color: '#fff',
            padding: '1px 4px',
            borderRadius: 2,
            zIndex: 99995,
            pointerEvents: 'none',
            ...rulerFont,
          }}
        >
          {Math.round(guideline.position)}
        </div>
      )}
    </>
  )
}

// --- Viewport size hooks ---

function useViewportWidth() {
  const [width, setWidth] = React.useState(typeof window !== 'undefined' ? window.innerWidth : 0)
  React.useEffect(() => {
    const onResize = () => setWidth(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return width
}

function useViewportHeight() {
  const [height, setHeight] = React.useState(typeof window !== 'undefined' ? window.innerHeight : 0)
  React.useEffect(() => {
    const onResize = () => setHeight(window.innerHeight)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return height
}

// --- Public Components ---

export function RulersOverlay({ enabled }: { enabled: boolean }) {
  const container = usePortalContainer()
  const {
    guidelines,
    activeGuideline,
    dragPosition,
    scrollOffset,
    startCreate,
    startDrag,
    deleteGuideline,
  } = useGuidelines(enabled)

  if (!enabled || !container) return null

  const handleHorizontalPointerDown = (e: React.PointerEvent) => {
    e.preventDefault()
    startCreate('horizontal', e.clientY)
  }

  const handleVerticalPointerDown = (e: React.PointerEvent) => {
    e.preventDefault()
    startCreate('vertical', e.clientX)
  }

  return createPortal(
    <>
      <CornerSquare />
      <HorizontalRuler scrollOffset={scrollOffset} onPointerDown={handleHorizontalPointerDown} />
      <VerticalRuler scrollOffset={scrollOffset} onPointerDown={handleVerticalPointerDown} />
      {guidelines.map((g) => (
        <GuidelineLine
          key={g.id}
          guideline={g}
          scrollOffset={scrollOffset}
          isActive={activeGuideline?.id === g.id}
          dragPosition={activeGuideline?.id === g.id ? dragPosition : null}
          onStartDrag={startDrag}
          onDelete={deleteGuideline}
        />
      ))}
    </>,
    container,
  )
}

const RULERS_VISIBLE_KEY = 'direct-edit-rulers-visible'
const RULERS_TOGGLE_EVENT = 'direct-edit-rulers-toggle'

export function useRulersVisible(): [boolean, () => void] {
  const [visible, setVisible] = React.useState(
    () => typeof window !== 'undefined' ? localStorage.getItem(RULERS_VISIBLE_KEY) !== 'false' : true,
  )

  React.useEffect(() => {
    function handler(e: Event) {
      setVisible((e as CustomEvent<boolean>).detail)
    }
    window.addEventListener(RULERS_TOGGLE_EVENT, handler)
    return () => window.removeEventListener(RULERS_TOGGLE_EVENT, handler)
  }, [])

  const toggle = React.useCallback(() => {
    setVisible((prev) => {
      const next = !prev
      localStorage.setItem(RULERS_VISIBLE_KEY, String(next))
      window.dispatchEvent(new CustomEvent(RULERS_TOGGLE_EVENT, { detail: next }))
      return next
    })
  }, [])

  return [visible, toggle]
}

export function Rulers() {
  const { editModeActive } = useDirectEdit()
  const [rulersVisible, toggleRulers] = useRulersVisible()

  React.useEffect(() => {
    if (!editModeActive) return

    function handleKeyDown(e: KeyboardEvent) {
      if (e.shiftKey && e.key === 'R' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault()
        toggleRulers()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [editModeActive, toggleRulers])

  return <RulersOverlay enabled={editModeActive && rulersVisible} />
}
