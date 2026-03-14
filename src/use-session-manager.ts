import * as React from 'react'
import type {
  DirectEditState,
  UndoEntry,
  SessionEdit,
  SessionItem,
  Comment,
  CanvasElementKind,
  SelectElementOptions,
  SelectElementsOptions,
} from './types'
import type { MoveInfo, MoveMode } from './use-move'
import {
  getAllComputedStyles,
  getComputedStyles,
  getOriginalInlineStyles,
  getElementInfo,
  propertyToCSSMap,
  borderRadiusPropertyToCSSMap,
  borderPropertyToCSSMap,
  flexPropertyToCSSMap,
  sizingPropertyToCSSMap,
  colorPropertyToCSSMap,
  typographyPropertyToCSSMap,
  buildElementContext,
  buildEditExport,
  buildSessionExport,
  buildExportInstruction,
  getExportContentProfile,
  buildMovePlanContext,
  getMoveIntentForEdit,
  partitionMultiSelectedEdits,
  getContextOnlyBlocks,
  getElementDisplayName,
  getElementLocator,
  computeIntendedIndex,
  isInFlowChild,
} from './utils'
import { copyText } from './clipboard'

type ParentLayout = 'flex' | 'grid' | 'block' | 'other'
const GENERATED_CANVAS_NODE_ATTR = 'data-made-refine-canvas-node'

function nextGeneratedCanvasId(kind: string): string {
  let index = 1
  let candidate = `made-refine-${kind}-${index}`
  while (document.getElementById(candidate)) {
    index += 1
    candidate = `made-refine-${kind}-${index}`
  }
  return candidate
}

function compareDomOrder(a: HTMLElement, b: HTMLElement): number {
  if (a === b) return 0
  const position = a.compareDocumentPosition(b)
  if (position & Node.DOCUMENT_POSITION_FOLLOWING) return -1
  if (position & Node.DOCUMENT_POSITION_PRECEDING) return 1
  return 0
}

function getLayoutFromDisplay(display: string): ParentLayout {
  if (display === 'flex' || display === 'inline-flex') return 'flex'
  if (display === 'grid' || display === 'inline-grid') return 'grid'
  if (
    display === 'block'
    || display === 'inline-block'
    || display === 'flow-root'
    || display === 'list-item'
  ) {
    return 'block'
  }
  return 'other'
}

function getParentLayoutMeta(parent: HTMLElement | null): {
  display?: string
  layout?: ParentLayout
  flexDirection?: 'row' | 'row-reverse' | 'column' | 'column-reverse'
  gap?: string
  childCount?: number
} {
  if (!parent) return {}
  const computed = window.getComputedStyle(parent)
  const display = computed.display
  const layout = getLayoutFromDisplay(display)
  const childCount = countInFlowChildren(parent)

  if (layout === 'flex') {
    return {
      display, layout, childCount,
      flexDirection: computed.flexDirection as 'row' | 'row-reverse' | 'column' | 'column-reverse',
      gap: computed.gap !== 'normal' && computed.gap !== '0px' ? computed.gap : undefined,
    }
  }
  if (layout === 'grid') {
    return {
      display, layout, childCount,
      gap: computed.gap !== 'normal' && computed.gap !== '0px' ? computed.gap : undefined,
    }
  }
  return { display, layout, childCount }
}

function countInFlowChildren(parent: HTMLElement): number {
  let count = 0
  for (const c of parent.children) {
    if (c instanceof HTMLElement && isInFlowChild(c)) count++
  }
  return count
}

function findChildIndex(parent: HTMLElement | null, child: HTMLElement | null): number | undefined {
  if (!parent || !child) return undefined
  const index = Array.from(parent.children).indexOf(child)
  return index >= 0 ? index : undefined
}

function getOriginalMoveIndex(
  parent: HTMLElement,
  previousSibling: HTMLElement | null,
  nextSibling: HTMLElement | null,
): number {
  const previousIndex = findChildIndex(parent, previousSibling)
  if (previousIndex !== undefined) return previousIndex + 1
  const nextIndex = findChildIndex(parent, nextSibling)
  if (nextIndex !== undefined) return nextIndex
  return 0
}

function applyPositionMoveCSS(
  element: HTMLElement,
  delta: { x: number; y: number },
): {
  previousStyles: Array<{ cssProperty: string; previousValue: string | null }>
  appliedLeft: string
  appliedTop: string
} {
  const computed = window.getComputedStyle(element)
  const previousStyles: Array<{ cssProperty: string; previousValue: string | null }> = []

  if (computed.position === 'static') {
    previousStyles.push({ cssProperty: 'position', previousValue: element.style.getPropertyValue('position') || null })
    element.style.setProperty('position', 'relative')
  }

  const appliedLeft = `${(parseFloat(computed.left) || 0) + delta.x}px`
  const appliedTop = `${(parseFloat(computed.top) || 0) + delta.y}px`

  previousStyles.push({ cssProperty: 'left', previousValue: element.style.getPropertyValue('left') || null })
  previousStyles.push({ cssProperty: 'top', previousValue: element.style.getPropertyValue('top') || null })

  element.style.setProperty('left', appliedLeft)
  element.style.setProperty('top', appliedTop)

  return { previousStyles, appliedLeft, appliedTop }
}

function getAnchor(node: HTMLElement | null): {
  selector: string | null
  source: ReturnType<typeof getElementLocator>['domSource'] | null
} {
  if (!node) return { selector: null, source: null }
  const locator = getElementLocator(node)
  const selector = locator.domSelector.trim()
  return {
    selector: selector.length > 0 ? selector : null,
    source: locator.domSource ?? null,
  }
}

