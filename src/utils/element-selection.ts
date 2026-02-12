import type { DropIndicator } from '../types'

const TEXT_ELEMENT_TAGS = new Set([
  'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'span', 'label', 'a', 'strong', 'em', 'small',
  'blockquote', 'li', 'td', 'th', 'caption', 'figcaption',
  'legend', 'dt', 'dd', 'abbr', 'cite', 'code', 'pre',
])

function hasDirectNonWhitespaceText(element: HTMLElement): boolean {
  return Array.from(element.childNodes).some(
    (node) => node.nodeType === Node.TEXT_NODE && Boolean(node.textContent?.trim())
  )
}

export function isTextElement(element: HTMLElement): boolean {
  const tagName = element.tagName.toLowerCase()
  if (TEXT_ELEMENT_TAGS.has(tagName)) {
    return true
  }
  if (hasDirectNonWhitespaceText(element)) {
    return true
  }
  if (element.children.length === 0 && element.textContent?.trim()) {
    return true
  }
  return false
}

export function isFlexContainer(element: HTMLElement): boolean {
  const computed = window.getComputedStyle(element)
  return computed.display === 'flex' || computed.display === 'inline-flex'
}

export function getFlexDirection(
  element: HTMLElement
): 'row' | 'row-reverse' | 'column' | 'column-reverse' {
  const computed = window.getComputedStyle(element)
  return computed.flexDirection as 'row' | 'row-reverse' | 'column' | 'column-reverse'
}

export function detectChildrenDirection(
  container: HTMLElement,
  exclude: HTMLElement | null
): { axis: 'horizontal' | 'vertical'; reversed: boolean } {
  const computed = window.getComputedStyle(container)

  // Flex: trust CSS for accuracy (especially reverse)
  if (computed.display === 'flex' || computed.display === 'inline-flex') {
    const dir = computed.flexDirection
    return {
      axis: (dir === 'row' || dir === 'row-reverse') ? 'horizontal' : 'vertical',
      reversed: dir === 'row-reverse' || dir === 'column-reverse',
    }
  }

  // Non-flex: examine first two visible, in-flow children
  const visible: HTMLElement[] = []
  for (const c of container.children) {
    if (!(c instanceof HTMLElement) || c === exclude) continue
    const cs = window.getComputedStyle(c)
    if (cs.display === 'none' || cs.position === 'absolute' || cs.position === 'fixed') continue
    visible.push(c)
    if (visible.length === 2) break
  }

  if (visible.length < 2) return { axis: 'vertical', reversed: false }

  const first = visible[0].getBoundingClientRect()
  const second = visible[1].getBoundingClientRect()
  const yOverlap = first.bottom - 2 > second.top && second.bottom - 2 > first.top

  if (yOverlap) {
    return { axis: 'horizontal', reversed: second.right < first.left }
  }
  return { axis: 'vertical', reversed: second.bottom < first.top }
}

function htmlChildren(el: HTMLElement): HTMLElement[] {
  return Array.from(el.children).filter(
    (child): child is HTMLElement => child instanceof HTMLElement
  )
}

/** Walk up from `element` to find the nearest flex/inline-flex ancestor, stopping at `boundary`. */
function findFlexAncestor(
  element: HTMLElement,
  boundary: HTMLElement | null,
): { flexParent: HTMLElement; child: HTMLElement } | null {
  let current: HTMLElement | null = element
  while (current && current !== document.body) {
    const parent: HTMLElement | null = current.parentElement
    if (!parent) break
    const display = getComputedStyle(parent).display
    if (display === 'flex' || display === 'inline-flex') {
      return { flexParent: parent, child: current }
    }
    if (boundary && parent === boundary) break
    current = parent
  }
  return null
}

export function computeHoverHighlight(
  elementUnder: HTMLElement | null,
  selectedElement: HTMLElement | null,
): { flexContainer: HTMLElement; children: HTMLElement[] } | null {
  if (
    !elementUnder ||
    elementUnder === document.body ||
    elementUnder === document.documentElement ||
    elementUnder.closest('[data-direct-edit]') ||
    elementUnder.closest('[data-direct-edit-host]') ||
    elementUnder === selectedElement
  ) {
    return null
  }

  // When hovering descendants of the selected element, stop walk-up at the boundary
  const boundary = selectedElement?.contains(elementUnder) ? selectedElement : null

  const ownDisplay = getComputedStyle(elementUnder).display
  if (ownDisplay === 'flex' || ownDisplay === 'inline-flex') {
    return { flexContainer: elementUnder, children: htmlChildren(elementUnder) }
  }

  const found = findFlexAncestor(elementUnder, boundary)
  if (found) {
    return { flexContainer: found.flexParent, children: htmlChildren(found.flexParent) }
  }

  return { flexContainer: elementUnder, children: [] }
}

