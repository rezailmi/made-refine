import React from 'react'

const gray = {
  100: 'var(--color-gray-100, #f3f4f6)',
  200: 'var(--color-gray-200, #e5e7eb)',
  300: 'var(--color-gray-300, #d1d5db)',
  400: 'var(--color-gray-400, #9ca3af)',
  500: 'var(--color-gray-500, #6b7280)',
  700: 'var(--color-gray-700, #374151)',
  900: 'var(--color-gray-900, #111827)',
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

interface CanvasCard {
  id: string
  title: string
  subtitle: string
  x: number
  y: number
  width: number
  height: number
  color: string
}

const INITIAL_CARDS: CanvasCard[] = [
  {
    id: 'card-a',
    title: 'Flow Nodes',
    subtitle: 'Drag to reposition',
    x: 120,
    y: 140,
    width: 320,
    height: 190,
    color: '#1d4ed8',
  },
  {
    id: 'card-b',
    title: 'Insights',
    subtitle: 'Canvas test card',
    x: 500,
    y: 250,
    width: 350,
    height: 210,
    color: '#0f766e',
  },
  {
    id: 'card-c',
    title: 'Quality Gate',
    subtitle: 'Pointer disabled in design mode',
    x: 820,
    y: 160,
    width: 360,
    height: 220,
    color: '#b45309',
  },
]

function screenToWorld(x: number, y: number, width: number, height: number, zoom: number) {
  return {
    x: width / 2 + (x - width / 2) / zoom,
    y: height / 2 + (y - height / 2) / zoom,
  }
}

interface CanvasPlaygroundProps {
  onBack: () => void
}

export function CanvasPlayground({ onBack }: CanvasPlaygroundProps) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null)
  const [nativeZoom, setNativeZoom] = React.useState(1)
  const [nativeClicks, setNativeClicks] = React.useState(0)
  const zoomRef = React.useRef(1)
  const [cards, setCards] = React.useState<CanvasCard[]>(() => INITIAL_CARDS.map((card) => ({ ...card })))
  const dragRef = React.useRef<{
    cardId: string
    pointerId: number
    offsetX: number
    offsetY: number
  } | null>(null)
  const [viewport, setViewport] = React.useState(() => ({
    width: typeof window === 'undefined' ? 1200 : window.innerWidth,
    height: typeof window === 'undefined' ? 800 : window.innerHeight,
  }))

  React.useEffect(() => {
    const updateViewport = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight })
    }
    window.addEventListener('resize', updateViewport)
    return () => window.removeEventListener('resize', updateViewport)
  }, [])

  React.useEffect(() => {
    zoomRef.current = nativeZoom
  }, [nativeZoom])

  React.useEffect(() => {
    function handlePointerMove(event: PointerEvent) {
      const drag = dragRef.current
      if (!drag) return

      const world = screenToWorld(
        event.clientX,
        event.clientY,
        viewport.width,
        viewport.height,
        zoomRef.current,
      )

      setCards((prev) => prev.map((card) => {
        if (card.id !== drag.cardId) return card
        return {
          ...card,
          x: clamp(world.x - drag.offsetX, 0, viewport.width - card.width),
          y: clamp(world.y - drag.offsetY, 0, viewport.height - card.height),
        }
      }))
    }

    function handlePointerEnd(event: PointerEvent) {
      if (!dragRef.current) return
      if (dragRef.current.pointerId !== event.pointerId) return
      dragRef.current = null
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerEnd)
    window.addEventListener('pointercancel', handlePointerEnd)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerEnd)
      window.removeEventListener('pointercancel', handlePointerEnd)
    }
  }, [viewport])

  React.useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.max(1, Math.floor(viewport.width * dpr))
    canvas.height = Math.max(1, Math.floor(viewport.height * dpr))
  }, [viewport])

  React.useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let raf = 0
    const draw = () => {
      const dpr = window.devicePixelRatio || 1
      const width = viewport.width
      const height = viewport.height
      const zoom = zoomRef.current

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, width, height)
      ctx.fillStyle = '#0b1220'
      ctx.fillRect(0, 0, width, height)

      ctx.fillStyle = '#f8fafc'
      ctx.font = '600 14px system-ui'
      ctx.fillText(`Native canvas zoom: ${zoom.toFixed(2)}x`, 20, 28)
      ctx.fillText(`Native click count: ${nativeClicks}`, 20, 52)

      raf = requestAnimationFrame(draw)
    }

    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [nativeClicks, viewport])

  return (
    <div style={{ position: 'fixed', inset: 0, fontFamily: 'system-ui, sans-serif', backgroundColor: '#0b1220' }}>
      <canvas
        ref={canvasRef}
        onWheel={(event) => {
          event.preventDefault()
          setNativeZoom((current) => clamp(current * (event.deltaY < 0 ? 1.08 : 0.92), 0.35, 3.5))
        }}
        onClick={() => setNativeClicks((current) => current + 1)}
        style={{
          display: 'block',
          width: '100vw',
          height: '100vh',
          cursor: 'crosshair',
        }}
      />

      <div
        style={{
          position: 'fixed',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 1,
          transform: `translate(${viewport.width / 2}px, ${viewport.height / 2}px) scale(${nativeZoom}) translate(${-viewport.width / 2}px, ${-viewport.height / 2}px)`,
          transformOrigin: '0 0',
        }}
      >
        {cards.map((card) => {
          const isDragging = dragRef.current?.cardId === card.id
          return (
            <div
              key={card.id}
              data-canvas-card={card.id}
              onPointerDown={(event) => {
                if (event.button !== 0) return
                event.preventDefault()
                event.stopPropagation()

                const world = screenToWorld(
                  event.clientX,
                  event.clientY,
                  viewport.width,
                  viewport.height,
                  zoomRef.current,
                )

                setCards((prev) => {
                  const selected = prev.find((item) => item.id === card.id)
                  if (!selected) return prev
                  return [...prev.filter((item) => item.id !== card.id), selected]
                })

                dragRef.current = {
                  cardId: card.id,
                  pointerId: event.pointerId,
                  offsetX: world.x - card.x,
                  offsetY: world.y - card.y,
                }
              }}
              style={{
                position: 'absolute',
                left: card.x,
                top: card.y,
                width: card.width,
                height: card.height,
                pointerEvents: 'auto',
                borderRadius: 16,
                border: '1px solid rgba(255,255,255,0.24)',
                boxShadow: isDragging
                  ? '0 22px 44px rgba(0,0,0,0.45)'
                  : '0 16px 34px rgba(0,0,0,0.28)',
                backgroundColor: card.color,
                color: '#f8fafc',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                userSelect: 'none',
                cursor: isDragging ? 'grabbing' : 'grab',
                overflow: 'hidden',
              }}
            >
              <div style={{ backgroundColor: 'rgba(255,255,255,0.12)', padding: '14px 16px', fontSize: 17, fontWeight: 700 }}>
                {card.title}
              </div>
              <div style={{ padding: '0 16px', fontSize: 14, opacity: 0.9 }}>{card.subtitle}</div>
              <div style={{ padding: '0 16px 14px', fontSize: 12, opacity: 0.8, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
                {Math.round(card.x)}, {Math.round(card.y)}
              </div>
            </div>
          )
        })}
      </div>

      <div
        style={{
          position: 'fixed',
          top: 16,
          left: 16,
          maxWidth: 560,
          border: `1px solid ${gray[200]}`,
          borderRadius: 16,
          padding: 18,
          backgroundColor: 'rgba(255, 255, 255, 0.94)',
          boxShadow: '0 10px 28px rgba(0,0,0,0.18)',
          color: gray[900],
          pointerEvents: 'auto',
          zIndex: 2,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>canvas playground</h1>
            <p style={{ color: gray[500], margin: '6px 0 0', fontSize: 14, lineHeight: 1.5 }}>
              Full-viewport target canvas for design mode testing.
            </p>
          </div>
          <button
            type="button"
            onClick={onBack}
            style={{
              border: `1px solid ${gray[300]}`,
              borderRadius: 8,
              padding: '8px 12px',
              fontSize: 13,
              fontWeight: 600,
              backgroundColor: '#fff',
              color: gray[700],
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Back
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <button
            type="button"
            onClick={() => setNativeZoom(1)}
            style={{
              border: `1px solid ${gray[300]}`,
              borderRadius: 8,
              padding: '8px 12px',
              fontSize: 13,
              fontWeight: 600,
              backgroundColor: '#fff',
              color: gray[700],
              cursor: 'pointer',
            }}
          >
            Reset native zoom
          </button>
          <span style={{ fontSize: 13, color: gray[500] }}>
            Scroll canvas to zoom when edit mode is off.
          </span>
        </div>

        <ol style={{ margin: 0, paddingLeft: 20, color: gray[700], fontSize: 13, lineHeight: 1.6 }}>
          <li>Open edit mode with <strong>Cmd + .</strong></li>
          <li>Toggle canvas mode with <strong>Shift + Z</strong></li>
          <li>Drag/select the cards (they are real DOM elements)</li>
          <li>Target canvas should be disabled in design mode</li>
          <li>made-refine zoom/pan should still work</li>
        </ol>
      </div>
    </div>
  )
}
