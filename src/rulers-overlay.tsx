import * as React from 'react'
import { createPortal } from 'react-dom'
import { usePortalContainer } from './portal-container'
import { useDirectEditState } from './hooks'
import { getCanvasSnapshot, useCanvasSnapshot, getBodyOffset } from './canvas-store'
import { useGuidelines } from './use-guidelines'
import type { Guideline } from './types'

const RULER_SIZE = 20
const GUIDELINE_COLOR = '#FF6B6B'
const SNAPPED_COLOR = '#0D99FF'
const HIT_ZONE = 9

export function computeCanvasRulerScrollOffset(pan: number, zoom: number, bodyOffset: number): number {
  if (zoom === 0) return -pan
  return bodyOffset * (1 - 1 / zoom) - pan
}

/**
 * Compute adaptive tick intervals so major labels stay ~80px apart on screen.
 * Returns the major (labeled) interval, minor (small tick) interval, and steps per major.
 */
function computeTickIntervals(zoom: number) {
  const MIN_LABEL_SPACING_PX = 80
  const rawInterval = MIN_LABEL_SPACING_PX / zoom

  const magnitude = Math.pow(10, Math.floor(Math.log10(rawInterval)))
  const residual = rawInterval / magnitude

  let nice: number
  if (residual <= 1) nice = 1
  else if (residual <= 2) nice = 2
  else if (residual <= 2.5) nice = 2.5
  else if (residual <= 5) nice = 5
  else nice = 10

  const major = nice * magnitude
  const stepsPerMajor = 10
  const minor = major / stepsPerMajor

  return { major, minor, stepsPerMajor }
}

function getColorSchemeQuery(): MediaQueryList | null {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return null
  }
  return window.matchMedia('(prefers-color-scheme: dark)')
}

function subscribeColorScheme(cb: () => void) {
  const mq = getColorSchemeQuery()
  if (!mq) return () => {}

  if (typeof mq.addEventListener === 'function') {
    mq.addEventListener('change', cb)
    return () => mq.removeEventListener('change', cb)
  }

  mq.addListener(cb)
  return () => mq.removeListener(cb)
}

function getColorScheme() {
  return getColorSchemeQuery()?.matches ?? false
}

/** Triggers canvas redraws when system color scheme changes (theme = 'system'). */
function useSystemDark() {
  return React.useSyncExternalStore(subscribeColorScheme, getColorScheme, () => false)
}

const rulerFont: React.CSSProperties = {
  fontFamily: 'system-ui, -apple-system, sans-serif',
  fontSize: '9px',
  fontVariantNumeric: 'tabular-nums',
}

// --- HorizontalRuler ---

