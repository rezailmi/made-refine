import type { ElementLocator, ReactComponentFrame, ElementInfo, DomSourceLocation } from '../types'
import { getElementInfo } from './measurements'
import { getReactComponentStack, getSourceFromFiber, getFiberForElement } from './react-fiber'

export function getElementDisplayName(element: HTMLElement): string {
  return element.tagName.toLowerCase()
}

const STABLE_ATTRIBUTES = ['data-testid', 'data-qa', 'data-cy', 'aria-label', 'role'] as const
const MAX_SELECTOR_DEPTH = 4

function escapeCssIdentifier(value: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(value)
  }
  return value.replace(/[^a-zA-Z0-9_-]/g, (char) => `\\${char}`)
}

function escapeAttributeValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

function isUniqueSelector(selector: string): boolean {
  if (typeof document === 'undefined') return false
  try {
    return document.querySelectorAll(selector).length === 1
  } catch {
    return false
  }
}

function getUniqueIdSelector(element: HTMLElement): string | null {
  if (!element.id) return null
  const selector = `#${escapeCssIdentifier(element.id)}`
  return isUniqueSelector(selector) ? selector : null
}

function getStableAttributeSelector(element: HTMLElement): string | null {
  const tagName = element.tagName.toLowerCase()
  for (const attr of STABLE_ATTRIBUTES) {
    const value = element.getAttribute(attr)
    if (!value) continue
    const selector = `${tagName}[${attr}="${escapeAttributeValue(value)}"]`
    if (isUniqueSelector(selector)) {
      return selector
    }
  }
  return null
}

function getNthOfTypeSelector(element: HTMLElement): string {
  const tagName = element.tagName.toLowerCase()
  const classes = Array.from(element.classList)
    .filter((className) => className && !className.startsWith('direct-edit'))
    .slice(0, 2)
  const classSelector = classes.map((className) => `.${escapeCssIdentifier(className)}`).join('')

  let nthOfType = ''
  const parent = element.parentElement
  if (parent) {
    const siblings = Array.from(parent.children).filter(
      (child) => (child as HTMLElement).tagName.toLowerCase() === tagName
    )
    if (siblings.length > 1) {
      const index = siblings.indexOf(element) + 1
      nthOfType = `:nth-of-type(${index})`
    }
  }

  return `${tagName}${classSelector}${nthOfType}`
}

function buildDomSelector(element: HTMLElement): string {
  if (typeof document === 'undefined') {
    return element.tagName.toLowerCase()
  }
  if (element.closest('[data-direct-edit]')) return ''

  const uniqueId = getUniqueIdSelector(element)
  if (uniqueId) return uniqueId

  const stableAttribute = getStableAttributeSelector(element)
  if (stableAttribute) return stableAttribute

  const segments: string[] = []
  let current: HTMLElement | null = element
  let depth = 0

  while (current && current !== document.body && depth < MAX_SELECTOR_DEPTH) {
    if (current.hasAttribute('data-direct-edit')) {
      current = current.parentElement
      continue
    }

    if (depth > 0) {
      const parentId = getUniqueIdSelector(current)
      if (parentId) {
        segments.unshift(parentId)
        break
      }
      const parentStableAttr = getStableAttributeSelector(current)
      if (parentStableAttr) {
        segments.unshift(parentStableAttr)
        break
      }
    }

    segments.unshift(getNthOfTypeSelector(current))
    current = current.parentElement
    depth += 1
  }

  return segments.join(' > ')
}

function stripDirectEditNodes(root: Element) {
  const nodes = root.querySelectorAll('[data-direct-edit]')
  nodes.forEach((node) => node.remove())
}

function buildTargetHtml(element: HTMLElement): string {
  const tagName = element.tagName.toLowerCase()
  const attrs: string[] = []
  const allowList = [
    'id',
    'class',
    'href',
    'src',
    'alt',
    'aria-label',
    'role',
    'data-testid',
  ]
  const maxAttrLength = 48

  for (const attr of allowList) {
    const value = element.getAttribute(attr)
    if (!value) continue
    const trimmed = value.length > maxAttrLength ? `${value.slice(0, maxAttrLength - 3)}...` : value
    attrs.push(`${attr}="${escapeAttributeValue(trimmed)}"`)
  }

  const text = getTextPreview(element)
  const attrString = attrs.length > 0 ? ` ${attrs.join(' ')}` : ''

  if (text) {
    return `<${tagName}${attrString}>\n  ${escapeHtml(text)}\n</${tagName}>`
  }

  return `<${tagName}${attrString}></${tagName}>`
}