export function buildPositionMoveFields(
  element: HTMLElement,
  moveInfo: MoveInfo,
  appliedLeft: string,
  appliedTop: string,
  existingMove: SessionEdit['move'],
): NonNullable<SessionEdit['move']> {
  const parent = element.parentElement!
  const intended = computeIntendedIndex(parent, element)
  const parentMeta = getParentLayoutMeta(parent)
  const parentName = getElementDisplayName(parent)
  const parentAnchor = getAnchor(parent)
  const fromIndex = getOriginalMoveIndex(
    moveInfo.originalParent,
    moveInfo.originalPreviousSibling,
    moveInfo.originalNextSibling,
  )

  const fromParentMeta = existingMove ? getParentLayoutMeta(moveInfo.originalParent) : parentMeta

  const fromFields = existingMove
    ? {
        fromParentName: existingMove.fromParentName,
        fromSiblingBefore: existingMove.fromSiblingBefore,
        fromSiblingAfter: existingMove.fromSiblingAfter,
        fromParentSelector: existingMove.fromParentSelector ?? null,
        fromSiblingBeforeSelector: existingMove.fromSiblingBeforeSelector ?? null,
        fromSiblingAfterSelector: existingMove.fromSiblingAfterSelector ?? null,
        fromParentSource: existingMove.fromParentSource ?? null,
        fromSiblingBeforeSource: existingMove.fromSiblingBeforeSource ?? null,
        fromSiblingAfterSource: existingMove.fromSiblingAfterSource ?? null,
        fromParentDisplay: existingMove.fromParentDisplay ?? parentMeta.display,
        fromParentLayout: existingMove.fromParentLayout ?? parentMeta.layout,
        fromIndex: existingMove.fromIndex ?? fromIndex,
        fromFlexDirection: existingMove.fromFlexDirection ?? fromParentMeta.flexDirection,
        fromGap: existingMove.fromGap ?? fromParentMeta.gap,
        fromChildCount: existingMove.fromChildCount ?? fromParentMeta.childCount,
      }
    : {
        fromParentName: parentName,
        fromSiblingBefore: moveInfo.originalPreviousSibling
          ? getElementDisplayName(moveInfo.originalPreviousSibling)
          : null,
        fromSiblingAfter: moveInfo.originalNextSibling
          ? getElementDisplayName(moveInfo.originalNextSibling)
          : null,
        fromParentSelector: parentAnchor.selector,
        fromSiblingBeforeSelector: getAnchor(moveInfo.originalPreviousSibling).selector,
        fromSiblingAfterSelector: getAnchor(moveInfo.originalNextSibling).selector,
        fromParentSource: parentAnchor.source,
        fromSiblingBeforeSource: getAnchor(moveInfo.originalPreviousSibling).source,
        fromSiblingAfterSource: getAnchor(moveInfo.originalNextSibling).source,
        fromParentDisplay: parentMeta.display,
        fromParentLayout: parentMeta.layout,
        fromIndex,
        fromFlexDirection: parentMeta.flexDirection,
        fromGap: parentMeta.gap,
        fromChildCount: parentMeta.childCount,
      }

  return {
    ...fromFields,
    mode: 'position',
    positionDelta: moveInfo.positionDelta,
    appliedLeft,
    appliedTop,
    visualDelta: moveInfo.positionDelta
      ? { x: Math.round(moveInfo.positionDelta.x), y: Math.round(moveInfo.positionDelta.y) }
      : undefined,
    toParentName: parentName,
    toSiblingBefore: intended.siblingBefore ? getElementDisplayName(intended.siblingBefore) : null,
    toSiblingAfter: intended.siblingAfter ? getElementDisplayName(intended.siblingAfter) : null,
    toParentSelector: parentAnchor.selector,
    toSiblingBeforeSelector: getAnchor(intended.siblingBefore).selector,
    toSiblingAfterSelector: getAnchor(intended.siblingAfter).selector,
    toParentSource: parentAnchor.source,
    toSiblingBeforeSource: getAnchor(intended.siblingBefore).source,
    toSiblingAfterSource: getAnchor(intended.siblingAfter).source,
    toParentDisplay: parentMeta.display,
    toParentLayout: parentMeta.layout,
    toIndex: intended.index,
    toFlexDirection: parentMeta.flexDirection,
    toGap: parentMeta.gap,
    toChildCount: parentMeta.childCount,
  }
}

export interface SessionManagerOptions {
  stateRef: React.MutableRefObject<DirectEditState>
  sessionEditsRef: React.MutableRefObject<Map<HTMLElement, SessionEdit>>
  removedSessionEditsRef: React.MutableRefObject<WeakSet<HTMLElement>>
  undoStackRef: React.MutableRefObject<UndoEntry[]>
  pushUndo: (entry: UndoEntry) => void
  setState: React.Dispatch<React.SetStateAction<DirectEditState>>
  setSessionEditCount: React.Dispatch<React.SetStateAction<number>>
}