function HorizontalRuler({
  scrollOffset,
  zoom = 1,
  onPointerDown,
}: {
  scrollOffset: { x: number; y: number }
  zoom?: number
  onPointerDown: (e: React.PointerEvent) => void
}) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const viewportWidth = useViewportWidth()
  const { theme } = useDirectEditState()
  const systemDark = useSystemDark()

  React.useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    const width = Math.max(0, viewportWidth - RULER_SIZE)
    const height = RULER_SIZE

    canvas.width = width * dpr
    canvas.height = height * dpr
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`

    if (width === 0) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, width, height)

    const computed = getComputedStyle(canvas)
    const tick = computed.getPropertyValue('color')
    const label = tick

    const { minor, stepsPerMajor } = computeTickIntervals(zoom)
    const midIdx = stepsPerMajor / 2
    const visibleContentWidth = width / zoom
    const startIdx = Math.floor(scrollOffset.x / minor)
    const endIdx = Math.ceil((scrollOffset.x + visibleContentWidth) / minor)

    for (let i = startIdx; i <= endIdx; i++) {
      const px = i * minor
      const x = (px - scrollOffset.x) * zoom
      const isMajor = i % stepsPerMajor === 0
      const isMid = !isMajor && i % midIdx === 0

      ctx.beginPath()
      ctx.moveTo(x, height)
      ctx.lineTo(x, height - (isMajor ? 10 : isMid ? 7 : 4))
      ctx.strokeStyle = tick
      ctx.globalAlpha = 0.6
      ctx.lineWidth = 1
      ctx.stroke()

      if (isMajor) {
        ctx.globalAlpha = 1
        ctx.fillStyle = label
        ctx.font = '9px system-ui, -apple-system, sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(String(Math.round(px)), x, 9)
      }
    }
  }, [scrollOffset.x, viewportWidth, zoom, theme, systemDark])

  return (
    <div
      data-direct-edit="ruler-horizontal"
      style={{
        position: 'fixed',
        top: 0,
        left: RULER_SIZE,
        right: 0,
        height: RULER_SIZE,
        background: 'var(--color-background)',
        borderBottom: '1px solid var(--color-border)',
        color: 'var(--color-muted-foreground)',
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
  zoom = 1,
  onPointerDown,
}: {
  scrollOffset: { x: number; y: number }
  zoom?: number
  onPointerDown: (e: React.PointerEvent) => void
}) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const viewportHeight = useViewportHeight()
  const { theme } = useDirectEditState()
  const systemDark = useSystemDark()

  React.useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    const width = RULER_SIZE
    const height = Math.max(0, viewportHeight - RULER_SIZE)

    canvas.width = width * dpr
    canvas.height = height * dpr
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`

    if (height === 0) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, width, height)

    const computed = getComputedStyle(canvas)
    const tick = computed.getPropertyValue('color')
    const label = tick

    const { minor, stepsPerMajor } = computeTickIntervals(zoom)
    const midIdx = stepsPerMajor / 2
    const visibleContentHeight = height / zoom
    const startIdx = Math.floor(scrollOffset.y / minor)
    const endIdx = Math.ceil((scrollOffset.y + visibleContentHeight) / minor)

    for (let i = startIdx; i <= endIdx; i++) {
      const px = i * minor
      const y = (px - scrollOffset.y) * zoom
      const isMajor = i % stepsPerMajor === 0
      const isMid = !isMajor && i % midIdx === 0

      ctx.beginPath()
      ctx.moveTo(width, y)
      ctx.lineTo(width - (isMajor ? 10 : isMid ? 7 : 4), y)
      ctx.strokeStyle = tick
      ctx.globalAlpha = 0.6
      ctx.lineWidth = 1
      ctx.stroke()

      if (isMajor) {
        ctx.save()
        ctx.globalAlpha = 1
        ctx.fillStyle = label
        ctx.font = '9px system-ui, -apple-system, sans-serif'
        ctx.textAlign = 'center'
        ctx.translate(9, y)
        ctx.rotate(-Math.PI / 2)
        ctx.fillText(String(Math.round(px)), 0, 0)
        ctx.restore()
      }
    }
  }, [scrollOffset.y, viewportHeight, zoom, theme, systemDark])

  return (
    <div
      data-direct-edit="ruler-vertical"
      style={{
        position: 'fixed',
        top: RULER_SIZE,
        left: 0,
        bottom: 0,
        width: RULER_SIZE,
        background: 'var(--color-background)',
        borderRight: '1px solid var(--color-border)',
        color: 'var(--color-muted-foreground)',
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
        background: 'var(--color-background)',
        borderRight: '1px solid var(--color-border)',
        borderBottom: '1px solid var(--color-border)',
        zIndex: 99994,
        pointerEvents: 'auto',
      }}
    />
  )
}

// --- Guideline viewport position ---

function computeGuidelineViewportPos(position: number, orientation: 'horizontal' | 'vertical') {
  const snap = getCanvasSnapshot()
  const zoom = snap.active ? snap.zoom : 1
  const pan = orientation === 'horizontal'
    ? (snap.active ? snap.panY : -window.scrollY)
    : (snap.active ? snap.panX : -window.scrollX)
  if (snap.active) {
    const bo = orientation === 'horizontal' ? getBodyOffset().y : getBodyOffset().x
    return bo + (position - bo + pan) * zoom
  }
  return (position + pan) * zoom
}

// --- GuidelineLine ---

