import * as React from 'react'
import type { ActiveTool } from '../types'
import {
  isTextElement,
  resolveElementTarget,
  computeHoverHighlight,
  elementFromPointWithoutOverlays as _elementFromPointWithoutOverlays,
} from '../utils'

// Safe wrapper: elementFromPoint is unavailable in jsdom (tests).
// Returns null instead of throwing so capture handlers degrade gracefully.
function safeElementFromPoint(x: number, y: number): HTMLElement | null {
  try { return _elementFromPointWithoutOverlays(x, y) } catch { return null }
}

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

/**
 * Installs window/document capture-phase listeners for element interaction.
 *
 * The overlay div is pointer-events: none so wheel/scroll events pass through
 * to the page natively. All interaction (click, hover, etc.) is handled via
 * capture-phase listeners on window/document instead.
 *
 * When textEditingElement is set, the hook deactivates so the user can interact
 * with the text editing target directly. The blockClick listener in provider.tsx
 * serves as the fallback click guard during that period.
 */
function useInteractionCapture(props: InteractionOverlayProps) {
  const propsRef = React.useRef(props)
  propsRef.current = props

  const active = !props.textEditingElement

  React.useEffect(() => {
    if (!active) return

    const host = document.querySelector<HTMLElement>('[data-direct-edit-host]')

    // If the host is no longer connected, this effect is stale (e.g. test
    // teardown raced with cleanup). All handlers must bail out immediately.
    function isStale(): boolean {
      return !host || !host.isConnected
    }

    function isOwnUIEvent(e: Event): boolean {
      if (!host) return false
      // Use composedPath to get the original target before shadow DOM retargeting.
      // At the window level, e.target is retargeted to the host for all shadow
      // events — composedPath[0] preserves the actual clicked element.
      const origin = e.composedPath()[0]
      if (!(origin instanceof Node)) return false
      // The overlay and hover-highlight are pointer-events: none visual layers.
      // In real browsers, events pass through them to the page. In tests,
      // clicks may target them directly — treat as page interactions.
      if (origin instanceof Element && (
        origin.matches('[data-direct-edit="overlay"]')
        || origin.matches('[data-direct-edit="hover-highlight"]')
      )) return false
      // If the origin is inside our shadow tree, it's our UI (panel, toolbar, etc.).
      if (origin === host || host.contains(origin)) return true
      const root = origin.getRootNode()
      return root instanceof ShadowRoot && root.host === host
    }

    function handleClick(e: MouseEvent) {
      if (isStale() || isOwnUIEvent(e)) return

      e.preventDefault()
      e.stopPropagation()

      const p = propsRef.current
      p.onSetHoverHighlight(null)

      if (p.activeTool === 'comment') {
        if (p.hasPendingCommentDraft()) return
        const elementUnder = safeElementFromPoint(e.clientX, e.clientY)
        const target = (elementUnder && elementUnder !== document.body && elementUnder !== document.documentElement)
          ? resolveElementTarget(elementUnder, p.selectedElement)
          : document.body
        p.onAddComment(target, { x: e.clientX, y: e.clientY })
        return
      }

      if (p.activeCommentId) {
        p.onSetActiveCommentId(null)
        return
      }

      const elementUnder = safeElementFromPoint(e.clientX, e.clientY)
      if (elementUnder && elementUnder !== document.body && elementUnder !== document.documentElement) {
        const resolved = resolveElementTarget(elementUnder, p.selectedElement)
        p.onSelectElement(resolved)
      }
    }

    function handleDblClick(e: MouseEvent) {
      if (isStale() || isOwnUIEvent(e)) return

      e.preventDefault()
      e.stopPropagation()

      const p = propsRef.current
      if (p.activeTool !== 'select') return

      const elementUnder = safeElementFromPoint(e.clientX, e.clientY)
      if (elementUnder && elementUnder !== document.body && elementUnder !== document.documentElement) {
        const resolved = resolveElementTarget(elementUnder, p.selectedElement)
        if (isTextElement(resolved)) {
          if (p.selectedElement !== resolved) p.onSelectElement(resolved)
          p.onStartTextEditing(resolved)
        }
      }
    }

    function handleMouseMove(e: MouseEvent) {
      if (isStale() || isOwnUIEvent(e)) return

      const p = propsRef.current
      const elementUnder = safeElementFromPoint(e.clientX, e.clientY)
      p.onSetHoverHighlight(computeHoverHighlight(elementUnder, p.selectedElement))
    }

    function handleMouseDown(e: MouseEvent) {
      if (isStale() || isOwnUIEvent(e)) return

      // Block text selection drag on page elements
      e.preventDefault()
    }

    function handleContextMenu(e: MouseEvent) {
      if (isStale() || isOwnUIEvent(e)) return

      e.preventDefault()
    }

    function handleMouseLeave() {
      if (isStale()) return
      propsRef.current.onSetHoverHighlight(null)
    }

    // Cursor override: inject a <style> into the document head
    const cursorStyle = document.createElement('style')
    cursorStyle.setAttribute('data-direct-edit-cursor', '')
    const cursorValue = propsRef.current.activeTool === 'comment' ? 'crosshair' : 'default'
    cursorStyle.textContent = `* { cursor: ${cursorValue} !important; }`
    document.head.appendChild(cursorStyle)

    window.addEventListener('click', handleClick, true)
    window.addEventListener('dblclick', handleDblClick, true)
    document.addEventListener('mousemove', handleMouseMove, true)
    window.addEventListener('mousedown', handleMouseDown, true)
    document.addEventListener('contextmenu', handleContextMenu, true)
    document.documentElement.addEventListener('mouseleave', handleMouseLeave)

    return () => {
      window.removeEventListener('click', handleClick, true)
      window.removeEventListener('dblclick', handleDblClick, true)
      document.removeEventListener('mousemove', handleMouseMove, true)
      window.removeEventListener('mousedown', handleMouseDown, true)
      document.removeEventListener('contextmenu', handleContextMenu, true)
      document.documentElement.removeEventListener('mouseleave', handleMouseLeave)
      cursorStyle.remove()
    }
  }, [active])

  // Keep cursor style in sync with activeTool changes while hook is active
  React.useEffect(() => {
    if (!active) return
    const existing = document.querySelector('style[data-direct-edit-cursor]')
    if (!existing) return
    const cursorValue = props.activeTool === 'comment' ? 'crosshair' : 'default'
    existing.textContent = `* { cursor: ${cursorValue} !important; }`
  }, [active, props.activeTool])
}