export function resolveElementTarget(
  elementUnder: HTMLElement,
  selectedElement: HTMLElement | null,
): HTMLElement {
  const boundary = selectedElement?.contains(elementUnder) ? selectedElement : null
  const found = findFlexAncestor(elementUnder, boundary)
  if (found && found.flexParent === boundary) return elementUnder
  return found?.child ?? elementUnder
}

/** Finds the text-owning element at a point within `boundary` using browser caret hit-testing. */
export function findTextOwnerAtPoint(
  boundary: HTMLElement,
  clientX: number,
  clientY: number,
): HTMLElement | null {
  const doc = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node } | null
    caretRangeFromPoint?: (x: number, y: number) => Range | null
  }

  const caretNode =
    doc.caretPositionFromPoint?.(clientX, clientY)?.offsetNode
    ?? doc.caretRangeFromPoint?.(clientX, clientY)?.startContainer
    ?? null
  if (!caretNode || caretNode.nodeType !== Node.TEXT_NODE) return null

  const textNode = caretNode as Text
  if (!(textNode.nodeValue ?? '').trim()) return null

  const owner = textNode.parentElement
  if (!owner || !boundary.contains(owner)) return null
  if (owner.closest('[data-direct-edit]') || owner.closest('[data-direct-edit-host]')) return null

  // Guard against caret APIs returning nearby text nodes.
  const range = document.createRange()
  range.selectNodeContents(textNode)
  const hitsText = Array.from(range.getClientRects()).some(
    (r) => clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom
  )
  range.detach?.()
  return hitsText ? owner : null
}

/** Fallback text hit-testing by scanning text nodes and rendered rects within `boundary`. */
export function findTextOwnerByRangeScan(
  boundary: HTMLElement,
  clientX: number,
  clientY: number,
): HTMLElement | null {
  const walker = document.createTreeWalker(boundary, NodeFilter.SHOW_TEXT)
  let current: Node | null = walker.nextNode()

  while (current) {
    const textNode = current as Text
    if ((textNode.nodeValue ?? '').trim()) {
      const owner = textNode.parentElement
      if (
        owner &&
        boundary.contains(owner) &&
        !owner.closest('[data-direct-edit]') &&
        !owner.closest('[data-direct-edit-host]')
      ) {
        const range = document.createRange()
        range.selectNodeContents(textNode)
        const hitsText = Array.from(range.getClientRects()).some(
          (r) => clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom
        )
        range.detach?.()
        if (hitsText) return owner
      }
    }
    current = walker.nextNode()
  }

  return null
}

/** Wrap the direct text node under the point into a span so it becomes independently selectable. */
export function ensureDirectTextSpanAtPoint(
  parent: HTMLElement,
  clientX: number,
  clientY: number,
): HTMLElement | null {
  const directTextNodes = Array.from(parent.childNodes).filter(
    (node): node is Text => node.nodeType === Node.TEXT_NODE && Boolean(node.textContent?.trim())
  )

  for (const textNode of directTextNodes) {
    const range = document.createRange()
    range.selectNodeContents(textNode)
    const hitsText = Array.from(range.getClientRects()).some(
      (r) => clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom
    )
    range.detach?.()

    if (!hitsText) continue

    const span = document.createElement('span')
    span.setAttribute('data-direct-edit-generated', 'text-span')
    span.textContent = textNode.textContent ?? ''
    parent.replaceChild(span, textNode)
    return span
  }

  return null
}

/** When elementFromPoint returns the selected element (bare text, padding, gap),
 *  find the best child element to drill into at the given coordinates. */
export function findChildAtPoint(
  parent: HTMLElement,
  clientX: number,
  clientY: number,
): HTMLElement | null {
  const children = htmlChildren(parent)
  if (children.length === 0) return null

  // Direct hit: child whose bbox contains the click
  const hit = children.find((child) => {
    const r = child.getBoundingClientRect()
    return clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom
  })
  if (hit) return hit

  // Single-child fallback should not steal clicks from parent's direct text.
  if (children.length === 1 && !hasDirectNonWhitespaceText(parent)) return children[0]

  return null
}

