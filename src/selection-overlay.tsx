import * as React from 'react'
import type { ActiveTool } from './types'
import type { SizingPropertyKey, SizingValue, SizingChangeOptions } from './types'
import type { StartDragOptions } from './use-move'
import { elementFromPointWithoutOverlays, detectSizingMode } from './utils'
import { useSelectionResize, type ResizeHandle } from './use-selection-resize'
import { useViewportEvents } from './hooks/use-viewport-events'

const BLUE = '#0D99FF'
const MAGENTA = '#E11BB6'
const DRAG_THRESHOLD = 4
const DBLCLICK_DELAY = 300
const HANDLE_SIZE = 12
const RESIZE_CORNER_SIZE = 8
const RESIZE_EDGE_HIT_SIZE = 10
const RESIZE_CORNER_INSET = 1
const MIN_SIZE_PX = 1

function isFlexDisplay(display: string): boolean {
  return display === 'flex' || display === 'inline-flex'
}

function isInLayoutContainer(element: HTMLElement): boolean {
  const parent = element.parentElement
  if (!parent) return false
  const display = window.getComputedStyle(parent).display
  return isFlexDisplay(display)
    || display === 'grid' || display === 'inline-grid'
}

function getEdgeHandleAtPoint(
  clientX: number,
  clientY: number,
  rect: DOMRect
): 'top' | 'right' | 'bottom' | 'left' | null {
  const localX = clientX - rect.left
  const localY = clientY - rect.top
  const halfHit = RESIZE_EDGE_HIT_SIZE / 2

  const withinHorizontalSpan = localX >= RESIZE_CORNER_SIZE && localX <= rect.width - RESIZE_CORNER_SIZE
  const withinVerticalSpan = localY >= RESIZE_CORNER_SIZE && localY <= rect.height - RESIZE_CORNER_SIZE

  if (withinHorizontalSpan && localY >= -halfHit && localY <= halfHit) return 'top'
  if (withinHorizontalSpan && localY >= rect.height - halfHit && localY <= rect.height + halfHit) return 'bottom'
  if (withinVerticalSpan && localX >= -halfHit && localX <= halfHit) return 'left'
  if (withinVerticalSpan && localX >= rect.width - halfHit && localX <= rect.width + halfHit) return 'right'

  return null
}

export interface SelectionOverlayProps {
  selectedElement: HTMLElement
  draggedElement?: HTMLElement | null
  isDragging: boolean
  ghostPosition?: { x: number; y: number }
  onMoveStart: (
    e: React.PointerEvent,
    targetElement?: HTMLElement,
    options?: StartDragOptions
  ) => void
  showMoveHandle?: boolean
  activeTool?: ActiveTool
  isTextEditing?: boolean
  onDoubleClick?: (clientX: number, clientY: number) => void
  onHoverElement?: (element: HTMLElement | null) => void
  onClickThrough?: (clientX: number, clientY: number) => void
  enableResizeHandles?: boolean
  onResizeSizingChange?: (
    changes: Partial<Record<SizingPropertyKey, SizingValue>>,
    options?: SizingChangeOptions
  ) => void
}