export function useSessionManager({
  stateRef,
  sessionEditsRef,
  removedSessionEditsRef,
  undoStackRef,
  pushUndo,
  setState,
  setSessionEditCount,
}: SessionManagerOptions) {
  const getSelectableChild = React.useCallback((element: HTMLElement): HTMLElement | null => {
    return Array.from(element.children).find((child): child is HTMLElement => {
      if (!(child instanceof HTMLElement)) return false
      if (child.matches('script, style, link, meta, noscript')) return false
      if (child.matches('[data-direct-edit], [data-direct-edit-host]')) return false
      return true
    }) ?? null
  }, [])

  const getExportableComments = React.useCallback((comments: Comment[]): Comment[] => {
    return comments.filter((comment) => comment.text.trim().length > 0)
  }, [])

  const syncSessionItemCount = React.useCallback((comments = stateRef.current.comments) => {
    setSessionEditCount(sessionEditsRef.current.size + getExportableComments(comments).length)
  }, [getExportableComments])

  const saveCurrentToSession = React.useCallback(() => {
    const current = stateRef.current
    const el = current.selectedElement
    if (!el) return
    if (removedSessionEditsRef.current.has(el)) return

    const existing = sessionEditsRef.current.get(el)
    const pendingStyles = { ...current.pendingStyles }
    const hasPendingStyles = Object.keys(pendingStyles).length > 0
    const hasMove = Boolean(existing?.move)
    const hasTextEdit = Boolean(existing?.textEdit)

    if (!hasPendingStyles && !hasMove && !hasTextEdit) {
      if (sessionEditsRef.current.delete(el)) {
        syncSessionItemCount()
      }
      return
    }

    const locator = getElementLocator(el)
    sessionEditsRef.current.set(el, {
      element: el,
      locator,
      originalStyles: existing?.originalStyles ?? { ...current.originalStyles },
      pendingStyles,
      move: existing?.move ?? null,
      textEdit: existing?.textEdit ?? null,
    })
    syncSessionItemCount()
  }, [syncSessionItemCount])

  interface ApplySelectionOptions {
    primaryElement?: HTMLElement | null
    pushUndo?: boolean
    isOpen?: boolean
    originalStyles?: Record<string, string>
    pendingStyles?: Record<string, string>
  }

  const getSanitizedSelection = React.useCallback((elements: Array<HTMLElement | null | undefined>) => {
    const seen = new Set<HTMLElement>()
    const result: HTMLElement[] = []

    for (const element of elements) {
      if (!(element instanceof HTMLElement)) continue
      if (!element.isConnected || element === document.documentElement) continue
      if (element.matches('script, style, link, meta, noscript')) continue
      if (element.matches('[data-direct-edit], [data-direct-edit-host]')) continue
      if (seen.has(element)) continue
      seen.add(element)
      result.push(element)
    }

    return result
  }, [])

  const sameSelection = React.useCallback((a: HTMLElement[], b: HTMLElement[]) => {
    if (a.length !== b.length) return false
    return a.every((element, index) => element === b[index])
  }, [])

  const buildSelectionSnapshot = React.useCallback((current = stateRef.current) => ({
    isOpen: current.isOpen,
    selectedElement: current.selectedElement,
    selectedElements: [...current.selectedElements],
    selectionAnchorElement: current.selectionAnchorElement,
    originalStyles: { ...current.originalStyles },
    pendingStyles: { ...current.pendingStyles },
  }), [stateRef])

  const applySelection = React.useCallback((
    elements: Array<HTMLElement | null | undefined>,
    options?: ApplySelectionOptions,
  ) => {
    const nextElements = getSanitizedSelection(elements)
    const nextPrimary = options?.primaryElement && nextElements.includes(options.primaryElement)
      ? options.primaryElement
      : nextElements[nextElements.length - 1] ?? null
    const nextSingleElement = nextElements.length === 1 ? nextElements[0] : null
    const nextIsOpen = options?.isOpen ?? (nextSingleElement !== null)
    const current = stateRef.current

    const selectionChanged = (
      current.isOpen !== nextIsOpen
      || current.selectedElement !== nextSingleElement
      || current.selectionAnchorElement !== nextPrimary
      || !sameSelection(current.selectedElements, nextElements)
    )

    if (!selectionChanged) return

    if (options?.pushUndo !== false) {
      saveCurrentToSession()
      if (current.selectedElements.length > 0 || current.isOpen) {
        pushUndo({
          type: 'selection',
          previousIsOpen: current.isOpen,
          previousElement: current.selectedElement,
          previousElements: [...current.selectedElements],
          previousAnchorElement: current.selectionAnchorElement,
          previousOriginalStyles: { ...current.originalStyles },
          previousPendingStyles: { ...current.pendingStyles },
        })
      }
    }

    if (nextSingleElement) {
      const existingEdit = sessionEditsRef.current.get(nextSingleElement)
      const computed = getAllComputedStyles(nextSingleElement)
      const originalStyles = options?.originalStyles
        ?? existingEdit?.originalStyles
        ?? getOriginalInlineStyles(nextSingleElement)
      const pendingStyles = options?.pendingStyles
        ?? existingEdit?.pendingStyles
        ?? {}
      const elementInfo = getElementInfo(nextSingleElement)

      setState((prev) => ({
        comments: prev.activeCommentId
          ? prev.comments.filter((comment) => {
              if (comment.id !== prev.activeCommentId) return true
              return comment.element === nextSingleElement || comment.text.trim().length > 0
            })
          : prev.comments,
        isOpen: nextIsOpen,
        selectedElement: nextSingleElement,
        selectedElements: [nextSingleElement],
        selectionAnchorElement: nextPrimary ?? nextSingleElement,
        elementInfo,
        computedSpacing: computed.spacing,
        computedBorderRadius: computed.borderRadius,
        computedBorder: computed.border,
        computedFlex: computed.flex,
        computedSizing: computed.sizing,
        computedColor: computed.color,
        computedBoxShadow: computed.boxShadow,
        computedTypography: computed.typography,
        originalStyles,
        pendingStyles,
        editModeActive: prev.editModeActive,
        activeTool: prev.activeTool,
        theme: prev.theme,
        borderStyleControlPreference: prev.borderStyleControlPreference,
        activeCommentId: prev.activeCommentId && prev.comments.some((comment) => (
          comment.id === prev.activeCommentId && comment.element === nextSingleElement
        ))
          ? prev.activeCommentId
          : null,
        canvas: prev.canvas,
        textEditingElement: null,
      }))
      return
    }

    setState((prev) => {
      const comments = prev.activeCommentId
        ? prev.comments.filter((comment) => (
            comment.id !== prev.activeCommentId || comment.text.trim().length > 0
          ))
        : prev.comments

      return {
        ...prev,
        comments,
        isOpen: false,
        selectedElement: null,
        selectedElements: nextElements,
        selectionAnchorElement: nextPrimary,
        elementInfo: null,
        computedSpacing: null,
        computedBorderRadius: null,
        computedBorder: null,
        computedFlex: null,
        computedSizing: null,
        computedColor: null,
        computedBoxShadow: null,
        computedTypography: null,
        originalStyles: {},
        pendingStyles: {},
        activeCommentId: null,
        textEditingElement: null,
      }
    })
  }, [getSanitizedSelection, pushUndo, saveCurrentToSession, sameSelection])

  const selectElements = React.useCallback((elements: HTMLElement[], options?: SelectElementsOptions) => {
    const current = stateRef.current.selectedElements
    const nextElements = options?.additive
      ? [...current, ...elements]
      : elements

    applySelection(nextElements, {
      primaryElement: options?.primaryElement ?? elements[elements.length - 1] ?? null,
    })
  }, [applySelection, stateRef])

  const selectElement = React.useCallback((element: HTMLElement, options?: SelectElementOptions) => {
    selectElements([element], {
      additive: options?.additive,
      primaryElement: element,
    })
  }, [selectElements])

  const toggleElementSelection = React.useCallback((element: HTMLElement) => {
    const current = stateRef.current.selectedElements
    if (current.length === 1 && current[0] === element) return

    const isSelected = current.includes(element)
    const nextElements = isSelected
      ? current.filter((candidate) => candidate !== element)
      : [...current, element]

    applySelection(nextElements, {
      primaryElement: isSelected
        ? nextElements[nextElements.length - 1] ?? null
        : element,
    })
  }, [applySelection, stateRef])

  const clearSelection = React.useCallback(() => {
    applySelection([], { primaryElement: null })
  }, [applySelection])

  const selectParent = React.useCallback(() => {
    const el = stateRef.current.selectedElement
    if (el && el !== document.body && el.parentElement) {
      selectElement(el.parentElement)
    }
  }, [selectElement])

  const selectChild = React.useCallback(() => {
    const selectedElement = stateRef.current.selectedElement
    const firstChild = selectedElement ? getSelectableChild(selectedElement) : null
    if (firstChild) {
      selectElement(firstChild)
    }
  }, [getSelectableChild, selectElement])

  const insertElement = React.useCallback((kind: CanvasElementKind) => {
    if (!stateRef.current.editModeActive) return

    saveCurrentToSession()
    const restoreSelection = buildSelectionSnapshot()
    const bodyRect = document.body.getBoundingClientRect()
    const scaleX = document.body.offsetWidth > 0 ? bodyRect.width / document.body.offsetWidth : 1
    const scaleY = document.body.offsetHeight > 0 ? bodyRect.height / document.body.offsetHeight : 1
    const width = kind === 'frame' ? 240 : 160
    const height = kind === 'frame' ? 160 : 96
    const left = Math.round((window.innerWidth / 2 - bodyRect.left) / scaleX - width / 2)
    const top = Math.round((window.innerHeight / 2 - bodyRect.top) / scaleY - height / 2)

    const element = document.createElement('div')
    element.id = nextGeneratedCanvasId(kind)
    element.setAttribute(GENERATED_CANVAS_NODE_ATTR, kind)
    element.style.position = 'absolute'
    element.style.left = `${left}px`
    element.style.top = `${top}px`
    element.style.width = `${width}px`
    element.style.height = `${height}px`
    element.style.boxSizing = 'border-box'
    element.style.borderRadius = kind === 'frame' ? '16px' : '12px'
    element.style.border = '1px solid rgba(13, 153, 255, 0.35)'
    element.style.zIndex = '1'

    if (kind === 'frame') {
      element.style.display = 'flex'
      element.style.flexDirection = 'column'
      element.style.gap = '12px'
      element.style.padding = '16px'
      element.style.background = 'rgba(255, 255, 255, 0.92)'
      element.style.boxShadow = '0 10px 30px rgba(15, 23, 42, 0.10)'
    } else {
      element.style.background = 'rgba(13, 153, 255, 0.08)'
    }

    document.body.appendChild(element)

    pushUndo({
      type: 'structure',
      restoreSelection,
      undo: () => {
        if (element.isConnected) {
          element.remove()
        }
      },
    })

    applySelection([element], {
      primaryElement: element,
      pushUndo: false,
    })
  }, [applySelection, buildSelectionSnapshot, pushUndo, saveCurrentToSession, stateRef])

  const groupSelection = React.useCallback(() => {
    const selected = getSanitizedSelection(stateRef.current.selectedElements)
    if (selected.length < 2) return

    const parent = selected[0]?.parentElement
    if (!parent) return
    if (!(parent === document.body || parent.hasAttribute(GENERATED_CANVAS_NODE_ATTR))) return
    if (!selected.every((element) => (
      element.parentElement === parent
      && element.hasAttribute(GENERATED_CANVAS_NODE_ATTR)
    ))) {
      return
    }

    for (let index = 0; index < selected.length; index += 1) {
      for (let otherIndex = index + 1; otherIndex < selected.length; otherIndex += 1) {
        const a = selected[index]
        const b = selected[otherIndex]
        if (a.contains(b) || b.contains(a)) return
      }
    }

    saveCurrentToSession()
    const restoreSelection = buildSelectionSnapshot()
    const sorted = [...selected].sort(compareDomOrder)
    const rects = sorted.map((element) => element.getBoundingClientRect())
    const parentRect = parent.getBoundingClientRect()
    const scaleX = parent.offsetWidth > 0 ? parentRect.width / parent.offsetWidth : 1
    const scaleY = parent.offsetHeight > 0 ? parentRect.height / parent.offsetHeight : 1

    const union = rects.reduce((bounds, rect) => ({
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

    const wrapper = document.createElement('div')
    wrapper.id = nextGeneratedCanvasId('group')
    wrapper.setAttribute(GENERATED_CANVAS_NODE_ATTR, 'group')
    wrapper.style.position = 'absolute'
    wrapper.style.left = `${Math.round((union.left - parentRect.left) / scaleX)}px`
    wrapper.style.top = `${Math.round((union.top - parentRect.top) / scaleY)}px`
    wrapper.style.width = `${Math.round((union.right - union.left) / scaleX)}px`
    wrapper.style.height = `${Math.round((union.bottom - union.top) / scaleY)}px`
    wrapper.style.boxSizing = 'border-box'
    wrapper.style.borderRadius = '16px'
    wrapper.style.border = '1px dashed rgba(13, 153, 255, 0.4)'
    wrapper.style.background = 'transparent'

    const childSnapshots = sorted.map((element, index) => ({
      element,
      nextSibling: element.nextElementSibling as HTMLElement | null,
      cssText: element.style.cssText,
      rect: rects[index],
    }))

    parent.insertBefore(wrapper, sorted[0])

    for (const snapshot of childSnapshots) {
      wrapper.appendChild(snapshot.element)
      snapshot.element.style.position = 'absolute'
      snapshot.element.style.left = `${Math.round((snapshot.rect.left - union.left) / scaleX)}px`
      snapshot.element.style.top = `${Math.round((snapshot.rect.top - union.top) / scaleY)}px`
    }

    pushUndo({
      type: 'structure',
      restoreSelection,
      undo: () => {
        for (let index = childSnapshots.length - 1; index >= 0; index -= 1) {
          const snapshot = childSnapshots[index]
          snapshot.element.style.cssText = snapshot.cssText
          if (snapshot.nextSibling && snapshot.nextSibling.parentElement === parent) {
            parent.insertBefore(snapshot.element, snapshot.nextSibling)
          } else {
            parent.appendChild(snapshot.element)
          }
        }
        if (wrapper.isConnected) {
          wrapper.remove()
        }
      },
    })

    applySelection([wrapper], {
      primaryElement: wrapper,
      pushUndo: false,
    })
  }, [applySelection, buildSelectionSnapshot, getSanitizedSelection, pushUndo, saveCurrentToSession, stateRef])

  const resetToOriginal = React.useCallback(() => {
    const current = stateRef.current
    const el = current.selectedElement
    if (!el) return

    const sessionEntry = sessionEditsRef.current.get(el)
    if (sessionEntry?.textEdit) {
      el.textContent = sessionEntry.textEdit.originalText
    }
    if (sessionEntry?.move) {
      sessionEditsRef.current.set(el, { ...sessionEntry, pendingStyles: {}, textEdit: null })
    } else {
      sessionEditsRef.current.delete(el)
    }
    syncSessionItemCount()
    undoStackRef.current = undoStackRef.current.filter(
      (entry) => !((entry.type === 'edit' || entry.type === 'textEdit') && entry.element === el)
    )

    const allCSSProps = [
      ...Object.values(propertyToCSSMap),
      ...Object.values(borderRadiusPropertyToCSSMap),
      ...Object.values(borderPropertyToCSSMap),
      ...Object.values(flexPropertyToCSSMap),
      ...Object.values(sizingPropertyToCSSMap),
      ...Object.values(colorPropertyToCSSMap),
      ...Object.values(typographyPropertyToCSSMap),
      'outline-style',
      'outline-width',
      'box-shadow',
    ]

    for (const prop of allCSSProps) {
      el.style.removeProperty(prop)
    }

    for (const [prop, value] of Object.entries(current.originalStyles)) {
      el.style.setProperty(prop, value)
    }

    const computed = getAllComputedStyles(el)

    setState((prev) => ({
      ...prev,
      computedSpacing: computed.spacing,
      computedBorderRadius: computed.borderRadius,
      computedBorder: computed.border,
      computedFlex: computed.flex,
      computedSizing: computed.sizing,
      computedColor: computed.color,
      computedBoxShadow: computed.boxShadow,
      computedTypography: computed.typography,
      pendingStyles: {},
    }))
  }, [syncSessionItemCount])

  const undo = React.useCallback(() => {
    const entry = undoStackRef.current.pop()
    if (!entry) return

    switch (entry.type) {
      case 'edit': {
        if (!entry.element.isConnected) return
        for (const { cssProperty, previousValue } of entry.properties) {
          if (previousValue === null) {
            entry.element.style.removeProperty(cssProperty)
          } else {
            entry.element.style.setProperty(cssProperty, previousValue)
          }
        }
        const current = stateRef.current
        if (current.selectedElement === entry.element) {
          const computed = getAllComputedStyles(entry.element)
          const elementInfo = getElementInfo(entry.element)
          const newPending = { ...current.pendingStyles }
          for (const { cssProperty, previousValue } of entry.properties) {
            if (previousValue === null) {
              delete newPending[cssProperty]
            } else {
              newPending[cssProperty] = previousValue
            }
          }
          setState((prev) => ({
            ...prev,
            computedSpacing: computed.spacing,
            computedBorderRadius: computed.borderRadius,
            computedBorder: computed.border,
            computedFlex: computed.flex,
            computedSizing: computed.sizing,
            computedColor: computed.color,
            computedBoxShadow: computed.boxShadow,
            computedTypography: computed.typography,
            elementInfo,
            pendingStyles: newPending,
          }))
        }
        break
      }
      case 'selection': {
        const previousElements = entry.previousElements.length > 0
          ? entry.previousElements
          : (entry.previousElement ? [entry.previousElement] : [])
        const nextElements = getSanitizedSelection(previousElements)
        const prevEl = entry.previousElement

        if (entry.previousIsOpen && prevEl && prevEl.isConnected) {
          for (const [prop, value] of Object.entries(entry.previousPendingStyles)) {
            prevEl.style.setProperty(prop, value)
          }
          applySelection([prevEl], {
            pushUndo: false,
            isOpen: entry.previousIsOpen,
            primaryElement: entry.previousAnchorElement ?? prevEl,
            originalStyles: entry.previousOriginalStyles,
            pendingStyles: entry.previousPendingStyles,
          })
        } else {
          applySelection(nextElements, {
            pushUndo: false,
            isOpen: entry.previousIsOpen,
            primaryElement: entry.previousAnchorElement,
          })
        }
        break
      }
      case 'structure': {
        entry.undo()
        const restoredElements = entry.restoreSelection.selectedElements.length > 0
          ? entry.restoreSelection.selectedElements
          : (entry.restoreSelection.selectedElement ? [entry.restoreSelection.selectedElement] : [])

        applySelection(restoredElements, {
          pushUndo: false,
          isOpen: entry.restoreSelection.isOpen,
          primaryElement: entry.restoreSelection.selectionAnchorElement,
          originalStyles: entry.restoreSelection.originalStyles,
          pendingStyles: entry.restoreSelection.pendingStyles,
        })
        break
      }
      case 'move': {
        if (!entry.element.isConnected) return
        try {
          if (entry.originalNextSibling) {
            entry.originalParent.insertBefore(entry.element, entry.originalNextSibling)
          } else {
            entry.originalParent.appendChild(entry.element)
          }
        } catch {
          // Ignore invalid DOM moves
        }
        if (entry.previousPositionStyles) {
          for (const { cssProperty, previousValue } of entry.previousPositionStyles) {
            if (previousValue) {
              entry.element.style.setProperty(cssProperty, previousValue)
            } else {
              entry.element.style.removeProperty(cssProperty)
            }
          }
        }
        const sessionEntry = sessionEditsRef.current.get(entry.element)
        if (sessionEntry) {
          const restoredMove = entry.previousSessionMove
          if (Object.keys(sessionEntry.pendingStyles).length > 0 || restoredMove || sessionEntry.textEdit) {
            sessionEditsRef.current.set(entry.element, { ...sessionEntry, move: restoredMove })
          } else {
            sessionEditsRef.current.delete(entry.element)
          }
          syncSessionItemCount()
        }
        const current = stateRef.current
        if (current.selectedElement === entry.element) {
          const elementInfo = getElementInfo(entry.element)
          setState((prev) => ({ ...prev, elementInfo }))
        }
        break
      }
      case 'textEdit': {
        if (!entry.element.isConnected) return
        entry.element.textContent = entry.previousText

        const desiredTextEdit = entry.previousText === entry.originalText
          ? null
          : { originalText: entry.originalText, newText: entry.previousText }
        const sessionEntry = sessionEditsRef.current.get(entry.element)

        if (sessionEntry) {
          if (desiredTextEdit) {
            sessionEditsRef.current.set(entry.element, {
              ...sessionEntry,
              textEdit: desiredTextEdit,
            })
          } else if (Object.keys(sessionEntry.pendingStyles).length > 0 || sessionEntry.move) {
            sessionEditsRef.current.set(entry.element, { ...sessionEntry, textEdit: null })
          } else {
            sessionEditsRef.current.delete(entry.element)
          }
        } else if (desiredTextEdit) {
          const current = stateRef.current
          sessionEditsRef.current.set(entry.element, {
            element: entry.element,
            locator: getElementLocator(entry.element),
            originalStyles: current.selectedElement === entry.element ? { ...current.originalStyles } : {},
            pendingStyles: current.selectedElement === entry.element ? { ...current.pendingStyles } : {},
            move: null,
            textEdit: desiredTextEdit,
          })
        }

        syncSessionItemCount()
        break
      }
    }
  }, [syncSessionItemCount])

  const handleMoveComplete = React.useCallback(
    (element: HTMLElement, moveInfo: MoveInfo | null) => {
      const current = stateRef.current
      const getStyleStateForElement = (sessionEdit?: SessionEdit) => {
        if (sessionEdit) {
          return {
            originalStyles: { ...sessionEdit.originalStyles },
            pendingStyles: { ...sessionEdit.pendingStyles },
          }
        }
        if (current.selectedElement === element) {
          return {
            originalStyles: { ...current.originalStyles },
            pendingStyles: { ...current.pendingStyles },
          }
        }
        return {
          originalStyles: getOriginalInlineStyles(element),
          pendingStyles: {},
        }
      }

      if (moveInfo) {
        if (moveInfo.mode === 'position' && moveInfo.positionDelta) {
          const existing = sessionEditsRef.current.get(element)
          const styleState = getStyleStateForElement(existing)
          const { previousStyles, appliedLeft, appliedTop } = applyPositionMoveCSS(element, moveInfo.positionDelta)

          pushUndo({
            type: 'move',
            element,
            originalParent: moveInfo.originalParent,
            originalNextSibling: moveInfo.originalNextSibling,
            previousSessionMove: existing?.move ?? null,
            previousPositionStyles: previousStyles,
          })

          const locator = existing?.locator ?? getElementLocator(element)

          // Strip position/left/top from pendingStyles — move metadata is the authority
          const pendingStyles = { ...styleState.pendingStyles }
          delete pendingStyles['position']
          delete pendingStyles['left']
          delete pendingStyles['top']

          const move = buildPositionMoveFields(element, moveInfo, appliedLeft, appliedTop, existing?.move ?? null)

          sessionEditsRef.current.set(element, {
            element,
            locator,
            originalStyles: styleState.originalStyles,
            pendingStyles,
            textEdit: existing?.textEdit ?? null,
            move,
          })
          syncSessionItemCount()
        } else {
        const existing = sessionEditsRef.current.get(element)
        const styleState = getStyleStateForElement(existing)
        const moveMode: MoveMode = moveInfo.mode ?? 'free'

        let clearedPositionStyles: Array<{ cssProperty: string; previousValue: string | null }> | undefined
        if (moveInfo.resetPositionOffsets) {
          clearedPositionStyles = []
          for (const prop of ['position', 'left', 'top'] as const) {
            const prev = element.style.getPropertyValue(prop) || null
            clearedPositionStyles.push({ cssProperty: prop, previousValue: prev })
            element.style.removeProperty(prop)
          }
        }

        pushUndo({
          type: 'move',
          element,
          originalParent: moveInfo.originalParent,
          originalNextSibling: moveInfo.originalNextSibling,
          previousSessionMove: existing?.move ?? null,
          previousPositionStyles: clearedPositionStyles,
        })
        const locator = existing?.locator ?? getElementLocator(element)
        const newParent = element.parentElement
        const nextPrevSibling = element.previousElementSibling as HTMLElement | null
        const nextSibling = element.nextElementSibling as HTMLElement | null
        const fromParentAnchor = getAnchor(moveInfo.originalParent)
        const fromBeforeAnchor = getAnchor(moveInfo.originalPreviousSibling)
        const fromAfterAnchor = getAnchor(moveInfo.originalNextSibling)
        const toParentAnchor = getAnchor(newParent)
        const toBeforeAnchor = getAnchor(nextPrevSibling)
        const toAfterAnchor = getAnchor(nextSibling)
        const fromParentMeta = getParentLayoutMeta(moveInfo.originalParent)
        const toParentMeta = getParentLayoutMeta(newParent)
        const fromIndex = getOriginalMoveIndex(
          moveInfo.originalParent,
          moveInfo.originalPreviousSibling,
          moveInfo.originalNextSibling,
        )
        const toIndex = findChildIndex(newParent, element)

        // Preserve initial from* from the first move; only update to* on later moves
        const fromFields = existing?.move
          ? {
              fromParentName: existing.move.fromParentName,
              fromSiblingBefore: existing.move.fromSiblingBefore,
              fromSiblingAfter: existing.move.fromSiblingAfter,
              fromParentSelector: existing.move.fromParentSelector ?? null,
              fromSiblingBeforeSelector: existing.move.fromSiblingBeforeSelector ?? null,
              fromSiblingAfterSelector: existing.move.fromSiblingAfterSelector ?? null,
              fromParentSource: existing.move.fromParentSource ?? null,
              fromSiblingBeforeSource: existing.move.fromSiblingBeforeSource ?? null,
              fromSiblingAfterSource: existing.move.fromSiblingAfterSource ?? null,
              fromParentDisplay: existing.move.fromParentDisplay ?? fromParentMeta.display,
              fromParentLayout: existing.move.fromParentLayout ?? fromParentMeta.layout,
              fromIndex: existing.move.fromIndex ?? fromIndex,
              fromFlexDirection: existing.move.fromFlexDirection ?? fromParentMeta.flexDirection,
              fromGap: existing.move.fromGap ?? fromParentMeta.gap,
              fromChildCount: existing.move.fromChildCount ?? fromParentMeta.childCount,
            }
          : {
              fromParentName: getElementDisplayName(moveInfo.originalParent),
              fromSiblingBefore: moveInfo.originalPreviousSibling
                ? getElementDisplayName(moveInfo.originalPreviousSibling)
                : null,
              fromSiblingAfter: moveInfo.originalNextSibling
                ? getElementDisplayName(moveInfo.originalNextSibling)
                : null,
              fromParentSelector: fromParentAnchor.selector,
              fromSiblingBeforeSelector: fromBeforeAnchor.selector,
              fromSiblingAfterSelector: fromAfterAnchor.selector,
              fromParentSource: fromParentAnchor.source,
              fromSiblingBeforeSource: fromBeforeAnchor.source,
              fromSiblingAfterSource: fromAfterAnchor.source,
              fromParentDisplay: fromParentMeta.display,
              fromParentLayout: fromParentMeta.layout,
              fromIndex,
              fromFlexDirection: fromParentMeta.flexDirection,
              fromGap: fromParentMeta.gap,
              fromChildCount: fromParentMeta.childCount,
            }

        sessionEditsRef.current.set(element, {
          element,
          locator,
          originalStyles: styleState.originalStyles,
          pendingStyles: styleState.pendingStyles,
          textEdit: existing?.textEdit ?? null,
          move: newParent
            ? {
                ...fromFields,
                toParentName: getElementDisplayName(newParent),
                toSiblingBefore: nextPrevSibling
                  ? getElementDisplayName(nextPrevSibling)
                  : null,
                toSiblingAfter: nextSibling
                  ? getElementDisplayName(nextSibling)
                  : null,
                toParentSelector: toParentAnchor.selector,
                toSiblingBeforeSelector: toBeforeAnchor.selector,
                toSiblingAfterSelector: toAfterAnchor.selector,
                toParentSource: toParentAnchor.source,
                toSiblingBeforeSource: toBeforeAnchor.source,
                toSiblingAfterSource: toAfterAnchor.source,
                mode: moveMode,
                fromParentDisplay: fromFields.fromParentDisplay,
                fromParentLayout: fromFields.fromParentLayout,
                fromIndex: fromFields.fromIndex,
                toParentDisplay: toParentMeta.display,
                toParentLayout: toParentMeta.layout,
                toIndex,
                visualDelta: moveInfo.visualDelta,
                toFlexDirection: toParentMeta.flexDirection,
                toGap: toParentMeta.gap,
                toChildCount: toParentMeta.childCount,
              }
            : null,
        })
        syncSessionItemCount()
        }
      }
      // Refresh element state without going through selectElement,
      // which would push an extra selection undo entry.
      const computed = getAllComputedStyles(element)
      const elementInfo = getElementInfo(element)
      const styleState = getStyleStateForElement(sessionEditsRef.current.get(element))

      setState((prev) => ({
        isOpen: true,
        selectedElement: element,
        selectedElements: [element],
        selectionAnchorElement: element,
        elementInfo,
        computedSpacing: computed.spacing,
        computedBorderRadius: computed.borderRadius,
        computedBorder: computed.border,
        computedFlex: computed.flex,
        computedSizing: computed.sizing,
        computedColor: computed.color,
        computedBoxShadow: computed.boxShadow,
        computedTypography: computed.typography,
        originalStyles: styleState.originalStyles,
        pendingStyles: styleState.pendingStyles,
        editModeActive: prev.editModeActive,
        activeTool: prev.activeTool,
        theme: prev.theme,
        borderStyleControlPreference: prev.borderStyleControlPreference,
        comments: prev.comments,
        activeCommentId: prev.activeCommentId,
        canvas: prev.canvas,
        textEditingElement: null,
      }))
    },
    [pushUndo, syncSessionItemCount]
  )

  const getSessionEdits = React.useCallback((): SessionEdit[] => {
    saveCurrentToSession()
    const edits: SessionEdit[] = []
    for (const edit of sessionEditsRef.current.values()) {
      if (!edit.element.isConnected) {
        sessionEditsRef.current.delete(edit.element)
        continue
      }
      edits.push(edit)
    }
    syncSessionItemCount()
    return edits
  }, [saveCurrentToSession, syncSessionItemCount])

  const getSessionItems = React.useCallback((): SessionItem[] => {
    const edits = getSessionEdits().map((edit) => ({ type: 'edit', edit } as const))
    const comments = getExportableComments(stateRef.current.comments).map((comment) => ({ type: 'comment', comment } as const))
    return [...edits, ...comments]
  }, [getSessionEdits, getExportableComments])

  const exportAllEdits = React.useCallback(async (): Promise<boolean> => {
    const items = getSessionItems()
    const multiSelectContextBlocks = getContextOnlyBlocks(stateRef.current.selectedElements, items)

    if (items.length === 0 && multiSelectContextBlocks.length === 0) return false

    const edits = items.filter((item) => item.type === 'edit').map((item) => item.edit)
    const comments = items.filter((item) => item.type === 'comment').map((item) => item.comment)
    const movePlanContext = buildMovePlanContext(edits)
    // buildSessionExport returns '' when both arrays are empty; filter(Boolean) strips it
    const sessionText = edits.length > 0 || comments.length > 0
      ? buildSessionExport(edits, comments, { movePlanContext })
      : ''
    const blocks = [sessionText, ...multiSelectContextBlocks].filter(Boolean)
    const text = blocks.join('\n\n')
    const instruction = items.length > 0
      ? buildExportInstruction(getExportContentProfile(edits, comments, movePlanContext))
      : 'Here is the element context for reference'
    return copyText(`${instruction}\n\n${text}`)
  }, [getSessionItems])

  const revertElementStyles = React.useCallback((element: HTMLElement, sessionEdit: SessionEdit) => {
    for (const prop of Object.keys(sessionEdit.pendingStyles)) {
      element.style.removeProperty(prop)
    }
    for (const [prop, value] of Object.entries(sessionEdit.originalStyles)) {
      element.style.setProperty(prop, value)
    }
  }, [])

  const refreshSelectedElement = React.useCallback(() => {
    const current = stateRef.current
    if (!current.selectedElement) return
    const el = current.selectedElement
    const computed = getAllComputedStyles(el)
    setState((prev) => ({
      ...prev,
      computedSpacing: computed.spacing,
      computedBorderRadius: computed.borderRadius,
      computedFlex: computed.flex,
      computedSizing: computed.sizing,
      computedColor: computed.color,
      computedBoxShadow: computed.boxShadow,
      computedTypography: computed.typography,
      computedBorder: computed.border,
      originalStyles: getOriginalInlineStyles(el),
      pendingStyles: {},
    }))
  }, [])

  const removeSessionEdit = React.useCallback((element: HTMLElement) => {
    const sessionEdit = sessionEditsRef.current.get(element)
    if (sessionEdit) {
      revertElementStyles(element, sessionEdit)
      if (sessionEdit.textEdit) {
        element.textContent = sessionEdit.textEdit.originalText
      }
    }
    sessionEditsRef.current.delete(element)
    removedSessionEditsRef.current.add(element)
    syncSessionItemCount()
    if (stateRef.current.selectedElement === element) {
      refreshSelectedElement()
    }
  }, [revertElementStyles, refreshSelectedElement, syncSessionItemCount])

  const clearSessionEdits = React.useCallback(() => {
    for (const [el, sessionEdit] of sessionEditsRef.current.entries()) {
      revertElementStyles(el, sessionEdit)
      if (sessionEdit.textEdit) {
        el.textContent = sessionEdit.textEdit.originalText
      }
      removedSessionEditsRef.current.add(el)
    }
    const current = stateRef.current
    if (current.selectedElement) {
      // Also revert pending styles not yet saved to session
      if (!sessionEditsRef.current.has(current.selectedElement)) {
        for (const prop of Object.keys(current.pendingStyles)) {
          current.selectedElement.style.removeProperty(prop)
        }
        for (const [prop, value] of Object.entries(current.originalStyles)) {
          current.selectedElement.style.setProperty(prop, value)
        }
      }
      removedSessionEditsRef.current.add(current.selectedElement)
    }
    sessionEditsRef.current.clear()
    syncSessionItemCount([])
    setState((prev) => (
      prev.comments.length > 0 || prev.activeCommentId
        ? { ...prev, comments: [], activeCommentId: null }
        : prev
    ))
    refreshSelectedElement()
  }, [revertElementStyles, refreshSelectedElement, syncSessionItemCount])

  const exportEdits = React.useCallback(async () => {
    const current = stateRef.current

    // Multi-selection: bundle all selected elements into a single export
    if (current.selectedElements.length > 1) {
      saveCurrentToSession()
      const { editsWithChanges, contextBlocks } = partitionMultiSelectedEdits(
        current.selectedElements, sessionEditsRef,
      )
      if (editsWithChanges.length === 0 && contextBlocks.length === 0) return false

      const allBlocks = [...contextBlocks]
      if (editsWithChanges.length > 0) {
        const movePlanContext = buildMovePlanContext(editsWithChanges)
        allBlocks.unshift(buildSessionExport(editsWithChanges, [], { movePlanContext }))
      }

      const instruction = editsWithChanges.length > 0
        ? buildExportInstruction(getExportContentProfile(editsWithChanges, []))
        : 'Here is the element context for reference'
      return copyText(`${instruction}\n\n${allBlocks.join('\n\n')}`)
    }

    // Single-selection: existing behavior
    if (!current.selectedElement || !current.elementInfo) return false
    const sessionEdit = sessionEditsRef.current.get(current.selectedElement)
    const hasPendingStyles = Object.keys(current.pendingStyles).length > 0
    const hasTextEdit = Boolean(sessionEdit?.textEdit)

    const locator = getElementLocator(current.selectedElement)
    const editForExport = sessionEdit
      ? {
          ...sessionEdit,
          locator,
          pendingStyles: { ...current.pendingStyles },
          textEdit: sessionEdit.textEdit,
        }
      : null
    const movePlanContext = editForExport?.move ? buildMovePlanContext([editForExport]) : null
    const moveIntent = editForExport?.move ? getMoveIntentForEdit(editForExport, movePlanContext) : null
    const hasMove = Boolean(moveIntent)
    const hasExportableEdit = hasPendingStyles || hasTextEdit || hasMove
    const exportMarkdown = hasExportableEdit
      ? hasMove && editForExport
        ? buildSessionExport([editForExport], [], { movePlanContext })
        : buildEditExport(locator, current.pendingStyles, sessionEdit?.textEdit)
      : buildElementContext(locator)
    const instruction = hasExportableEdit
      ? buildExportInstruction({
          hasCssEdits: hasPendingStyles,
          hasTextEdits: hasTextEdit,
          hasMoves: hasMove,
          hasComments: false,
        })
      : 'Here is the element context for reference'
    return copyText(`${instruction}\n\n${exportMarkdown}`)
  }, [saveCurrentToSession])

  return {
    syncSessionItemCount,
    saveCurrentToSession,
    selectElement,
    selectElements,
    toggleElementSelection,
    clearSelection,
    selectParent,
    selectChild,
    insertElement,
    groupSelection,
    resetToOriginal,
    undo,
    handleMoveComplete,
    getSessionEdits,
    getSessionItems,
    exportAllEdits,
    exportEdits,
    revertElementStyles,
    refreshSelectedElement,
    removeSessionEdit,
    clearSessionEdits,
  }
}
