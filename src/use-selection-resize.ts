import * as React from 'react'
import type {
  SizingPropertyKey,
  SizingValue,
  SizingChangeOptions,
} from './types'
import { detectSizingMode } from './utils'
import {
  clampSize,
  computeCornerProportionalSize,
  computeEdgeSize,
  computeFillRenderedWidth,
  type ResizeHandle,
} from './utils/resize-geometry'

const MIN_SIZE_PX = 1
const SNAP_IN_PX = 2
const SNAP_OUT_PX = 6
const EPSILON = 0.0001

const EDGE_HANDLES = new Set<ResizeHandle>(['top', 'right', 'bottom', 'left'])
const WIDTH_HANDLES = new Set<ResizeHandle>(['left', 'right', 'top-left', 'top-right', 'bottom-left', 'bottom-right'])
const HEIGHT_HANDLES = new Set<ResizeHandle>(['top', 'bottom', 'top-left', 'top-right', 'bottom-left', 'bottom-right'])

interface UseSelectionResizeOptions {
  selectedElement: HTMLElement
  enabled: boolean
  onResizeSizingChange?: (
    changes: Partial<Record<SizingPropertyKey, SizingValue>>,
    options?: SizingChangeOptions
  ) => void
}

interface DragState {
  transactionId: string
  handle: ResizeHandle
  startClientX: number
  startClientY: number
  startWidth: number
  startHeight: number
  scaleX: number
  scaleY: number
  fillTargetWidth: number | null
  fillLocked: boolean
}

function createSizingValue(mode: SizingValue['mode'], numericValue: number): SizingValue {
  const rounded = Math.max(MIN_SIZE_PX, Math.round(clampSize(numericValue, MIN_SIZE_PX)))
  return {
    mode,
    value: {
      numericValue: rounded,
      unit: 'px',
      raw: `${rounded}px`,
    },
  }
}

function isEdgeHandle(handle: ResizeHandle): handle is 'top' | 'right' | 'bottom' | 'left' {
  return EDGE_HANDLES.has(handle)
}

export interface SelectionResizeHandlers {
  getResizeHandlePointerDown: (handle: ResizeHandle) => (e: React.PointerEvent<HTMLElement>) => void
  getResizeHandleDoubleClick: (handle: ResizeHandle) => (e: React.MouseEvent<HTMLElement>) => void
}

