import * as React from 'react'
import type { MeasurementLine } from './types'

const TOMATO = '#E54D2E'
const BLUE = '#0D99FF'
const END_CAP_SIZE = 4

interface MeasurementOverlayProps {
  selectedElement: HTMLElement
  hoveredElement: HTMLElement | null
  measurements: MeasurementLine[]
}

interface EndCapProps {
  x: number
  y: number
  direction: 'horizontal' | 'vertical'
}

function EndCap({ x, y, direction }: EndCapProps) {
  const isHorizontal = direction === 'horizontal'
  return (
    <line
      x1={isHorizontal ? x : x - END_CAP_SIZE}
      y1={isHorizontal ? y - END_CAP_SIZE : y}
      x2={isHorizontal ? x : x + END_CAP_SIZE}
      y2={isHorizontal ? y + END_CAP_SIZE : y}
      stroke={TOMATO}
      strokeWidth={0.5}
    />
  )
}

function MeasurementLineComponent({ line }: { line: MeasurementLine }) {
  const { x1, y1, x2, y2, distance, direction, labelPosition } = line

  if (distance <= 0) return null

  const labelWidth = Math.max(String(distance).length * 7 + 8, 24)

  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={TOMATO} strokeWidth={0.5} />
      <EndCap x={x1} y={y1} direction={direction} />
      <EndCap x={x2} y={y2} direction={direction} />
      <g transform={`translate(${labelPosition.x}, ${labelPosition.y})`}>
        <rect
          x={-labelWidth / 2}
          y={-8}
          width={labelWidth}
          height={16}
          rx={2}
          fill={TOMATO}
        />
        <text
          x={0}
          y={1}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#fff"
          fontSize={11}
          fontWeight={500}
          fontFamily="system-ui, -apple-system, sans-serif"
        >
          {distance}
        </text>
      </g>
    </g>
  )
}

interface ElementHighlightProps {
  element: HTMLElement
  color: string
  isDashed?: boolean
}

function ElementHighlight({ element, color, isDashed = false }: ElementHighlightProps) {
  const rect = element.getBoundingClientRect()

  return (
    <rect
      x={rect.left}
      y={rect.top}
      width={rect.width}
      height={rect.height}
      fill="transparent"
      stroke={color}
      strokeWidth={1}
      strokeDasharray={isDashed ? '4 2' : undefined}
    />
  )
}

export function MeasurementOverlay({
  selectedElement,
  hoveredElement,
  measurements,
}: MeasurementOverlayProps) {
  const [, forceUpdate] = React.useReducer((x) => x + 1, 0)

  React.useEffect(() => {
    function handleUpdate() {
      requestAnimationFrame(forceUpdate)
    }

    window.addEventListener('scroll', handleUpdate, true)
    window.addEventListener('resize', handleUpdate)

    return () => {
      window.removeEventListener('scroll', handleUpdate, true)
      window.removeEventListener('resize', handleUpdate)
    }
  }, [selectedElement])

  return (
    <svg
      data-direct-edit="measurement"
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        zIndex: 99998,
      }}
    >
      <ElementHighlight element={selectedElement} color={BLUE} />
      {hoveredElement && (
        <ElementHighlight element={hoveredElement} color={TOMATO} isDashed />
      )}
      {measurements.map((line, i) => (
        <MeasurementLineComponent key={i} line={line} />
      ))}
    </svg>
  )
}