function formatSourcePath(file: string): string {
  const normalized = file
    .replace(/\\/g, '/')
    .replace(/^webpack:\/\/\//, '')
    .replace(/^webpack:\/\//, '')
    .replace(/^file:\/\//, '')
    .replace(/^_N_E\//, '')
    .replace(/^\.\/+/, '')
  const packagesIndex = normalized.indexOf('/packages/')
  if (packagesIndex !== -1) {
    return `/[project]${normalized.slice(packagesIndex)}`
  }
  const appIndex = normalized.indexOf('/app/')
  if (appIndex !== -1) {
    return `/[project]${normalized.slice(appIndex)}`
  }
  const srcIndex = normalized.indexOf('/src/')
  if (srcIndex !== -1) {
    return `/[project]${normalized.slice(srcIndex)}`
  }
  return normalized
}

export function formatSourceLocation(file: string, line?: number, column?: number): string {
  const formatted = formatSourcePath(file)
  if (typeof line === 'number') {
    const columnSuffix = typeof column === 'number' ? `:${column}` : ''
    return `${formatted}:${line}${columnSuffix}`
  }
  return formatted
}

function isUserlandSource(file: string): boolean {
  const normalized = file.replace(/\\/g, '/')
  if (
    normalized.includes('node_modules') ||
    normalized.includes('next/dist') ||
    normalized.includes('react') ||
    normalized.includes('react-dom') ||
    normalized.includes('direct-edit')
  ) {
    return false
  }
  return (
    normalized.includes('/app/') ||
    normalized.includes('/src/') ||
    normalized.includes('/packages/') ||
    normalized.startsWith('./')
  )
}

export function getPrimaryFrame(locator: ElementLocator): ReactComponentFrame | null {
  for (const frame of locator.reactStack) {
    if (frame.file && isUserlandSource(frame.file)) {
      return frame
    }
  }
  for (const frame of locator.reactStack) {
    if (frame.file) {
      return frame
    }
  }
  return locator.reactStack[0] ?? null
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function buildDomContextHtml(
  element: HTMLElement,
  options?: { siblingCount?: number }
): string {
  const parent = element.parentElement
  if (!parent) {
    return element.outerHTML
  }

  const parentClone = parent.cloneNode(false) as HTMLElement
  const siblings = Array.from(parent.children) as HTMLElement[]
  const selectedIndex = siblings.indexOf(element)
  let slice = siblings

  if (options?.siblingCount && options.siblingCount > 0 && selectedIndex >= 0) {
    const start = Math.max(0, selectedIndex - options.siblingCount)
    const end = Math.min(siblings.length, selectedIndex + options.siblingCount + 1)
    slice = siblings.slice(start, end)
  }

  for (const sibling of slice) {
    if (sibling.closest('[data-direct-edit]')) continue
    const clone = sibling.cloneNode(true) as HTMLElement
    if (sibling === element) {
      clone.setAttribute('data-direct-edit-target', 'true')
    }
    stripDirectEditNodes(clone)
    parentClone.appendChild(clone)
  }

  return parentClone.outerHTML
}

function getTextPreview(element: HTMLElement): string {
  const text = element.textContent ?? ''
  const cleaned = text.replace(/\s+/g, ' ').trim()
  if (cleaned.length <= 120) {
    return cleaned
  }
  return `${cleaned.slice(0, 117)}...`
}

function parseDomSource(element: HTMLElement): DomSourceLocation | null {
  const value = element.getAttribute('data-direct-edit-source')
  if (!value) return null

  let file = value
  let line: number | undefined
  let column: number | undefined

  const lastColon = value.lastIndexOf(':')
  if (lastColon !== -1) {
    const maybeColumn = Number(value.slice(lastColon + 1))
    if (!Number.isNaN(maybeColumn)) {
      column = maybeColumn
      file = value.slice(0, lastColon)

      const prevColon = file.lastIndexOf(':')
      if (prevColon !== -1) {
        const maybeLine = Number(file.slice(prevColon + 1))
        if (!Number.isNaN(maybeLine)) {
          line = maybeLine
          file = file.slice(0, prevColon)
        }
      }
    }
  }

  return { file, line, column }
}

export function getElementLocator(element: HTMLElement): ElementLocator {
  const elementInfo = getElementInfo(element)
  let domSource = parseDomSource(element)

  // Fallback: get source from the element's own React fiber when
  // the Vite plugin attribute is not present
  if (!domSource) {
    const fiber = getFiberForElement(element)
    if (fiber) {
      const fiberSource = getSourceFromFiber(fiber)
      if (fiberSource?.fileName) {
        domSource = {
          file: fiberSource.fileName,
          line: fiberSource.lineNumber,
          column: fiberSource.columnNumber,
        }
      }
    }
  }

  return {
    reactStack: getReactComponentStack(element),
    domSelector: buildDomSelector(element),
    domContextHtml: buildDomContextHtml(element),
    targetHtml: buildTargetHtml(element),
    textPreview: getTextPreview(element),
    tagName: elementInfo.tagName,
    id: elementInfo.id,
    classList: elementInfo.classList,
    domSource: domSource ?? undefined,
  }
}