export function SelectionOverlay({
  selectedElement,
  draggedElement,
  isDragging,
  ghostPosition,
  onMoveStart,
  showMoveHandle = false,
  activeTool = 'select',
  isTextEditing,
  onDoubleClick,
  onHoverElement,
  onClickThrough,
  enableResizeHandles = false,
  onResizeSizingChange,
}: SelectionOverlayProps) {
  const rectElement = isDragging && draggedElement ? draggedElement : selectedElement
  const [rect, setRect] = React.useState(() => rectElement.getBoundingClientRect())
  const [moveHandleRects, setMoveHandleRects] = React.useState<Array<{
    target: HTMLElement
    left: number
    top: number
    width: number
    height: number
  }>>([])
  const cleanupRef = React.useRef<(() => void) | null>(null)
  const clickThroughTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const isDraggingRef = React.useRef(isDragging)
  isDraggingRef.current = isDragging
  const showResizeHandles = enableResizeHandles && !isDragging && !isTextEditing && activeTool === 'select'
  const edgeHandleWidth = Math.max(0, rect.width - RESIZE_CORNER_SIZE * 2)
  const edgeHandleHeight = Math.max(0, rect.height - RESIZE_CORNER_SIZE * 2)

  const {
    getResizeHandlePointerDown,
    getResizeHandleDoubleClick,
  } = useSelectionResize({
    selectedElement,
    enabled: showResizeHandles,
    onResizeSizingChange,
  })

  React.useLayoutEffect(() => {
    if (!isDragging) {
      setRect(rectElement.getBoundingClientRect())
    }
  }, [isDragging, rectElement])

  useViewportEvents(() => {
    if (isDraggingRef.current) return
    setRect(rectElement.getBoundingClientRect())
  })

  React.useEffect(() => {
    function updateRect() {
      if (isDraggingRef.current) return
      setRect(rectElement.getBoundingClientRect())
    }

    const observer = new MutationObserver(updateRect)
    observer.observe(rectElement, {
      attributes: true,
      childList: true,
      subtree: true,
    })

    return () => {
      observer.disconnect()
    }
  }, [rectElement])

  React.useEffect(() => {
    return () => {
      cleanupRef.current?.()
      if (clickThroughTimerRef.current) clearTimeout(clickThroughTimerRef.current)
    }
  }, [])

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return
    e.stopPropagation()
    // No preventDefault — allows browser to generate native dblclick events

    cleanupRef.current?.()
    if (clickThroughTimerRef.current) {
      clearTimeout(clickThroughTimerRef.current)
      clickThroughTimerRef.current = null
    }

    const origin = { x: e.clientX, y: e.clientY }
    const savedEvent = e

    const blockSelectStart = (se: Event) => se.preventDefault()

    const onMove = (moveEvent: PointerEvent) => {
      const dx = moveEvent.clientX - origin.x
      const dy = moveEvent.clientY - origin.y
      if (dx * dx + dy * dy >= DRAG_THRESHOLD * DRAG_THRESHOLD) {
        cleanup()
        onMoveStart(savedEvent, undefined, {
          mode: isInLayoutContainer(selectedElement) ? 'free' : 'position',
        })
      }
    }

    const onUp = (upEvent: PointerEvent) => {
      cleanup()
      if (onClickThrough) {
        const { clientX, clientY } = upEvent
        clickThroughTimerRef.current = setTimeout(() => {
          clickThroughTimerRef.current = null
          onClickThrough(clientX, clientY)
        }, DBLCLICK_DELAY)
      }
    }

    const cleanup = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      document.removeEventListener('selectstart', blockSelectStart)
      cleanupRef.current = null
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    document.addEventListener('selectstart', blockSelectStart)
    cleanupRef.current = cleanup
  }

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (showResizeHandles && onResizeSizingChange) {
      const selectedRect = selectedElement.getBoundingClientRect()
      const edgeHandle = getEdgeHandleAtPoint(e.clientX, e.clientY, selectedRect)
      if (edgeHandle) {
        const hasElementChildren = selectedElement.children.length > 0
        const hasTextContent = Boolean(selectedElement.textContent?.trim())
        const isEligibleElement = hasElementChildren || hasTextContent

        if (isEligibleElement) {
          e.preventDefault()
          e.stopPropagation()

          const width = Math.max(MIN_SIZE_PX, Math.round(selectedRect.width))
          const height = Math.max(MIN_SIZE_PX, Math.round(selectedRect.height))

          if (edgeHandle === 'left' || edgeHandle === 'right') {
            onResizeSizingChange({
              width: {
                mode: 'fit',
                value: { numericValue: width, unit: 'px', raw: `${width}px` },
              },
            })
          } else {
            onResizeSizingChange({
              height: {
                mode: 'fit',
                value: { numericValue: height, unit: 'px', raw: `${height}px` },
              },
            })
          }
          return
        }
      }
    }

    e.preventDefault()
    e.stopPropagation()
    cleanupRef.current?.()
    if (clickThroughTimerRef.current) {
      clearTimeout(clickThroughTimerRef.current)
      clickThroughTimerRef.current = null
    }
    onDoubleClick?.(e.clientX, e.clientY)
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!onHoverElement) return
    const elementUnder = elementFromPointWithoutOverlays(e.clientX, e.clientY)
    onHoverElement(elementUnder)
  }

  const handleMouseLeave = () => {
    onHoverElement?.(null)
  }

  const getMoveHandleTargets = React.useCallback(() => {
    if (!showMoveHandle) return []
    const htmlChildren = (parent: HTMLElement) =>
      Array.from(parent.children).filter((child): child is HTMLElement => child instanceof HTMLElement)

    // When selecting a flex item (or any nested descendant), expose move handles for all siblings.
    let flexParent: HTMLElement | null = selectedElement.parentElement
    while (flexParent) {
      const display = window.getComputedStyle(flexParent).display
      if (isFlexDisplay(display) && flexParent.children.length > 1) {
        return htmlChildren(flexParent)
      }
      flexParent = flexParent.parentElement
    }

    const selectedDisplay = window.getComputedStyle(selectedElement).display
    if (isFlexDisplay(selectedDisplay) && selectedElement.children.length > 1) {
      return htmlChildren(selectedElement)
    }

    return []
  }, [selectedElement, showMoveHandle])

  const [moveHandleTargets, setMoveHandleTargets] = React.useState<HTMLElement[]>([])

  // Effect 1: Compute which elements are move targets (calls getComputedStyle — infrequent)
  React.useEffect(() => {
    if (!showMoveHandle || isDragging || isTextEditing) {
      setMoveHandleTargets([])
      return
    }
    setMoveHandleTargets(getMoveHandleTargets())
  }, [
    selectedElement,
    selectedElement.parentElement,
    selectedElement.childElementCount,
    showMoveHandle,
    isDragging,
    isTextEditing,
    getMoveHandleTargets,
  ])

  // Effect 2: Compute screen rects from cached targets (only getBoundingClientRect, no getComputedStyle)
  React.useEffect(() => {
    if (moveHandleTargets.length === 0) {
      setMoveHandleRects([])
      return
    }
    setMoveHandleRects(moveHandleTargets.map((target) => {
      const targetRect = target.getBoundingClientRect()
      return {
        target,
        left: targetRect.left,
        top: targetRect.top,
        width: targetRect.width,
        height: targetRect.height,
      }
    }))
  }, [rect, moveHandleTargets])

  const handleMoveHandlePointerDown = React.useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return
    const index = Number(e.currentTarget.dataset.moveIndex)
    const target = moveHandleTargets[index]
    if (!target) return
    e.preventDefault()
    e.stopPropagation()
    cleanupRef.current?.()
    if (clickThroughTimerRef.current) {
      clearTimeout(clickThroughTimerRef.current)
      clickThroughTimerRef.current = null
    }
    onMoveStart(e, target, { constrainToOriginalParent: true, mode: 'reorder' })
  }, [moveHandleTargets, onMoveStart])

  const displayX = isDragging && ghostPosition ? ghostPosition.x : rect.left
  const displayY = isDragging && ghostPosition ? ghostPosition.y : rect.top
  const edgeHandles: Array<{ handle: ResizeHandle; style: React.CSSProperties; cursor: string }> = [
    {
      handle: 'top',
      cursor: 'ns-resize',
      style: {
        left: RESIZE_CORNER_SIZE,
        top: -RESIZE_EDGE_HIT_SIZE / 2,
        width: edgeHandleWidth,
        height: RESIZE_EDGE_HIT_SIZE,
      },
    },
    {
      handle: 'right',
      cursor: 'ew-resize',
      style: {
        right: -RESIZE_EDGE_HIT_SIZE / 2,
        top: RESIZE_CORNER_SIZE,
        width: RESIZE_EDGE_HIT_SIZE,
        height: edgeHandleHeight,
      },
    },
    {
      handle: 'bottom',
      cursor: 'ns-resize',
      style: {
        left: RESIZE_CORNER_SIZE,
        bottom: -RESIZE_EDGE_HIT_SIZE / 2,
        width: edgeHandleWidth,
        height: RESIZE_EDGE_HIT_SIZE,
      },
    },
    {
      handle: 'left',
      cursor: 'ew-resize',
      style: {
        left: -RESIZE_EDGE_HIT_SIZE / 2,
        top: RESIZE_CORNER_SIZE,
        width: RESIZE_EDGE_HIT_SIZE,
        height: edgeHandleHeight,
      },
    },
  ]
  const cornerHandles: Array<{ handle: ResizeHandle; style: React.CSSProperties; cursor: string }> = [
    {
      handle: 'top-left',
      cursor: 'nwse-resize',
      style: {
        left: -RESIZE_CORNER_SIZE / 2 + RESIZE_CORNER_INSET,
        top: -RESIZE_CORNER_SIZE / 2 + RESIZE_CORNER_INSET,
      },
    },
    {
      handle: 'top-right',
      cursor: 'nesw-resize',
      style: {
        right: -RESIZE_CORNER_SIZE / 2 + RESIZE_CORNER_INSET,
        top: -RESIZE_CORNER_SIZE / 2 + RESIZE_CORNER_INSET,
      },
    },
    {
      handle: 'bottom-right',
      cursor: 'nwse-resize',
      style: {
        right: -RESIZE_CORNER_SIZE / 2 + RESIZE_CORNER_INSET,
        bottom: -RESIZE_CORNER_SIZE / 2 + RESIZE_CORNER_INSET,
      },
    },
    {
      handle: 'bottom-left',
      cursor: 'nesw-resize',
      style: {
        left: -RESIZE_CORNER_SIZE / 2 + RESIZE_CORNER_INSET,
        bottom: -RESIZE_CORNER_SIZE / 2 + RESIZE_CORNER_INSET,
      },
    },
  ]

  const w = Math.round(selectedElement.offsetWidth)
  const h = Math.round(selectedElement.offsetHeight)
  const wMode = detectSizingMode(selectedElement, 'width')
  const hMode = detectSizingMode(selectedElement, 'height')
  const wLabel = wMode === 'fixed' ? `${w}` : wMode === 'fill' ? `${w} Fill` : `${w} Fit`
  const hLabel = hMode === 'fixed' ? `${h}` : hMode === 'fill' ? `${h} Fill` : `${h} Fit`
  const dimensionText = `${wLabel} × ${hLabel}`

  return (
    <>
      {!isTextEditing && (
        <div
          data-direct-edit="selection-overlay"
          style={{
            position: 'fixed',
            left: displayX,
            top: displayY,
            width: rect.width,
            height: rect.height,
            pointerEvents: 'none',
            zIndex: 99996,
            border: `1px solid ${BLUE}`,
            borderRadius: '0px',
            boxSizing: 'border-box',
          }}
        />
      )}

      {!isTextEditing && (
        <div
          data-direct-edit="dimension-label"
          style={{
            position: 'fixed',
            left: displayX + rect.width / 2,
            top: displayY + rect.height + 4,
            transform: 'translateX(-50%)',
            pointerEvents: 'none',
            zIndex: 99992,
            background: BLUE,
            color: 'white',
            fontSize: '11px',
            lineHeight: '20px',
            padding: '0 6px',
            borderRadius: '4px',
            whiteSpace: 'nowrap',
            fontFamily: 'system-ui, sans-serif',
            fontWeight: 500,
            letterSpacing: '-0.01em',
          }}
        >
          {dimensionText}
        </div>
      )}

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
            pointerEvents: activeTool === 'comment' ? 'none' : 'auto',
          }}
          onPointerDown={handlePointerDown}
          onDoubleClick={handleDoubleClick}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          {showResizeHandles && edgeHandles.map(({ handle, style, cursor }) => (
            <button
              key={handle}
              type="button"
              data-direct-edit="resize-handle"
              data-resize-handle={handle}
              aria-label={`Resize ${handle}`}
              title={`Resize ${handle}`}
              style={{
                position: 'absolute',
                border: 'none',
                background: 'transparent',
                padding: 0,
                pointerEvents: 'auto',
                cursor,
                ...style,
              }}
              onPointerDown={getResizeHandlePointerDown(handle)}
              onDoubleClick={getResizeHandleDoubleClick(handle)}
            />
          ))}

          {showResizeHandles && cornerHandles.map(({ handle, style, cursor }) => (
            <button
              key={handle}
              type="button"
              data-direct-edit="resize-handle"
              data-resize-handle={handle}
              aria-label={`Resize ${handle}`}
              title={`Resize ${handle}`}
              style={{
                position: 'absolute',
                width: RESIZE_CORNER_SIZE,
                height: RESIZE_CORNER_SIZE,
                border: `1px solid ${BLUE}`,
                background: '#fff',
                borderRadius: 1,
                boxSizing: 'border-box',
                padding: 0,
                pointerEvents: 'auto',
                cursor,
                ...style,
              }}
              onPointerDown={getResizeHandlePointerDown(handle)}
            />
          ))}

          {moveHandleRects.map((targetRect, i) => {
            return (
              <button
                key={`${targetRect.left}-${targetRect.top}-${targetRect.width}-${targetRect.height}`}
                type="button"
                data-direct-edit="move-handle"
                data-move-index={i}
                aria-label="Move element"
                title="Drag to reorder"
                style={{
                  position: 'absolute',
                  left: targetRect.left - rect.left + targetRect.width / 2 - HANDLE_SIZE / 2,
                  top: targetRect.top - rect.top + targetRect.height / 2 - HANDLE_SIZE / 2,
                  width: HANDLE_SIZE,
                  height: HANDLE_SIZE,
                  borderRadius: 9999,
                  border: `1px solid ${MAGENTA}`,
                  background: 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: 'none',
                  cursor: 'grab',
                  pointerEvents: 'auto',
                  padding: 0,
                }}
                onPointerDown={handleMoveHandlePointerDown}
              />
            )
          })}
        </div>
      )}
    </>
  )
}