export function elementFromPointWithoutOverlays(x: number, y: number): HTMLElement | null {
  const host = document.querySelector<HTMLElement>('[data-direct-edit-host]')
  if (host) host.style.display = 'none'
  const el = document.elementFromPoint(x, y) as HTMLElement | null
  if (host) host.style.display = ''
  return el
}

function isLayoutContainer(element: HTMLElement): boolean {
  const display = window.getComputedStyle(element).display
  return (
    display === 'flex' ||
    display === 'inline-flex' ||
    display === 'grid' ||
    display === 'inline-grid'
  )
}

function isBlockContainer(element: HTMLElement): boolean {
  const display = window.getComputedStyle(element).display
  return display === 'block' || display === 'flow-root'
      || display === 'inline-block' || display === 'list-item'
}

function skipElement(el: HTMLElement, exclude: HTMLElement | null): boolean {
  if (exclude && exclude.contains(el)) return true
  if (el === document.body || el === document.documentElement) return true
  if (el.closest('[data-direct-edit]') || el.closest('[data-direct-edit-host]')) return true
  return false
}

function findContainerViaTraversal(x: number, y: number, exclude: HTMLElement | null): HTMLElement | null {
  const el = elementFromPointWithoutOverlays(x, y)
  if (!el) return null
  let current: HTMLElement | null = el
  while (current) {
    if (!skipElement(current, exclude)) {
      if (isLayoutContainer(current) || isBlockContainer(current)) return current
    }
    current = current.parentElement
  }
  return null
}

export function findContainerAtPoint(
  x: number,
  y: number,
  exclude: HTMLElement | null,
  preferredParent?: HTMLElement | null
): HTMLElement | null {
  const host = document.querySelector<HTMLElement>('[data-direct-edit-host]')
  if (host) host.style.display = 'none'

  const elements = document.elementsFromPoint(x, y) as HTMLElement[]

  if (host) host.style.display = ''

  // Find most specific container (front-to-back = most nested first)
  for (const el of elements) {
    if (skipElement(el, exclude)) continue
    if (isLayoutContainer(el) || isBlockContainer(el)) return el
  }

  // Fallback: preferredParent for gap/padding areas
  if (preferredParent && (isLayoutContainer(preferredParent) || isBlockContainer(preferredParent))) {
    for (const el of elements) {
      if (el === preferredParent) return preferredParent
    }
  }

  // Last resort: walk up DOM
  return findContainerViaTraversal(x, y, exclude)
}

export function calculateDropPosition(
  container: HTMLElement,
  pointerX: number,
  pointerY: number,
  draggedElement: HTMLElement
): { insertBefore: HTMLElement | null; indicator: DropIndicator } | null {
  const { axis, reversed: isReversed } = detectChildrenDirection(container, draggedElement)
  const isHorizontal = axis === 'horizontal'

  const children = Array.from(container.children).filter(
    (child) => child !== draggedElement && child instanceof HTMLElement
  ) as HTMLElement[]

  if (children.length === 0) {
    const containerRect = container.getBoundingClientRect()
    return {
      insertBefore: null,
      indicator: {
        x: containerRect.left + 4,
        y: containerRect.top + 4,
        width: isHorizontal ? 1 : containerRect.width - 8,
        height: isHorizontal ? containerRect.height - 8 : 1,
      },
    }
  }

  const containerRect = container.getBoundingClientRect()
  let insertBefore: HTMLElement | null = null
  let indicatorPosition = 0

  for (let i = 0; i < children.length; i++) {
    const child = children[i]
    const rect = child.getBoundingClientRect()
    const midpoint = isHorizontal
      ? rect.left + rect.width / 2
      : rect.top + rect.height / 2

    const pointer = isHorizontal ? pointerX : pointerY

    const beforeMidpoint = isReversed ? pointer > midpoint : pointer < midpoint

    if (beforeMidpoint) {
      insertBefore = child
      indicatorPosition = isHorizontal ? rect.left : rect.top
      break
    }
  }

  if (!insertBefore) {
    const lastChild = children[children.length - 1]
    const lastRect = lastChild.getBoundingClientRect()
    indicatorPosition = isHorizontal ? lastRect.right : lastRect.bottom
  }

  const indicator: DropIndicator = isHorizontal
    ? {
        x: indicatorPosition,
        y: containerRect.top + 4,
        width: 2,
        height: containerRect.height - 8,
      }
    : {
        x: containerRect.left + 4,
        y: indicatorPosition,
        width: containerRect.width - 8,
        height: 2,
      }

  return { insertBefore, indicator }
}