function GuidelineLine({
  guideline,
  isActive,
  isSnapped,
  dragPosition,
  onStartDrag,
  onDelete,
}: {
  guideline: Guideline
  isActive: boolean
  isSnapped?: boolean
  dragPosition: number | null
  onStartDrag: (id: string) => void
  onDelete: (id: string) => void
}) {
  const isHorizontal = guideline.orientation === 'horizontal'
  const lineColor = isActive && isSnapped ? SNAPPED_COLOR : GUIDELINE_COLOR

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

  const isDragging = isActive && dragPosition !== null
  // Compute viewport position from the latest canvas snapshot. This provides a
  // correct initial value; the imperative updateGuidelinePositions() callback
  // keeps it frame-perfect during rapid zoom/pan without React re-renders.
  const viewportPos = isDragging
    ? dragPosition
    : computeGuidelineViewportPos(guideline.position, guideline.orientation)
  const translate = isHorizontal
    ? `translateY(${viewportPos}px)`
    : `translateX(${viewportPos}px)`

  if (isHorizontal) {
    return (
      <div
        data-gl-pos={guideline.position}
        data-gl-orient="h"
        {...(isDragging ? { 'data-gl-dragging': '' } : {})}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          height: 0,
          transform: translate,
          zIndex: 99993,
          pointerEvents: 'none',
        }}
      >
        {/* Visible line */}
        <div
          data-direct-edit="guideline"
          style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: lineColor }}
        />
        {/* Hit zone */}
        <div
          style={{
            position: 'absolute',
            top: -Math.floor(HIT_ZONE / 2),
            left: RULER_SIZE,
            right: 0,
            height: HIT_ZONE,
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
              position: 'absolute',
              top: 4,
              left: RULER_SIZE + 4,
              background: lineColor,
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
      </div>
    )
  }

  // Vertical guideline
  return (
    <div
      data-gl-pos={guideline.position}
      data-gl-orient="v"
      {...(isDragging ? { 'data-gl-dragging': '' } : {})}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        bottom: 0,
        width: 0,
        transform: translate,
        zIndex: 99993,
        pointerEvents: 'none',
      }}
    >
      <div
        data-direct-edit="guideline"
        style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 1, background: lineColor }}
      />
      <div
        style={{
          position: 'absolute',
          left: -Math.floor(HIT_ZONE / 2),
          top: RULER_SIZE,
          bottom: 0,
          width: HIT_ZONE,
          cursor: 'ew-resize',
          pointerEvents: 'auto',
        }}
        onPointerDown={handlePointerDown}
        onDoubleClick={handleDoubleClick}
      />
      {isActive && (
        <div
          style={{
            position: 'absolute',
            left: 4,
            top: RULER_SIZE + 4,
            background: lineColor,
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
    </div>
  )
}

// --- Viewport size hooks ---

function useViewportWidth() {
  const [width, setWidth] = React.useState(0)
  React.useEffect(() => {
    setWidth(window.innerWidth)
    const onResize = () => setWidth(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return width
}

function useViewportHeight() {
  const [height, setHeight] = React.useState(0)
  React.useEffect(() => {
    setHeight(window.innerHeight)
    const onResize = () => setHeight(window.innerHeight)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return height
}

// --- Public Components ---

export function RulersOverlay({ enabled }: { enabled: boolean }) {
  const container = usePortalContainer()
  const canvas = useCanvasSnapshot()

  const hostElement = React.useMemo(() => {
    if (!container) return null
    const root = container.getRootNode()
    if (root instanceof ShadowRoot) return root.host as HTMLElement
    return null
  }, [container])

  const {
    guidelines,
    activeGuideline,
    dragPosition,
    isSnapped,
    scrollOffset,
    startCreate,
    startDrag,
    deleteGuideline,
  } = useGuidelines(enabled, hostElement, canvas)

  // Imperatively update guideline wrapper transforms for frame-perfect positioning.
  // Both this and applyTransform() run in the same macrotask (via
  // `direct-edit-canvas-change` event), so the browser composites them in a
  // single paint — no intermediate frame where body transform and guideline
  // positions are out of sync.
  React.useLayoutEffect(() => {
    if (!container || !enabled) return
    const el = container

    function updateGuidelinePositions() {
      const snap = getCanvasSnapshot()
      const zoom = snap.active ? snap.zoom : 1
      const panX = snap.active ? snap.panX : -window.scrollX
      const panY = snap.active ? snap.panY : -window.scrollY
      const bo = getBodyOffset()

      el.querySelectorAll<HTMLElement>('[data-gl-pos]').forEach((node) => {
        // Skip guidelines being dragged — React controls their transform
        if (node.hasAttribute('data-gl-dragging')) return
        const pos = Number(node.dataset.glPos)
        const orient = node.dataset.glOrient
        let vp: number
        if (snap.active) {
          vp = orient === 'h'
            ? bo.y + (pos - bo.y + panY) * zoom
            : bo.x + (pos - bo.x + panX) * zoom
        } else {
          vp = orient === 'h' ? (pos + panY) * zoom : (pos + panX) * zoom
        }
        node.style.transform = orient === 'h' ? `translateY(${vp}px)` : `translateX(${vp}px)`
      })
    }

    updateGuidelinePositions()

    window.addEventListener('direct-edit-canvas-change', updateGuidelinePositions)
    window.addEventListener('scroll', updateGuidelinePositions, true)
    return () => {
      window.removeEventListener('direct-edit-canvas-change', updateGuidelinePositions)
      window.removeEventListener('scroll', updateGuidelinePositions, true)
    }
  }, [container, enabled])

  if (!enabled || !container) return null

  // In canvas mode, pan replaces scroll and we need zoom for coordinate mapping
  const zoom = canvas?.active ? (canvas.zoom || 1) : 1
  const effectiveScrollOffset = canvas?.active
    ? (() => {
      // Convert canvas pan + body margin into an offset compatible with
      // ruler tick math: viewport = (content - scrollOffset) * zoom.
      const bo = getBodyOffset()
      return {
        x: computeCanvasRulerScrollOffset(canvas.panX || 0, zoom, bo.x),
        y: computeCanvasRulerScrollOffset(canvas.panY || 0, zoom, bo.y),
      }
    })()
    : scrollOffset

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
      <HorizontalRuler scrollOffset={effectiveScrollOffset} zoom={zoom} onPointerDown={handleHorizontalPointerDown} />
      <VerticalRuler scrollOffset={effectiveScrollOffset} zoom={zoom} onPointerDown={handleVerticalPointerDown} />
      {guidelines.map((g) => (
        <GuidelineLine
          key={g.id}
          guideline={g}
          isActive={activeGuideline?.id === g.id}
          isSnapped={activeGuideline?.id === g.id ? isSnapped : false}
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

const canUseDOM = typeof window !== 'undefined'
const rulersVisibleListeners = new Set<() => void>()

function readStoredRulersVisible(): boolean {
  if (!canUseDOM) {
    return true
  }

  try {
    return localStorage.getItem(RULERS_VISIBLE_KEY) !== 'false'
  } catch {
    return true
  }
}

let rulersVisibleSnapshot = readStoredRulersVisible()

function emitRulersVisible() {
  rulersVisibleListeners.forEach((listener) => listener())
}

function setRulersVisible(next: boolean) {
  if (rulersVisibleSnapshot === next) {
    return
  }

  rulersVisibleSnapshot = next

  if (canUseDOM) {
    try {
      localStorage.setItem(RULERS_VISIBLE_KEY, String(next))
    } catch {
      // ignore write failures (e.g. private mode)
    }
  }

  emitRulersVisible()
}

function subscribeRulersVisible(listener: () => void) {
  rulersVisibleListeners.add(listener)
  return () => {
    rulersVisibleListeners.delete(listener)
  }
}

export function useRulersVisible(): [boolean, () => void] {
  const visible = React.useSyncExternalStore(
    subscribeRulersVisible,
    () => rulersVisibleSnapshot,
    () => true,
  )

  const toggle = React.useCallback(() => {
    setRulersVisible(!rulersVisibleSnapshot)
  }, [])

  return [visible, toggle]
}

export function Rulers() {
  const { editModeActive } = useDirectEditState()
  const [rulersVisible, toggleRulers] = useRulersVisible()

  React.useEffect(() => {
    if (!editModeActive) return

    function handleKeyDown(e: KeyboardEvent) {
      if (e.shiftKey && e.key === 'R' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const active = document.activeElement
        const isInput = active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement || (active instanceof HTMLElement && active.isContentEditable)
        if (isInput) return
        e.preventDefault()
        toggleRulers()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [editModeActive, toggleRulers])

  return <RulersOverlay enabled={editModeActive && rulersVisible} />
}
