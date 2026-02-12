import type { ElementInfo, MeasurementLine, Guideline } from '../types'
import { isTextElement } from './element-selection'

export function getElementInfo(element: HTMLElement): ElementInfo {
  const computed = window.getComputedStyle(element)
  const parentElement = element.parentElement

  const isFlexContainer = computed.display === 'flex' || computed.display === 'inline-flex'

  let isFlexItem = false
  if (parentElement) {
    const parentComputed = window.getComputedStyle(parentElement)
    isFlexItem = parentComputed.display === 'flex' || parentComputed.display === 'inline-flex'
  }

  return {
    tagName: element.tagName.toLowerCase(),
    id: element.id || null,
    classList: Array.from(element.classList),
    isFlexContainer,
    isFlexItem,
    isTextElement: isTextElement(element),
    parentElement,
    hasChildren: element.children.length > 0,
  }
}

interface DimensionDisplay {
  width: string
  height: string
}

function isFitSizing(element: HTMLElement, dimension: 'width' | 'height'): boolean {
  const computed = window.getComputedStyle(element)
  const inlineValue = element.style[dimension]

  if (inlineValue === 'auto') return true

  const computedValue = computed[dimension]

  if (!inlineValue) {
    const parent = element.parentElement
    if (parent) {
      const parentComputed = window.getComputedStyle(parent)
      if (parentComputed.display === 'flex' || parentComputed.display === 'inline-flex') {
        const flexBasis = computed.flexBasis
        const flexGrow = computed.flexGrow
        if (flexBasis === 'auto' && flexGrow === '0') {
          return true
        }
      }
    }

    if (dimension === 'width') {
      if (computed.display === 'block' && !inlineValue) {
        return false
      }
      if (
        computed.display === 'inline-block' ||
        computed.display === 'inline-flex' ||
        computed.display === 'inline'
      ) {
        return true
      }
    }

    if (dimension === 'height') {
      return !inlineValue
    }
  }

  if (computedValue.includes('fit-content') || computedValue.includes('max-content')) {
    return true
  }

  return false
}

export function getDimensionDisplay(element: HTMLElement): DimensionDisplay {
  const rect = element.getBoundingClientRect()
  const width = Math.round(rect.width)
  const height = Math.round(rect.height)

  const widthIsFit = isFitSizing(element, 'width')
  const heightIsFit = isFitSizing(element, 'height')

  return {
    width: widthIsFit ? `Fit ${width}` : `${width}`,
    height: heightIsFit ? `Fit ${height}` : `${height}`,
  }
}