export function useSelectionResize({
  selectedElement,
  enabled,
  onResizeSizingChange,
}: UseSelectionResizeOptions): SelectionResizeHandlers {
  const cleanupRef = React.useRef<(() => void) | null>(null)
  const txCounterRef = React.useRef(0)

  const emitSizingChange = React.useCallback((
    changes: Partial<Record<SizingPropertyKey, SizingValue>>,
    options?: SizingChangeOptions
  ) => {
    onResizeSizingChange?.(changes, options)
  }, [onResizeSizingChange])

  React.useEffect(() => {
    return () => {
      cleanupRef.current?.()
      cleanupRef.current = null
    }
  }, [])

  const getResizeHandlePointerDown = React.useCallback((handle: ResizeHandle) => {
    return (e: React.PointerEvent<HTMLElement>) => {
      if (!enabled || !onResizeSizingChange) return
      if (e.button !== 0) return

      e.preventDefault()
      e.stopPropagation()
      cleanupRef.current?.()

      const rect = selectedElement.getBoundingClientRect()
      const offsetWidth = selectedElement.offsetWidth
      const offsetHeight = selectedElement.offsetHeight
      const startWidth = clampSize(offsetWidth > 0 ? offsetWidth : rect.width, MIN_SIZE_PX)
      const startHeight = clampSize(offsetHeight > 0 ? offsetHeight : rect.height, MIN_SIZE_PX)

      const scaleX = Math.max(EPSILON, offsetWidth > 0 ? rect.width / offsetWidth : 1)
      const scaleY = Math.max(EPSILON, offsetHeight > 0 ? rect.height / offsetHeight : 1)
      const transactionId = `resize-${Date.now()}-${txCounterRef.current++}`

      const state: DragState = {
        transactionId,
        handle,
        startClientX: e.clientX,
        startClientY: e.clientY,
        startWidth,
        startHeight,
        scaleX,
        scaleY,
        fillTargetWidth: computeFillRenderedWidth(selectedElement),
        fillLocked: detectSizingMode(selectedElement, 'width') === 'fill',
      }

      emitSizingChange({}, { transactionId: state.transactionId, phase: 'start' })

      const onPointerMove = (moveEvent: PointerEvent) => {
        const dx = (moveEvent.clientX - state.startClientX) / state.scaleX
        const dy = (moveEvent.clientY - state.startClientY) / state.scaleY

        const nextSize = isEdgeHandle(state.handle)
          ? computeEdgeSize({
              handle: state.handle,
              startWidth: state.startWidth,
              startHeight: state.startHeight,
              dx,
              dy,
              minSize: MIN_SIZE_PX,
            })
          : computeCornerProportionalSize({
              handle: state.handle,
              startWidth: state.startWidth,
              startHeight: state.startHeight,
              dx,
              dy,
              minSize: MIN_SIZE_PX,
            })

        const nextWidth = Math.max(MIN_SIZE_PX, Math.round(nextSize.width))
        const nextHeight = Math.max(MIN_SIZE_PX, Math.round(nextSize.height))
        const changes: Partial<Record<SizingPropertyKey, SizingValue>> = {}

        if (WIDTH_HANDLES.has(state.handle)) {
          if (state.fillTargetWidth !== null) {
            const distance = Math.abs(nextWidth - state.fillTargetWidth)
            if (state.fillLocked) {
              if (distance > SNAP_OUT_PX) {
                state.fillLocked = false
              }
            } else if (distance <= SNAP_IN_PX) {
              state.fillLocked = true
            }
          } else {
            state.fillLocked = false
          }

          if (state.fillLocked) {
            const fillWidth = state.fillTargetWidth ?? nextWidth
            changes.width = createSizingValue('fill', fillWidth)
          } else {
            changes.width = createSizingValue('fixed', nextWidth)
          }
        }

        if (HEIGHT_HANDLES.has(state.handle)) {
          changes.height = createSizingValue('fixed', nextHeight)
        }

        if (Object.keys(changes).length === 0) return

        emitSizingChange(changes, { transactionId: state.transactionId, phase: 'update' })
      }

      const stop = () => {
        window.removeEventListener('pointermove', onPointerMove)
        window.removeEventListener('pointerup', stop)
        window.removeEventListener('pointercancel', stop)
        window.removeEventListener('blur', stop)
        cleanupRef.current = null
        emitSizingChange({}, { transactionId: state.transactionId, phase: 'end' })
      }

      cleanupRef.current = stop
      window.addEventListener('pointermove', onPointerMove)
      window.addEventListener('pointerup', stop)
      window.addEventListener('pointercancel', stop)
      window.addEventListener('blur', stop)
    }
  }, [emitSizingChange, enabled, onResizeSizingChange, selectedElement])

  const getResizeHandleDoubleClick = React.useCallback((handle: ResizeHandle) => {
    return (e: React.MouseEvent<HTMLElement>) => {
      if (!enabled || !onResizeSizingChange) return
      if (!isEdgeHandle(handle)) return
      const hasElementChildren = selectedElement.children.length > 0
      const hasTextContent = Boolean(selectedElement.textContent?.trim())
      const isEligibleElement = hasElementChildren || hasTextContent
      if (!isEligibleElement) return

      e.preventDefault()
      e.stopPropagation()

      const rect = selectedElement.getBoundingClientRect()
      const width = Math.max(MIN_SIZE_PX, Math.round(rect.width))
      const height = Math.max(MIN_SIZE_PX, Math.round(rect.height))

      if (handle === 'left' || handle === 'right') {
        emitSizingChange({ width: createSizingValue('fit', width) })
      } else {
        emitSizingChange({ height: createSizingValue('fit', height) })
      }
    }
  }, [emitSizingChange, enabled, onResizeSizingChange, selectedElement])

  return {
    getResizeHandlePointerDown,
    getResizeHandleDoubleClick,
  }
}

export type { ResizeHandle }
