export type ResizeHandle =
  | 'top'
  | 'right'
  | 'bottom'
  | 'left'
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'

interface ResizeComputationResult {
  width: number
  height: number
}

interface ComputeEdgeSizeInput {
  handle: 'top' | 'right' | 'bottom' | 'left'
  startWidth: number
  startHeight: number
  dx: number
  dy: number
  minSize?: number
}

interface ComputeCornerSizeInput {
  handle: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  startWidth: number
  startHeight: number
  dx: number
  dy: number
  minSize?: number
}

function toFinite(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback
  return value
}

export function clampSize(value: number, minSize = 1): number {
  const safeMin = Math.max(1, toFinite(minSize, 1))
  const safeValue = toFinite(value, safeMin)
  return Math.max(safeMin, safeValue)
}

export function computeEdgeSize({
  handle,
  startWidth,
  startHeight,
  dx,
  dy,
  minSize = 1,
}: ComputeEdgeSizeInput): ResizeComputationResult {
  const baseWidth = clampSize(startWidth, minSize)
  const baseHeight = clampSize(startHeight, minSize)

  switch (handle) {
    case 'right':
      return { width: clampSize(baseWidth + dx, minSize), height: baseHeight }
    case 'left':
      return { width: clampSize(baseWidth - dx, minSize), height: baseHeight }
    case 'bottom':
      return { width: baseWidth, height: clampSize(baseHeight + dy, minSize) }
    case 'top':
      return { width: baseWidth, height: clampSize(baseHeight - dy, minSize) }
  }
}

export function computeCornerProportionalSize({
  handle,
  startWidth,
  startHeight,
  dx,
  dy,
  minSize = 1,
}: ComputeCornerSizeInput): ResizeComputationResult {
  const baseWidth = clampSize(startWidth, minSize)
  const baseHeight = clampSize(startHeight, minSize)
  const ratio = baseWidth > 0 && baseHeight > 0 ? baseWidth / baseHeight : 1

  const widthSign = handle === 'top-left' || handle === 'bottom-left' ? -1 : 1
  const heightSign = handle === 'top-left' || handle === 'top-right' ? -1 : 1

  const rawWidth = baseWidth + widthSign * dx
  const rawHeight = baseHeight + heightSign * dy
  const widthIntent = clampSize(rawWidth, minSize)
  const heightIntent = clampSize(rawHeight, minSize)

  const widthChange = Math.abs(widthIntent - baseWidth) / Math.max(baseWidth, 1)
  const heightChange = Math.abs(heightIntent - baseHeight) / Math.max(baseHeight, 1)

  if (widthChange >= heightChange) {
    const width = clampSize(widthIntent, minSize)
    const height = clampSize(width / Math.max(ratio, 0.0001), minSize)
    return { width, height }
  }

  const height = clampSize(heightIntent, minSize)
  const width = clampSize(height * ratio, minSize)
  return { width, height }
}

export function computeFillRenderedWidth(element: HTMLElement): number | null {
  const parent = element.parentElement
  if (!parent) return null

  const parentComputed = window.getComputedStyle(parent)
  const elementComputed = window.getComputedStyle(element)

  const parentClientWidth = parent.clientWidth
  const parentPaddingLeft = parseFloat(parentComputed.paddingLeft) || 0
  const parentPaddingRight = parseFloat(parentComputed.paddingRight) || 0
  const parentContentWidth = parentClientWidth - parentPaddingLeft - parentPaddingRight
  if (!Number.isFinite(parentContentWidth) || parentContentWidth <= 0) {
    return null
  }

  const elementPaddingLeft = parseFloat(elementComputed.paddingLeft) || 0
  const elementPaddingRight = parseFloat(elementComputed.paddingRight) || 0
  const elementBorderLeft = parseFloat(elementComputed.borderLeftWidth) || 0
  const elementBorderRight = parseFloat(elementComputed.borderRightWidth) || 0

  if (elementComputed.boxSizing === 'border-box') {
    return clampSize(parentContentWidth, 1)
  }

  return clampSize(
    parentContentWidth + elementPaddingLeft + elementPaddingRight + elementBorderLeft + elementBorderRight,
    1
  )
}
