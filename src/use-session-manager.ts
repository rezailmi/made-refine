import * as React from 'react'
import type {
  DirectEditState,
  UndoEntry,
  SessionEdit,
  SessionItem,
  Comment,
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
  getElementDisplayName,
  getElementLocator,
} from './utils'

type ParentLayout = 'flex' | 'grid' | 'block' | 'other'

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
} {
  if (!parent) return {}
  const display = window.getComputedStyle(parent).display
  return {
    display,
    layout: getLayoutFromDisplay(display),
  }
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

  const selectElement = React.useCallback((element: HTMLElement) => {
    saveCurrentToSession()
    const current = stateRef.current
    if (current.selectedElement || current.isOpen) {
      pushUndo({
        type: 'selection',
        previousElement: current.selectedElement,
        previousOriginalStyles: { ...current.originalStyles },
        previousPendingStyles: { ...current.pendingStyles },
      })
    }

    const existingEdit = sessionEditsRef.current.get(element)
    const computed = getAllComputedStyles(element)
    const originalStyles = existingEdit?.originalStyles ?? getOriginalInlineStyles(element)
    const pendingStyles = existingEdit?.pendingStyles ?? {}
    const elementInfo = getElementInfo(element)

    setState((prev) => ({
      isOpen: true,
      selectedElement: element,
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
      comments: prev.comments,
      activeCommentId: prev.activeCommentId,
      canvas: prev.canvas,
      textEditingElement: null,
    }))

  }, [pushUndo, saveCurrentToSession])

  const selectParent = React.useCallback(() => {
    const el = stateRef.current.selectedElement
    if (el?.parentElement) {
      selectElement(el.parentElement)
    }
  }, [selectElement])

  const selectChild = React.useCallback(() => {
    const firstChild = stateRef.current.selectedElement?.firstElementChild as HTMLElement | null
    if (firstChild) {
      selectElement(firstChild)
    }
  }, [selectElement])

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
        const prevEl = entry.previousElement
        if (prevEl && !prevEl.isConnected) return
        if (prevEl) {
          for (const [prop, value] of Object.entries(entry.previousPendingStyles)) {
            prevEl.style.setProperty(prop, value)
          }
          const computed = getAllComputedStyles(prevEl)
          const elementInfo = getElementInfo(prevEl)
          setState((prev) => ({
            isOpen: true,
            selectedElement: prevEl,
            elementInfo,
            computedSpacing: computed.spacing,
            computedBorderRadius: computed.borderRadius,
            computedBorder: computed.border,
            computedFlex: computed.flex,
            computedSizing: computed.sizing,
            computedColor: computed.color,
            computedBoxShadow: computed.boxShadow,
            computedTypography: computed.typography,
            originalStyles: entry.previousOriginalStyles,
            pendingStyles: entry.previousPendingStyles,
            editModeActive: prev.editModeActive,
            activeTool: prev.activeTool,
            theme: prev.theme,
            borderStyleControlPreference: prev.borderStyleControlPreference,
            comments: prev.comments,
            activeCommentId: prev.activeCommentId,
            canvas: prev.canvas,
            textEditingElement: null,
          }))
        } else {
          setState((prev) => ({
            ...prev,
            isOpen: false,
            selectedElement: null,
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
          }))
        }
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
  }, [])

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
        const getAnchor = (node: HTMLElement | null): {
          selector: string | null
          source: ReturnType<typeof getElementLocator>['domSource'] | null
        } => {
          if (!node) {
            return { selector: null, source: null }
          }
          const locator = getElementLocator(node)
          const selector = locator.domSelector.trim()
          return {
            selector: selector.length > 0 ? selector : null,
            source: locator.domSource ?? null,
          }
        }

        const existing = sessionEditsRef.current.get(element)
        const styleState = getStyleStateForElement(existing)
        const moveMode: MoveMode = moveInfo.mode ?? 'free'
        pushUndo({
          type: 'move',
          element,
          originalParent: moveInfo.originalParent,
          originalNextSibling: moveInfo.originalNextSibling,
          previousSessionMove: existing?.move ?? null,
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
        const draggedPosition = window.getComputedStyle(element).position

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
                draggedPosition,
                toIndex,
              }
            : null,
        })
        syncSessionItemCount()
      }
      // Refresh element state without going through selectElement,
      // which would push an extra selection undo entry.
      const computed = getAllComputedStyles(element)
      const elementInfo = getElementInfo(element)
      const styleState = getStyleStateForElement(sessionEditsRef.current.get(element))

      setState((prev) => ({
        isOpen: true,
        selectedElement: element,
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
    [pushUndo]
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
    if (items.length === 0) return false
    const edits = items.filter((item) => item.type === 'edit').map((item) => item.edit)
    const comments = items.filter((item) => item.type === 'comment').map((item) => item.comment)
    const text = buildSessionExport(edits, comments)
    try {
      await navigator.clipboard.writeText(`implement the visual edits\n\n${text}`)
      return true
    } catch {
      return false
    }
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
    if (!current.selectedElement || !current.elementInfo) return false
    const sessionEdit = sessionEditsRef.current.get(current.selectedElement)
    const hasPendingStyles = Object.keys(current.pendingStyles).length > 0
    const hasTextEdit = Boolean(sessionEdit?.textEdit)
    const hasMove = Boolean(sessionEdit?.move)

    const locator = getElementLocator(current.selectedElement)
    const exportMarkdown = hasPendingStyles || hasTextEdit || hasMove
      ? hasMove && sessionEdit
        ? buildSessionExport([{
            ...sessionEdit,
            locator,
            pendingStyles: { ...current.pendingStyles },
            textEdit: sessionEdit.textEdit,
          }], [])
        : buildEditExport(locator, current.pendingStyles, sessionEdit?.textEdit)
      : buildElementContext(locator)
    try {
      await navigator.clipboard.writeText(`implement the visual edits\n\n${exportMarkdown}`)
      return true
    } catch {
      return false
    }
  }, [])

  return {
    syncSessionItemCount,
    saveCurrentToSession,
    selectElement,
    selectParent,
    selectChild,
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