export function calculateParentMeasurements(element: HTMLElement, container?: HTMLElement): MeasurementLine[] {
  const parent = container ?? element.parentElement
  if (!parent) return []

  const elementRect = element.getBoundingClientRect()
  const parentRect = parent.getBoundingClientRect()

  // Use clientLeft/clientTop for reliable border widths, clientWidth/clientHeight
  // for inner dimensions (handles scrollbars correctly)
  const paddingBoxLeft = parentRect.left + parent.clientLeft
  const paddingBoxTop = parentRect.top + parent.clientTop
  const paddingBoxRight = parentRect.left + parent.clientLeft + parent.clientWidth
  const paddingBoxBottom = parentRect.top + parent.clientTop + parent.clientHeight

  let parentInnerLeft: number
  let parentInnerTop: number
  let parentInnerRight: number
  let parentInnerBottom: number

  if (container) {
    // Ancestor case: measure from padding-box (inside border, outside padding).
    // The ancestor's padding doesn't directly position the child — intermediate
    // elements do — so the visually correct edge is inside the border only.
    parentInnerLeft = paddingBoxLeft
    parentInnerTop = paddingBoxTop
    parentInnerRight = paddingBoxRight
    parentInnerBottom = paddingBoxBottom
  } else {
    // Direct parent case: measure from content-box (inside border and padding).
    // The parent's padding IS the gap between its edge and the child's layout area.
    const parentStyles = window.getComputedStyle(parent)
    parentInnerLeft = paddingBoxLeft + (parseFloat(parentStyles.paddingLeft) || 0)
    parentInnerTop = paddingBoxTop + (parseFloat(parentStyles.paddingTop) || 0)
    parentInnerRight = paddingBoxRight - (parseFloat(parentStyles.paddingRight) || 0)
    parentInnerBottom = paddingBoxBottom - (parseFloat(parentStyles.paddingBottom) || 0)
  }

  const measurements: MeasurementLine[] = []

  const topDistance = Math.round(elementRect.top - parentInnerTop)
  if (topDistance > 0) {
    const midX = elementRect.left + elementRect.width / 2
    measurements.push({
      direction: 'vertical',
      x1: midX,
      y1: parentInnerTop,
      x2: midX,
      y2: elementRect.top,
      distance: topDistance,
      labelPosition: { x: midX, y: (parentInnerTop + elementRect.top) / 2 },
    })
  }

  const bottomDistance = Math.round(parentInnerBottom - elementRect.bottom)
  if (bottomDistance > 0) {
    const midX = elementRect.left + elementRect.width / 2
    measurements.push({
      direction: 'vertical',
      x1: midX,
      y1: elementRect.bottom,
      x2: midX,
      y2: parentInnerBottom,
      distance: bottomDistance,
      labelPosition: { x: midX, y: (elementRect.bottom + parentInnerBottom) / 2 },
    })
  }

  const leftDistance = Math.round(elementRect.left - parentInnerLeft)
  if (leftDistance > 0) {
    const midY = elementRect.top + elementRect.height / 2
    measurements.push({
      direction: 'horizontal',
      x1: parentInnerLeft,
      y1: midY,
      x2: elementRect.left,
      y2: midY,
      distance: leftDistance,
      labelPosition: { x: (parentInnerLeft + elementRect.left) / 2, y: midY },
    })
  }

  const rightDistance = Math.round(parentInnerRight - elementRect.right)
  if (rightDistance > 0) {
    const midY = elementRect.top + elementRect.height / 2
    measurements.push({
      direction: 'horizontal',
      x1: elementRect.right,
      y1: midY,
      x2: parentInnerRight,
      y2: midY,
      distance: rightDistance,
      labelPosition: { x: (elementRect.right + parentInnerRight) / 2, y: midY },
    })
  }

  return measurements
}

export function calculateElementMeasurements(
  from: HTMLElement,
  to: HTMLElement
): MeasurementLine[] {
  const fromRect = from.getBoundingClientRect()
  const toRect = to.getBoundingClientRect()
  const measurements: MeasurementLine[] = []

  const horizontalOverlap =
    fromRect.left < toRect.right && fromRect.right > toRect.left
  const verticalOverlap =
    fromRect.top < toRect.bottom && fromRect.bottom > toRect.top

  if (verticalOverlap) {
    const overlapTop = Math.max(fromRect.top, toRect.top)
    const overlapBottom = Math.min(fromRect.bottom, toRect.bottom)
    const midY = (overlapTop + overlapBottom) / 2

    if (fromRect.right <= toRect.left) {
      const distance = Math.round(toRect.left - fromRect.right)
      measurements.push({
        direction: 'horizontal',
        x1: fromRect.right,
        y1: midY,
        x2: toRect.left,
        y2: midY,
        distance,
        labelPosition: { x: (fromRect.right + toRect.left) / 2, y: midY },
      })
    } else if (fromRect.left >= toRect.right) {
      const distance = Math.round(fromRect.left - toRect.right)
      measurements.push({
        direction: 'horizontal',
        x1: toRect.right,
        y1: midY,
        x2: fromRect.left,
        y2: midY,
        distance,
        labelPosition: { x: (toRect.right + fromRect.left) / 2, y: midY },
      })
    }
  }

  if (horizontalOverlap) {
    const overlapLeft = Math.max(fromRect.left, toRect.left)
    const overlapRight = Math.min(fromRect.right, toRect.right)
    const midX = (overlapLeft + overlapRight) / 2

    if (fromRect.bottom <= toRect.top) {
      const distance = Math.round(toRect.top - fromRect.bottom)
      measurements.push({
        direction: 'vertical',
        x1: midX,
        y1: fromRect.bottom,
        x2: midX,
        y2: toRect.top,
        distance,
        labelPosition: { x: midX, y: (fromRect.bottom + toRect.top) / 2 },
      })
    } else if (fromRect.top >= toRect.bottom) {
      const distance = Math.round(fromRect.top - toRect.bottom)
      measurements.push({
        direction: 'vertical',
        x1: midX,
        y1: toRect.bottom,
        x2: midX,
        y2: fromRect.top,
        distance,
        labelPosition: { x: midX, y: (toRect.bottom + fromRect.top) / 2 },
      })
    }
  }

  if (!horizontalOverlap && !verticalOverlap) {
    const fromCenterX = fromRect.left + fromRect.width / 2
    const fromCenterY = fromRect.top + fromRect.height / 2
    const toCenterX = toRect.left + toRect.width / 2
    const toCenterY = toRect.top + toRect.height / 2

    const hDistance = toCenterX > fromCenterX
      ? Math.round(toRect.left - fromRect.right)
      : Math.round(fromRect.left - toRect.right)

    if (hDistance > 0) {
      const startX = toCenterX > fromCenterX ? fromRect.right : fromRect.left
      const endX = toCenterX > fromCenterX ? toRect.left : toRect.right
      const y = (fromCenterY + toCenterY) / 2
      measurements.push({
        direction: 'horizontal',
        x1: startX,
        y1: y,
        x2: endX,
        y2: y,
        distance: hDistance,
        labelPosition: { x: (startX + endX) / 2, y },
      })
    }

    const vDistance = toCenterY > fromCenterY
      ? Math.round(toRect.top - fromRect.bottom)
      : Math.round(fromRect.top - toRect.bottom)

    if (vDistance > 0) {
      const x = (fromCenterX + toCenterX) / 2
      const startY = toCenterY > fromCenterY ? fromRect.bottom : fromRect.top
      const endY = toCenterY > fromCenterY ? toRect.top : toRect.bottom
      measurements.push({
        direction: 'vertical',
        x1: x,
        y1: startY,
        x2: x,
        y2: endY,
        distance: vDistance,
        labelPosition: { x, y: (startY + endY) / 2 },
      })
    }
  }

  return measurements
}

