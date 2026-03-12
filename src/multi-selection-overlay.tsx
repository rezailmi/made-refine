import * as React from 'react'
import { useViewportEvents } from './hooks/use-viewport-events'

const BLUE = '#0D99FF'

interface SelectionRect {
  element: HTMLElement
  rect: DOMRect
}

export interface MultiSelectionOverlayProps {
  selectedElements: HTMLElement[]
}

function dedupeConnectedElements(elements: HTMLElement[]): HTMLElement[] {
  const seen = new Set<HTMLElement>()
  const result: HTMLElement[] = []

  for (const element of elements) {
    if (!element.isConnected || seen.has(element)) continue
    seen.add(element)
    result.push(element)
  }

  return result
}

function getGroupBounds(rects: DOMRect[]) {
  return rects.reduce((bounds, rect) => ({
    left: Math.min(bounds.left, rect.left),
    top: Math.min(bounds.top, rect.top),
    right: Math.max(bounds.right, rect.right),
    bottom: Math.max(bounds.bottom, rect.bottom),
  }), {
    left: rects[0].left,
    top: rects[0].top,
    right: rects[0].right,
    bottom: rects[0].bottom,
  })
}

export function MultiSelectionOverlay({ selectedElements }: MultiSelectionOverlayProps) {
  const elements = React.useMemo(
    () => dedupeConnectedElements(selectedElements),
    [selectedElements],
  )
  const [selectionRects, setSelectionRects] = React.useState<SelectionRect[]>([])

  const updateRects = React.useCallback(() => {
    setSelectionRects(elements.map((element) => ({
      element,
      rect: element.getBoundingClientRect(),
    })))
  }, [elements])

  React.useLayoutEffect(() => {
    updateRects()
  }, [updateRects])

  useViewportEvents(() => {
    updateRects()
  })

  React.useEffect(() => {
    if (elements.length === 0) {
      setSelectionRects([])
      return
    }

    const observer = new MutationObserver(updateRects)
    for (const element of elements) {
      observer.observe(element, {
        attributes: true,
        childList: true,
        subtree: true,
      })
    }

    return () => {
      observer.disconnect()
    }
  }, [elements, updateRects])

  if (selectionRects.length === 0) return null

  const groupBounds = getGroupBounds(selectionRects.map(({ rect }) => rect))
  const groupWidth = Math.max(0, groupBounds.right - groupBounds.left)
  const groupHeight = Math.max(0, groupBounds.bottom - groupBounds.top)

  return (
    <>
      <div
        data-direct-edit="selection-overlay-group"
        style={{
          position: 'fixed',
          left: groupBounds.left,
          top: groupBounds.top,
          width: groupWidth,
          height: groupHeight,
          pointerEvents: 'none',
          zIndex: 99995,
          border: `1px dashed ${BLUE}`,
          borderRadius: '12px',
          boxSizing: 'border-box',
        }}
      />

      {selectionRects.map(({ element, rect }) => (
        <div
          key={`${element.id || element.tagName}-${rect.left}-${rect.top}-${rect.width}-${rect.height}`}
          data-direct-edit="selection-overlay-box"
          style={{
            position: 'fixed',
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height,
            pointerEvents: 'none',
            zIndex: 99996,
            border: `1px solid ${BLUE}`,
            borderRadius: '0px',
            boxSizing: 'border-box',
          }}
        />
      ))}
    </>
  )
}
