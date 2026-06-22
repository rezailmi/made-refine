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

interface ScaleMatrix {
  a: number
  b: number
  c: number
  d: number
}

function multiplyMatrix(left: ScaleMatrix, right: ScaleMatrix): ScaleMatrix {
  return {
    a: left.a * right.a + left.c * right.b,
    b: left.b * right.a + left.d * right.b,
    c: left.a * right.c + left.c * right.d,
    d: left.b * right.c + left.d * right.d,
  }
}

function splitTransformArgs(raw: string): string[] {
  return raw.trim().replace(/,/g, ' ').split(/\s+/).filter(Boolean)
}

function parseAngleRadians(value: string): number {
  const numeric = Number.parseFloat(value)
  if (!Number.isFinite(numeric)) return 0
  const unit = value.trim().replace(String(numeric), '').trim().toLowerCase()

  switch (unit) {
    case 'rad':
      return numeric
    case 'turn':
      return numeric * Math.PI * 2
    case 'grad':
      return (numeric * Math.PI) / 200
    case 'deg':
    case '':
    default:
      return (numeric * Math.PI) / 180
  }
}

function parseTransformFunction(name: string, rawArgs: string): ScaleMatrix | null {
  const args = splitTransformArgs(rawArgs)

  switch (name.toLowerCase()) {
    case 'matrix': {
      if (args.length < 4) return null
      const [a, b, c, d] = args.map(Number.parseFloat)
      if (![a, b, c, d].every(Number.isFinite)) return null
      return { a, b, c, d }
    }
    case 'matrix3d': {
      if (args.length < 16) return null
      const values = args.map(Number.parseFloat)
      if (!values.every(Number.isFinite)) return null
      return { a: values[0], b: values[1], c: values[4], d: values[5] }
    }
    case 'scale': {
      const scaleX = Number.parseFloat(args[0] ?? '1')
      const scaleY = Number.parseFloat(args[1] ?? args[0] ?? '1')
      if (!Number.isFinite(scaleX) || !Number.isFinite(scaleY)) return null
      return { a: scaleX, b: 0, c: 0, d: scaleY }
    }
    case 'scalex': {
      const scaleX = Number.parseFloat(args[0] ?? '1')
      if (!Number.isFinite(scaleX)) return null
      return { a: scaleX, b: 0, c: 0, d: 1 }
    }
    case 'scaley': {
      const scaleY = Number.parseFloat(args[0] ?? '1')
      if (!Number.isFinite(scaleY)) return null
      return { a: 1, b: 0, c: 0, d: scaleY }
    }
    case 'rotate': {
      const angle = parseAngleRadians(args[0] ?? '0deg')
      const cos = Math.cos(angle)
      const sin = Math.sin(angle)
      return { a: cos, b: sin, c: -sin, d: cos }
    }
    case 'translate':
    case 'translatex':
    case 'translatey':
      return { a: 1, b: 0, c: 0, d: 1 }
    default:
      return null
  }
}

function parseTransformMatrix(transform: string): ScaleMatrix | null {
  const functionPattern = /([a-zA-Z0-9]+)\(([^)]*)\)/g
  let matrix: ScaleMatrix = { a: 1, b: 0, c: 0, d: 1 }
  let matched = false

  for (const match of transform.matchAll(functionPattern)) {
    const next = parseTransformFunction(match[1], match[2])
    if (!next) return null
    matrix = multiplyMatrix(matrix, next)
    matched = true
  }

  return matched ? matrix : null
}

function scaleFromMatrix(matrix: ScaleMatrix): { scaleX: number; scaleY: number } {
  return {
    scaleX: Math.hypot(matrix.a, matrix.b) || 1,
    scaleY: Math.hypot(matrix.c, matrix.d) || 1,
  }
}

function getRenderedOffsetScale(element: HTMLElement): { scaleX: number; scaleY: number } | null {
  const rect = element.getBoundingClientRect()
  const width = element.offsetWidth
  const height = element.offsetHeight
  if (width <= 0 || height <= 0 || rect.width <= 0 || rect.height <= 0) return null

  return {
    scaleX: rect.width / width,
    scaleY: rect.height / height,
  }
}

export function clampSize(value: number, minSize = 1): number {
  const safeMin = Math.max(1, toFinite(minSize, 1))
  const safeValue = toFinite(value, safeMin)
  return Math.max(safeMin, safeValue)
}

export function getElementScale(element: HTMLElement): { scaleX: number; scaleY: number } {
  const transform = getComputedStyle(element).transform
  if (!transform || transform === 'none') {
    return getRenderedOffsetScale(element) ?? { scaleX: 1, scaleY: 1 }
  }

  let transformMatrix: ScaleMatrix | null = null
  if (typeof DOMMatrix !== 'undefined') {
    try {
      const matrix = new DOMMatrix(transform)
      transformMatrix = matrix
    } catch {
      // jsdom returns transform functions like rotate(...) rather than matrix(...).
    }
  }

  transformMatrix = transformMatrix ?? parseTransformMatrix(transform)
  if (!transformMatrix) return getRenderedOffsetScale(element) ?? { scaleX: 1, scaleY: 1 }

  const localScale = scaleFromMatrix(transformMatrix)
  const rect = element.getBoundingClientRect()
  const width = element.offsetWidth
  const height = element.offsetHeight
  if (width <= 0 || height <= 0 || rect.width <= 0 || rect.height <= 0) return localScale

  const transformedWidth =
    Math.abs(transformMatrix.a) * width + Math.abs(transformMatrix.c) * height
  const transformedHeight =
    Math.abs(transformMatrix.b) * width + Math.abs(transformMatrix.d) * height
  if (transformedWidth <= 0 || transformedHeight <= 0) return localScale

  return {
    scaleX: (rect.width / transformedWidth) * localScale.scaleX,
    scaleY: (rect.height / transformedHeight) * localScale.scaleY,
  }
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
    parentContentWidth +
      elementPaddingLeft +
      elementPaddingRight +
      elementBorderLeft +
      elementBorderRight,
    1
  )
}
