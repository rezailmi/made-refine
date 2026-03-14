import * as React from 'react'
import {
  isTextElement,
  resolveElementTarget,
  computeHoverHighlight,
  elementFromPointWithoutOverlays as _elementFromPointWithoutOverlays,
} from '../utils'

const DRAG_SELECT_THRESHOLD = 4

interface MarqueeRect {
  left: number
  top: number
  width: number
  height: number
}

// Safe wrapper: elementFromPoint is unavailable in jsdom (tests).
// Returns null instead of throwing so capture handlers degrade gracefully.
function safeElementFromPoint(x: number, y: number): HTMLElement | null {
  try { return _elementFromPointWithoutOverlays(x, y) } catch { return null }
}

function normalizeMarqueeRect(originX: number, originY: number, clientX: number, clientY: number): MarqueeRect {
  const left = Math.min(originX, clientX)
  const top = Math.min(originY, clientY)
  return {
    left,
    top,
    width: Math.abs(clientX - originX),
    height: Math.abs(clientY - originY),
  }
}

function rectsIntersect(a: MarqueeRect, b: DOMRect): boolean {
  return !(
    a.left + a.width < b.left
    || b.right < a.left
    || a.top + a.height < b.top
    || b.bottom < a.top
  )
}

function isSelectableElement(element: Element): element is HTMLElement {
  if (!(element instanceof HTMLElement)) return false
  if (!element.isConnected) return false
  if (element === document.body || element === document.documentElement) return false
  if (element.matches('[data-direct-edit], [data-direct-edit-host], script, style, link, meta, noscript')) return false

  const rect = element.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return false

  const computed = window.getComputedStyle(element)
  if (computed.display === 'none' || computed.visibility === 'hidden') return false
  const opacity = Number.parseFloat(computed.opacity)
  if (Number.isFinite(opacity) && opacity <= 0) return false

  return true
}

function compareDomOrder(a: HTMLElement, b: HTMLElement): number {
  if (a === b) return 0
  const position = a.compareDocumentPosition(b)
  if (position & Node.DOCUMENT_POSITION_FOLLOWING) return -1
  if (position & Node.DOCUMENT_POSITION_PRECEDING) return 1
  return 0
}

function collectMarqueeTargets(rect: MarqueeRect): HTMLElement[] {
  const hits = Array.from(document.querySelectorAll('*'))
    .filter(isSelectableElement)
    .filter((element) => rectsIntersect(rect, element.getBoundingClientRect()))

  const deepestHits = hits.filter((element) => (
    !hits.some((other) => other !== element && element.contains(other))
  ))

  deepestHits.sort(compareDomOrder)
  return deepestHits
}