export function InteractionOverlay(props: InteractionOverlayProps) {
  const { hoverHighlight } = props

  useInteractionCapture(props)

  return (
    <>
      <div
        role="presentation"
        data-direct-edit="overlay"
        className="fixed inset-0 z-[99990] pointer-events-none"
      />
      {hoverHighlight && (() => {
        const cr = hoverHighlight.flexContainer.getBoundingClientRect()
        return (
          <div
            data-direct-edit="hover-highlight"
            className="pointer-events-none fixed inset-0 z-[99991]"
          >
            <div
              style={{
                position: 'absolute',
                left: cr.left,
                top: cr.top,
                width: cr.width,
                height: cr.height,
                border: '1px solid #3b82f6',
                borderRadius: '0px',
                boxSizing: 'border-box',
              }}
            />
            {hoverHighlight.children.map((child) => {
              const r = child.getBoundingClientRect()
              return (
                <div
                  key={`${r.left}-${r.top}-${r.width}-${r.height}`}
                  style={{
                    position: 'absolute',
                    left: r.left,
                    top: r.top,
                    width: r.width,
                    height: r.height,
                    border: '1px dashed #3b82f6',
                    borderRadius: '0px',
                    boxSizing: 'border-box',
                  }}
                />
              )
            })}
          </div>
        )
      })()}
    </>
  )
}
