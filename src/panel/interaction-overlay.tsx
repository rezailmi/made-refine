import * as React from 'react'
import { cn } from '../cn'
import type { ActiveTool } from '../types'
import {
  isTextElement,
  resolveElementTarget,
  computeHoverHighlight,
  elementFromPointWithoutOverlays,
} from '../utils'

export interface InteractionOverlayProps {
  activeTool: ActiveTool
  selectedElement: HTMLElement | null
  textEditingElement: HTMLElement | null
  activeCommentId: string | null
  hoverHighlight: {
    flexContainer: HTMLElement
    children: HTMLElement[]
  } | null
  onSelectElement: (element: HTMLElement) => void
  onStartTextEditing: (element: HTMLElement) => void
  onAddComment: (element: HTMLElement, position: { x: number; y: number }) => void
  onSetActiveCommentId: (id: string | null) => void
  onSetHoverHighlight: (highlight: { flexContainer: HTMLElement; children: HTMLElement[] } | null) => void
  hasPendingCommentDraft: () => boolean
}

export function InteractionOverlay({
  activeTool,
  selectedElement,
  textEditingElement,
  activeCommentId,
  hoverHighlight,
  onSelectElement,
  onStartTextEditing,
  onAddComment,
  onSetActiveCommentId,
  onSetHoverHighlight,
  hasPendingCommentDraft,
}: InteractionOverlayProps) {
  return (
    <>
      <div
        role="presentation"
        data-direct-edit="overlay"
        className={cn('fixed inset-0 z-[99990] cursor-default')}
        style={{ pointerEvents: textEditingElement ? 'none' : 'auto' }}
        onDoubleClick={(e) => {
          e.preventDefault()
          if (activeTool !== 'select') return
          const elementUnder = elementFromPointWithoutOverlays(e.clientX, e.clientY)
          if (elementUnder && elementUnder !== document.body && elementUnder !== document.documentElement) {
            const resolved = resolveElementTarget(elementUnder, selectedElement)
            if (isTextElement(resolved)) {
              if (selectedElement !== resolved) onSelectElement(resolved)
              onStartTextEditing(resolved)
            }
          }
        }}
        onMouseMove={(e) => {
          const elementUnder = elementFromPointWithoutOverlays(e.clientX, e.clientY)
          onSetHoverHighlight(computeHoverHighlight(elementUnder, selectedElement))
        }}
        onMouseLeave={() => onSetHoverHighlight(null)}
        onClick={(e) => {
          e.preventDefault()
          onSetHoverHighlight(null)
          if (activeTool === 'comment') {
            if (hasPendingCommentDraft()) return
            const elementUnder = elementFromPointWithoutOverlays(e.clientX, e.clientY)
            if (elementUnder && elementUnder !== document.body && elementUnder !== document.documentElement) {
              const resolved = resolveElementTarget(elementUnder, selectedElement)
              onAddComment(resolved, { x: e.clientX, y: e.clientY })
            }
            return
          }
          if (activeCommentId) { onSetActiveCommentId(null); return }
          const elementUnder = elementFromPointWithoutOverlays(e.clientX, e.clientY)
          if (elementUnder && elementUnder !== document.body && elementUnder !== document.documentElement) {
            const resolved = resolveElementTarget(elementUnder, selectedElement)
            onSelectElement(resolved)
          }
        }}
      />
      {hoverHighlight && (() => {
        const cr = hoverHighlight.flexContainer.getBoundingClientRect()
        return (
          <svg
            data-direct-edit="hover-highlight"
            className="pointer-events-none fixed inset-0 z-[99991]"
            width="100%"
            height="100%"
            style={{ width: '100vw', height: '100vh' }}
          >
            <rect
              x={cr.left}
              y={cr.top}
              width={cr.width}
              height={cr.height}
              fill="transparent"
              stroke="#3b82f6"
              strokeWidth={1}
            />
            {hoverHighlight.children.map((child) => {
              const r = child.getBoundingClientRect()
              return (
                <rect
                  key={`${r.left}-${r.top}-${r.width}-${r.height}`}
                  x={r.left}
                  y={r.top}
                  width={r.width}
                  height={r.height}
                  fill="transparent"
                  stroke="#3b82f6"
                  strokeWidth={1}
                  strokeDasharray="4 2"
                />
              )
            })}
          </svg>
        )
      })()}
    </>
  )
}