const GUIDELINE_PROXIMITY = 80

export function calculateGuidelineMeasurements(
  element: HTMLElement,
  guidelines: Guideline[],
  mousePosition?: { x: number; y: number } | null,
): MeasurementLine[] {
  if (guidelines.length === 0) return []

  const rect = element.getBoundingClientRect()
  const scrollX = window.scrollX
  const scrollY = window.scrollY
  const measurements: MeasurementLine[] = []

  for (const g of guidelines) {
    if (g.orientation === 'horizontal') {
      const gy = g.position - scrollY
      const midX = rect.left + rect.width / 2

      // Only show when mouse is near this guideline's Y position
      if (mousePosition && Math.abs(mousePosition.y - gy) > GUIDELINE_PROXIMITY) continue

      if (gy < rect.top) {
        const distance = Math.round(rect.top - gy)
        if (distance > 0) {
          measurements.push({
            direction: 'vertical',
            x1: midX,
            y1: gy,
            x2: midX,
            y2: rect.top,
            distance,
            labelPosition: { x: midX, y: (gy + rect.top) / 2 },
          })
        }
      } else if (gy > rect.bottom) {
        const distance = Math.round(gy - rect.bottom)
        if (distance > 0) {
          measurements.push({
            direction: 'vertical',
            x1: midX,
            y1: rect.bottom,
            x2: midX,
            y2: gy,
            distance,
            labelPosition: { x: midX, y: (rect.bottom + gy) / 2 },
          })
        }
      }
    } else {
      const gx = g.position - scrollX
      const midY = rect.top + rect.height / 2

      // Only show when mouse is near this guideline's X position
      if (mousePosition && Math.abs(mousePosition.x - gx) > GUIDELINE_PROXIMITY) continue

      if (gx < rect.left) {
        const distance = Math.round(rect.left - gx)
        if (distance > 0) {
          measurements.push({
            direction: 'horizontal',
            x1: gx,
            y1: midY,
            x2: rect.left,
            y2: midY,
            distance,
            labelPosition: { x: (gx + rect.left) / 2, y: midY },
          })
        }
      } else if (gx > rect.right) {
        const distance = Math.round(gx - rect.right)
        if (distance > 0) {
          measurements.push({
            direction: 'horizontal',
            x1: rect.right,
            y1: midY,
            x2: gx,
            y2: midY,
            distance,
            labelPosition: { x: (rect.right + gx) / 2, y: midY },
          })
        }
      }
    }
  }

  return measurements
}