export interface InteractionOverlayProps {
  selectedElement: HTMLElement | null
  selectedElements: HTMLElement[]
  textEditingElement: HTMLElement | null
  activeCommentId: string | null
  hoverHighlight: {
    flexContainer: HTMLElement
    children: HTMLElement[]
  } | null
  onSelectElement: (element: HTMLElement) => void
  onSelectElements: (
    elements: HTMLElement[],
    options?: { additive?: boolean; primaryElement?: HTMLElement | null }
  ) => void
  onToggleElementSelection: (element: HTMLElement) => void
  onClearSelection: () => void
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
function useInteractionCapture(props: InteractionOverlayProps): MarqueeRect | null {
  const propsRef = React.useRef(props)
  propsRef.current = props

  const active = !props.textEditingElement
  const [marqueeRect, setMarqueeRect] = React.useState<MarqueeRect | null>(null)

  React.useEffect(() => {
    if (!active) {
      setMarqueeRect(null)
    }
  }, [active])

  React.useEffect(() => {
    if (!active) return

    const host = document.querySelector<HTMLElement>('[data-direct-edit-host]')
    const suppressClickRef = { current: false }
    let lastMouseX = 0
    let lastMouseY = 0
    let dragSession:
      | {
          originX: number
          originY: number
          additive: boolean
          marqueeStarted: boolean
        }
      | null = null

    function isStale(): boolean {
      return !host || !host.isConnected
    }

    function isOwnUIEvent(e: Event): boolean {
      if (!host) return false
      const origin = e.composedPath()[0]
      if (!(origin instanceof Node)) return false
      if (origin instanceof Element && (
        origin.matches('[data-direct-edit="overlay"]')
        || origin.matches('[data-direct-edit="hover-highlight"]')
        || origin.matches('[data-direct-edit="marquee-select"]')
      )) {
        return false
      }
      if (origin === host || host.contains(origin)) return true
      const root = origin.getRootNode()
      return root instanceof ShadowRoot && root.host === host
    }

    function clearDragSession() {
      dragSession = null
      setMarqueeRect(null)
    }

    function handleClick(e: MouseEvent) {
      if (isStale() || isOwnUIEvent(e)) return

      e.preventDefault()
      e.stopPropagation()

      if (suppressClickRef.current) {
        suppressClickRef.current = false
        return
      }

      const p = propsRef.current
      p.onSetHoverHighlight(null)

      if (p.hasPendingCommentDraft()) return

      const elementUnder = safeElementFromPoint(e.clientX, e.clientY)
      const target = (elementUnder && elementUnder !== document.body && elementUnder !== document.documentElement)
        ? resolveElementTarget(elementUnder, p.selectedElement)
        : null

      if (p.activeCommentId) {
        p.onSetActiveCommentId(null)
      }

      if (!target) {
        return
      }

      if (e.shiftKey) {
        p.onToggleElementSelection(target)
        return
      }

      const targetIsSelected = p.selectedElements.includes(target)
      if (p.selectedElements.length > 1) {
        p.onSelectElement(target)
        return
      }

      if (!targetIsSelected || target !== p.selectedElement) {
        p.onSelectElement(target)
        return
      }

      if (!p.activeCommentId) {
        p.onAddComment(target, { x: e.clientX, y: e.clientY })
      }
    }

    function handleDblClick(e: MouseEvent) {
      if (isStale() || isOwnUIEvent(e)) return

      e.preventDefault()
      e.stopPropagation()

      const p = propsRef.current
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

      lastMouseX = e.clientX
      lastMouseY = e.clientY

      if (dragSession?.marqueeStarted) return

      const p = propsRef.current
      const elementUnder = safeElementFromPoint(e.clientX, e.clientY)
      p.onSetHoverHighlight(computeHoverHighlight(elementUnder, p.selectedElement))
    }

    function handleScroll() {
      if (isStale() || dragSession?.marqueeStarted) return
      const p = propsRef.current
      const elementUnder = safeElementFromPoint(lastMouseX, lastMouseY)
      p.onSetHoverHighlight(computeHoverHighlight(elementUnder, p.selectedElement))
    }

    function handleWindowPointerMove(e: PointerEvent) {
      if (isStale() || !dragSession) return
      const dx = e.clientX - dragSession.originX
      const dy = e.clientY - dragSession.originY
      const distanceSquared = dx * dx + dy * dy

      if (!dragSession.marqueeStarted) {
        if (distanceSquared < DRAG_SELECT_THRESHOLD * DRAG_SELECT_THRESHOLD) return
        dragSession.marqueeStarted = true
      }

      const nextRect = normalizeMarqueeRect(
        dragSession.originX,
        dragSession.originY,
        e.clientX,
        e.clientY,
      )

      propsRef.current.onSetHoverHighlight(null)
      setMarqueeRect(nextRect)
    }

    function handleWindowPointerUp(e: PointerEvent) {
      if (isStale() || !dragSession) return

      const wasMarquee = dragSession.marqueeStarted
      const additive = dragSession.additive
      const finalRect = wasMarquee
        ? normalizeMarqueeRect(dragSession.originX, dragSession.originY, e.clientX, e.clientY)
        : null

      clearDragSession()

      if (!wasMarquee || !finalRect) return

      const p = propsRef.current
      p.onSetHoverHighlight(null)
      if (p.hasPendingCommentDraft()) return
      suppressClickRef.current = true

      if (p.activeCommentId) {
        p.onSetActiveCommentId(null)
      }

      const hits = collectMarqueeTargets(finalRect)
      if (hits.length === 0) {
        if (!additive) {
          p.onClearSelection()
        }
        return
      }

      p.onSelectElements(hits, {
        additive,
        primaryElement: hits[hits.length - 1] ?? null,
      })
    }

    function handleWindowPointerCancel() {
      clearDragSession()
    }

    function handlePointerDown(e: PointerEvent) {
      if (isStale() || isOwnUIEvent(e)) return
      if (e.button !== 0) return

      // Only preventDefault for mouse — doing so on touch would kill scroll.
      if (e.pointerType === 'mouse') e.preventDefault()
      e.stopPropagation()

      dragSession = {
        originX: e.clientX,
        originY: e.clientY,
        additive: e.shiftKey,
        marqueeStarted: false,
      }
    }

    function handleMouseDown(e: MouseEvent) {
      if (isStale() || isOwnUIEvent(e)) return
      e.preventDefault()
      e.stopPropagation()
    }

    function handleContextMenu(e: MouseEvent) {
      if (isStale() || isOwnUIEvent(e)) return
      e.preventDefault()
    }

    function handleMouseLeave() {
      if (isStale() || dragSession?.marqueeStarted) return
      propsRef.current.onSetHoverHighlight(null)
    }

    const cursorStyle = document.createElement('style')
    cursorStyle.setAttribute('data-direct-edit-cursor', '')
    cursorStyle.textContent = '* { cursor: default !important; }'
    document.head.appendChild(cursorStyle)

    window.addEventListener('pointerdown', handlePointerDown, true)
    window.addEventListener('pointermove', handleWindowPointerMove, true)
    window.addEventListener('pointerup', handleWindowPointerUp, true)
    window.addEventListener('pointercancel', handleWindowPointerCancel, true)
    window.addEventListener('click', handleClick, true)
    window.addEventListener('dblclick', handleDblClick, true)
    document.addEventListener('mousemove', handleMouseMove, true)
    window.addEventListener('mousedown', handleMouseDown, true)
    document.addEventListener('contextmenu', handleContextMenu, true)
    document.documentElement.addEventListener('mouseleave', handleMouseLeave)
    window.addEventListener('scroll', handleScroll, true)

    return () => {
      clearDragSession()
      window.removeEventListener('pointerdown', handlePointerDown, true)
      window.removeEventListener('pointermove', handleWindowPointerMove, true)
      window.removeEventListener('pointerup', handleWindowPointerUp, true)
      window.removeEventListener('pointercancel', handleWindowPointerCancel, true)
      window.removeEventListener('click', handleClick, true)
      window.removeEventListener('dblclick', handleDblClick, true)
      document.removeEventListener('mousemove', handleMouseMove, true)
      window.removeEventListener('mousedown', handleMouseDown, true)
      document.removeEventListener('contextmenu', handleContextMenu, true)
      document.documentElement.removeEventListener('mouseleave', handleMouseLeave)
      window.removeEventListener('scroll', handleScroll, true)
      cursorStyle.remove()
    }
  }, [active])

  React.useEffect(() => {
    if (!active) return
    const existing = document.querySelector('style[data-direct-edit-cursor]')
    if (!existing) return
    existing.textContent = '* { cursor: default !important; }'
  }, [active])

  return marqueeRect
}

export function InteractionOverlay(props: InteractionOverlayProps) {
  const { hoverHighlight } = props
  const marqueeRect = useInteractionCapture(props)

  return (
    <>
      <div
        role="presentation"
        data-direct-edit="overlay"
        className="fixed inset-0 z-[99990] pointer-events-none"
      />

      {marqueeRect && (
        <div
          data-direct-edit="marquee-select"
          style={{
            position: 'fixed',
            left: marqueeRect.left,
            top: marqueeRect.top,
            width: marqueeRect.width,
            height: marqueeRect.height,
            pointerEvents: 'none',
            zIndex: 99992,
            border: '1px solid rgba(13, 153, 255, 0.75)',
            background: 'rgba(13, 153, 255, 0.12)',
            boxSizing: 'border-box',
          }}
        />
      )}

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
