import * as React from 'react'
import { PortalContainerProvider, usePortalContainer } from './portal-container'
import type {
  DirectEditState,
  SpacingPropertyKey,
  BorderRadiusPropertyKey,
  BorderPropertyKey,
  BorderProperties,
  FlexPropertyKey,
  SizingPropertyKey,
  TypographyPropertyKey,
  CSSPropertyValue,
  SizingValue,
  ColorPropertyKey,
  ColorValue,
  UndoEntry,
  ActiveTool,
  Theme,
  Comment,
  SessionEdit,
} from './types'
import type { MoveInfo } from './use-move'
import {
  getComputedStyles,
  getComputedBorderStyles,
  getOriginalInlineStyles,
  getElementInfo,
  formatPropertyValue,
  propertyToCSSMap,
  borderRadiusPropertyToCSSMap,
  borderPropertyToCSSMap,
  flexPropertyToCSSMap,
  sizingPropertyToCSSMap,
  typographyPropertyToCSSMap,
  getComputedSizing,
  sizingValueToCSS,
  getComputedColorStyles,
  colorPropertyToCSSMap,
  getComputedTypography,
  buildEditExport,
  buildCommentExport,
  buildSessionExport,
  getElementDisplayName,
  getElementLocator,
  stylesToTailwind,
} from './utils'
import { formatColorValue } from './ui/color-utils'
import { sendEditToAgent as postEditToAgent, sendCommentToAgent as postCommentToAgent } from './mcp-client'

export interface DirectEditContextValue extends DirectEditState {
  selectElement: (element: HTMLElement) => void
  selectParent: () => void
  selectChild: () => void
  closePanel: () => void
  updateSpacingProperty: (key: SpacingPropertyKey, value: CSSPropertyValue) => void
  updateBorderRadiusProperty: (key: BorderRadiusPropertyKey, value: CSSPropertyValue) => void
  updateBorderProperty: (key: BorderPropertyKey, value: BorderProperties[BorderPropertyKey]) => void
  updateBorderProperties: (changes: Array<[BorderPropertyKey, BorderProperties[BorderPropertyKey]]>) => void
  updateFlexProperty: (key: FlexPropertyKey, value: string) => void
  updateSizingProperty: (key: SizingPropertyKey, value: SizingValue) => void
  updateColorProperty: (key: ColorPropertyKey, value: ColorValue) => void
  updateTypographyProperty: (key: TypographyPropertyKey, value: CSSPropertyValue | string) => void
  resetToOriginal: () => void
  exportEdits: () => Promise<boolean>
  toggleEditMode: () => void
  undo: () => void
  handleMoveComplete: (element: HTMLElement, moveInfo: MoveInfo | null) => void
  setActiveTool: (tool: ActiveTool) => void
  setTheme: (theme: Theme) => void
  addComment: (element: HTMLElement, clickPosition: { x: number; y: number }) => void
  updateCommentText: (id: string, text: string) => void
  addCommentReply: (id: string, text: string) => void
  deleteComment: (id: string) => void
  exportComment: (id: string) => Promise<boolean>
  sendEditToAgent: () => Promise<boolean>
  sendCommentToAgent: (id: string) => Promise<boolean>
  setActiveCommentId: (id: string | null) => void
  sessionEditCount: number
  getSessionEdits: () => SessionEdit[]
  exportAllEdits: () => Promise<boolean>
  clearSessionEdits: () => void
  removeSessionEdit: (element: HTMLElement) => void
}

const DirectEditContext = React.createContext<DirectEditContextValue | null>(null)

export function useDirectEdit(): DirectEditContextValue {
  const context = React.useContext(DirectEditContext)
  if (!context) {
    throw new Error('useDirectEdit must be used within a DirectEditProvider')
  }
  return context
}

interface DirectEditProviderProps {
  children: React.ReactNode
}

export function DirectEditProvider({ children }: DirectEditProviderProps) {

  const [state, setState] = React.useState<DirectEditState>({
    isOpen: false,
    selectedElement: null,
    elementInfo: null,
    computedSpacing: null,
    computedBorderRadius: null,
    computedBorder: null,
    computedFlex: null,
    computedSizing: null,
    computedColor: null,
    computedTypography: null,
    originalStyles: {},
    pendingStyles: {},
    editModeActive: false,
    activeTool: 'select',
    theme: 'system',
    comments: [],
    activeCommentId: null,
  })

  // Read persisted theme on mount (SSR-safe)
  React.useEffect(() => {
    try {
      const stored = localStorage.getItem('direct-edit-theme')
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        setState((prev) => ({ ...prev, theme: stored }))
      }
    } catch {}
  }, [])

  const undoStackRef = React.useRef<UndoEntry[]>([])
  const sessionEditsRef = React.useRef<Map<HTMLElement, SessionEdit>>(new Map())
  const removedSessionEditsRef = React.useRef<WeakSet<HTMLElement>>(new WeakSet())
  const [sessionEditCount, setSessionEditCount] = React.useState(0)
  const stateRef = React.useRef(state)
  React.useEffect(() => {
    stateRef.current = state
  })

  const pushUndo = React.useCallback((entry: UndoEntry) => {
    undoStackRef.current.push(entry)
    if (undoStackRef.current.length > 50) {
      undoStackRef.current = undoStackRef.current.slice(-50)
    }
    if (entry.type === 'edit' || entry.type === 'move') {
      removedSessionEditsRef.current.delete(entry.element)
    }
  }, [])

  const saveCurrentToSession = React.useCallback(() => {
    const current = stateRef.current
    const el = current.selectedElement
    if (!el) return
    if (removedSessionEditsRef.current.has(el)) return

    const existing = sessionEditsRef.current.get(el)
    const pendingStyles = { ...current.pendingStyles }
    const hasPendingStyles = Object.keys(pendingStyles).length > 0
    const hasMove = Boolean(existing?.move)

    if (!hasPendingStyles && !hasMove) {
      if (sessionEditsRef.current.delete(el)) {
        setSessionEditCount(sessionEditsRef.current.size)
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
    })
    setSessionEditCount(sessionEditsRef.current.size)
  }, [])

  React.useEffect(() => {
    if (!state.selectedElement) return
    saveCurrentToSession()
  }, [state.selectedElement, state.pendingStyles, saveCurrentToSession])

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

    const { spacing, borderRadius, flex } = getComputedStyles(element)
    const border = getComputedBorderStyles(element)
    const sizing = getComputedSizing(element)
    const color = getComputedColorStyles(element)
    const typography = getComputedTypography(element)
    const originalStyles = getOriginalInlineStyles(element)
    const elementInfo = getElementInfo(element)

    setState((prev) => ({
      isOpen: true,
      selectedElement: element,
      elementInfo,
      computedSpacing: spacing,
      computedBorderRadius: borderRadius,
      computedBorder: border,
      computedFlex: flex,
      computedSizing: sizing,
      computedColor: color,
      computedTypography: typography,
      originalStyles,
      pendingStyles: {},
      editModeActive: prev.editModeActive,
      activeTool: prev.activeTool,
      theme: prev.theme,
      comments: prev.comments,
      activeCommentId: prev.activeCommentId,
    }))
  }, [pushUndo, saveCurrentToSession])

  const closePanel = React.useCallback(() => {
    setState((prev) => ({
      ...prev,
      isOpen: false,
    }))
  }, [])

  const toggleEditMode = React.useCallback(() => {
    setState((prev) => ({
      ...prev,
      editModeActive: !prev.editModeActive,
      activeTool: prev.editModeActive ? 'select' : prev.activeTool,
      activeCommentId: prev.editModeActive ? null : prev.activeCommentId,
    }))
  }, [])

  const selectParent = React.useCallback(() => {
    if (state.selectedElement?.parentElement) {
      selectElement(state.selectedElement.parentElement)
    }
  }, [state.selectedElement, selectElement])

  const selectChild = React.useCallback(() => {
    const firstChild = state.selectedElement?.firstElementChild as HTMLElement | null
    if (firstChild) {
      selectElement(firstChild)
    }
  }, [state.selectedElement, selectElement])

  const updateSpacingProperty = React.useCallback(
    (key: SpacingPropertyKey, value: CSSPropertyValue) => {
      if (!state.selectedElement) return

      const cssProperty = propertyToCSSMap[key]
      const cssValue = formatPropertyValue(value)

      const previousValue = state.selectedElement.style.getPropertyValue(cssProperty) || null
      pushUndo({ type: 'edit', element: state.selectedElement, properties: [{ cssProperty, previousValue }] })

      state.selectedElement.style.setProperty(cssProperty, cssValue)

      setState((prev) => ({
        ...prev,
        computedSpacing: prev.computedSpacing
          ? {
              ...prev.computedSpacing,
              [key]: value,
            }
          : null,
        pendingStyles: {
          ...prev.pendingStyles,
          [cssProperty]: cssValue,
        },
      }))
    },
    [state.selectedElement, pushUndo]
  )

  const updateBorderRadiusProperty = React.useCallback(
    (key: BorderRadiusPropertyKey, value: CSSPropertyValue) => {
      if (!state.selectedElement) return

      const cssProperty = borderRadiusPropertyToCSSMap[key]
      const cssValue = formatPropertyValue(value)

      const previousValue = state.selectedElement.style.getPropertyValue(cssProperty) || null
      pushUndo({ type: 'edit', element: state.selectedElement, properties: [{ cssProperty, previousValue }] })

      state.selectedElement.style.setProperty(cssProperty, cssValue)

      setState((prev) => ({
        ...prev,
        computedBorderRadius: prev.computedBorderRadius
          ? {
              ...prev.computedBorderRadius,
              [key]: value,
            }
          : null,
        pendingStyles: {
          ...prev.pendingStyles,
          [cssProperty]: cssValue,
        },
      }))
    },
    [state.selectedElement, pushUndo]
  )

  const updateBorderProperty = React.useCallback(
    (key: BorderPropertyKey, value: BorderProperties[BorderPropertyKey]) => {
      if (!state.selectedElement) return

      const cssProperty = borderPropertyToCSSMap[key]
      const cssValue = typeof value === 'string' ? value : formatPropertyValue(value)

      const previousValue = state.selectedElement.style.getPropertyValue(cssProperty) || null
      pushUndo({ type: 'edit', element: state.selectedElement, properties: [{ cssProperty, previousValue }] })

      state.selectedElement.style.setProperty(cssProperty, cssValue)

      const border = getComputedBorderStyles(state.selectedElement)
      const color = getComputedColorStyles(state.selectedElement)

      setState((prev) => ({
        ...prev,
        computedBorder: border,
        computedColor: color,
        pendingStyles: {
          ...prev.pendingStyles,
          [cssProperty]: cssValue,
        },
      }))
    },
    [state.selectedElement, pushUndo]
  )

  const updateBorderProperties = React.useCallback(
    (changes: Array<[BorderPropertyKey, BorderProperties[BorderPropertyKey]]>) => {
      if (!state.selectedElement || changes.length === 0) return

      const properties: Array<{ cssProperty: string; previousValue: string | null }> = []
      const pendingUpdates: Record<string, string> = {}

      for (const [key, value] of changes) {
        const cssProperty = borderPropertyToCSSMap[key]
        const cssValue = typeof value === 'string' ? value : formatPropertyValue(value)

        const previousValue = state.selectedElement.style.getPropertyValue(cssProperty) || null
        properties.push({ cssProperty, previousValue })

        state.selectedElement.style.setProperty(cssProperty, cssValue)
        pendingUpdates[cssProperty] = cssValue
      }

      pushUndo({ type: 'edit', element: state.selectedElement, properties })

      const border = getComputedBorderStyles(state.selectedElement)
      const color = getComputedColorStyles(state.selectedElement)

      setState((prev) => ({
        ...prev,
        computedBorder: border,
        computedColor: color,
        pendingStyles: {
          ...prev.pendingStyles,
          ...pendingUpdates,
        },
      }))
    },
    [state.selectedElement, pushUndo]
  )

  const updateFlexProperty = React.useCallback(
    (key: FlexPropertyKey, value: string) => {
      if (!state.selectedElement) return

      const cssProperty = flexPropertyToCSSMap[key]

      const previousValue = state.selectedElement.style.getPropertyValue(cssProperty) || null
      pushUndo({ type: 'edit', element: state.selectedElement, properties: [{ cssProperty, previousValue }] })

      state.selectedElement.style.setProperty(cssProperty, value)

      setState((prev) => ({
        ...prev,
        computedFlex: prev.computedFlex
          ? {
              ...prev.computedFlex,
              [key]: value,
            }
          : null,
        pendingStyles: {
          ...prev.pendingStyles,
          [cssProperty]: value,
        },
      }))
    },
    [state.selectedElement, pushUndo]
  )

  const updateSizingProperty = React.useCallback(
    (key: SizingPropertyKey, value: SizingValue) => {
      if (!state.selectedElement) return

      const cssProperty = sizingPropertyToCSSMap[key]
      const cssValue = sizingValueToCSS(value)

      const previousValue = state.selectedElement.style.getPropertyValue(cssProperty) || null
      pushUndo({ type: 'edit', element: state.selectedElement, properties: [{ cssProperty, previousValue }] })

      state.selectedElement.style.setProperty(cssProperty, cssValue)

      setState((prev) => ({
        ...prev,
        computedSizing: prev.computedSizing
          ? {
              ...prev.computedSizing,
              [key]: value,
            }
          : null,
        pendingStyles: {
          ...prev.pendingStyles,
          [cssProperty]: cssValue,
        },
      }))
    },
    [state.selectedElement, pushUndo]
  )

  const updateColorProperty = React.useCallback(
    (key: ColorPropertyKey, value: ColorValue) => {
      if (!state.selectedElement) return

      const cssProperty = colorPropertyToCSSMap[key]
      const cssValue = formatColorValue(value)

      const previousValue = state.selectedElement.style.getPropertyValue(cssProperty) || null
      pushUndo({ type: 'edit', element: state.selectedElement, properties: [{ cssProperty, previousValue }] })

      state.selectedElement.style.setProperty(cssProperty, cssValue)

      setState((prev) => ({
        ...prev,
        computedColor: prev.computedColor
          ? {
              ...prev.computedColor,
              [key]: value,
            }
          : null,
        pendingStyles: {
          ...prev.pendingStyles,
          [cssProperty]: cssValue,
        },
      }))
    },
    [state.selectedElement, pushUndo]
  )

  const updateTypographyProperty = React.useCallback(
    (key: TypographyPropertyKey, value: CSSPropertyValue | string) => {
      if (!state.selectedElement) return

      const cssProperty = typographyPropertyToCSSMap[key]
      const cssValue = typeof value === 'string' ? value : formatPropertyValue(value)

      if (key === 'textVerticalAlign') {
        const prevDisplay = state.selectedElement.style.getPropertyValue('display') || null
        const prevAlignItems = state.selectedElement.style.getPropertyValue('align-items') || null
        pushUndo({
          type: 'edit',
          element: state.selectedElement,
          properties: [
            { cssProperty: 'display', previousValue: prevDisplay },
            { cssProperty: 'align-items', previousValue: prevAlignItems },
          ],
        })

        const computed = window.getComputedStyle(state.selectedElement)
        const isInline = computed.display === 'inline' || computed.display === 'inline-block'
        const displayValue = isInline ? 'inline-flex' : 'flex'
        state.selectedElement.style.setProperty('display', displayValue)
        state.selectedElement.style.setProperty('align-items', cssValue)
      } else {
        const previousValue = state.selectedElement.style.getPropertyValue(cssProperty) || null
        pushUndo({ type: 'edit', element: state.selectedElement, properties: [{ cssProperty, previousValue }] })

        state.selectedElement.style.setProperty(cssProperty, cssValue)
      }

      setState((prev) => {
        let displayValue = 'flex'
        if (key === 'textVerticalAlign' && state.selectedElement) {
          const computed = window.getComputedStyle(state.selectedElement)
          const isInline = computed.display === 'inline-flex' || prev.pendingStyles.display === 'inline-flex'
          displayValue = isInline ? 'inline-flex' : 'flex'
        }

        return {
          ...prev,
          computedTypography: prev.computedTypography
            ? {
                ...prev.computedTypography,
                [key]: value,
              }
            : null,
          pendingStyles: {
            ...prev.pendingStyles,
            ...(key === 'textVerticalAlign'
              ? { display: displayValue, 'align-items': cssValue }
              : { [cssProperty]: cssValue }),
          },
        }
      })
    },
    [state.selectedElement, pushUndo]
  )

  const resetToOriginal = React.useCallback(() => {
    if (!state.selectedElement) return

    const el = state.selectedElement
    const sessionEntry = sessionEditsRef.current.get(el)
    if (sessionEntry?.move) {
      sessionEditsRef.current.set(el, { ...sessionEntry, pendingStyles: {} })
    } else {
      sessionEditsRef.current.delete(el)
    }
    setSessionEditCount(sessionEditsRef.current.size)
    undoStackRef.current = undoStackRef.current.filter(
      (entry) => !(entry.type === 'edit' && entry.element === el)
    )

    const allCSSProps = [
      ...Object.values(propertyToCSSMap),
      ...Object.values(borderRadiusPropertyToCSSMap),
      ...Object.values(borderPropertyToCSSMap),
      ...Object.values(flexPropertyToCSSMap),
      ...Object.values(sizingPropertyToCSSMap),
      ...Object.values(colorPropertyToCSSMap),
      ...Object.values(typographyPropertyToCSSMap),
    ]

    for (const prop of allCSSProps) {
      state.selectedElement.style.removeProperty(prop)
    }

    for (const [prop, value] of Object.entries(state.originalStyles)) {
      state.selectedElement.style.setProperty(prop, value)
    }

    const { spacing, borderRadius, flex } = getComputedStyles(state.selectedElement)
    const border = getComputedBorderStyles(state.selectedElement)
    const sizing = getComputedSizing(state.selectedElement)
    const color = getComputedColorStyles(state.selectedElement)
    const typography = getComputedTypography(state.selectedElement)

    setState((prev) => ({
      ...prev,
      computedSpacing: spacing,
      computedBorderRadius: borderRadius,
      computedBorder: border,
      computedFlex: flex,
      computedSizing: sizing,
      computedColor: color,
      computedTypography: typography,
      pendingStyles: {},
    }))
  }, [state.selectedElement, state.originalStyles])

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
          const { spacing, borderRadius, flex } = getComputedStyles(entry.element)
          const border = getComputedBorderStyles(entry.element)
          const sizing = getComputedSizing(entry.element)
          const color = getComputedColorStyles(entry.element)
          const typography = getComputedTypography(entry.element)
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
            computedSpacing: spacing,
            computedBorderRadius: borderRadius,
            computedBorder: border,
            computedFlex: flex,
            computedSizing: sizing,
            computedColor: color,
            computedTypography: typography,
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
          const { spacing, borderRadius, flex } = getComputedStyles(prevEl)
          const border = getComputedBorderStyles(prevEl)
          const sizing = getComputedSizing(prevEl)
          const color = getComputedColorStyles(prevEl)
          const typography = getComputedTypography(prevEl)
          const elementInfo = getElementInfo(prevEl)
          setState((prev) => ({
            isOpen: true,
            selectedElement: prevEl,
            elementInfo,
            computedSpacing: spacing,
            computedBorderRadius: borderRadius,
            computedBorder: border,
            computedFlex: flex,
            computedSizing: sizing,
            computedColor: color,
            computedTypography: typography,
            originalStyles: entry.previousOriginalStyles,
            pendingStyles: entry.previousPendingStyles,
            editModeActive: prev.editModeActive,
            activeTool: prev.activeTool,
            theme: prev.theme,
            comments: prev.comments,
            activeCommentId: prev.activeCommentId,
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
          if (Object.keys(sessionEntry.pendingStyles).length > 0 || restoredMove) {
            sessionEditsRef.current.set(entry.element, { ...sessionEntry, move: restoredMove })
          } else {
            sessionEditsRef.current.delete(entry.element)
          }
          setSessionEditCount(sessionEditsRef.current.size)
        }
        const current = stateRef.current
        if (current.selectedElement === entry.element) {
          const elementInfo = getElementInfo(entry.element)
          setState((prev) => ({ ...prev, elementInfo }))
        }
        break
      }
    }
  }, [])

  const handleMoveComplete = React.useCallback(
    (element: HTMLElement, moveInfo: MoveInfo | null) => {
      if (moveInfo) {
        const existing = sessionEditsRef.current.get(element)
        pushUndo({
          type: 'move',
          element,
          originalParent: moveInfo.originalParent,
          originalNextSibling: moveInfo.originalNextSibling,
          previousSessionMove: existing?.move ?? null,
        })
        const locator = existing?.locator ?? getElementLocator(element)
        const newParent = element.parentElement

        // Preserve initial from* from the first move; only update to* on later moves
        const fromFields = existing?.move
          ? {
              fromParentName: existing.move.fromParentName,
              fromSiblingBefore: existing.move.fromSiblingBefore,
              fromSiblingAfter: existing.move.fromSiblingAfter,
            }
          : {
              fromParentName: getElementDisplayName(moveInfo.originalParent),
              fromSiblingBefore: moveInfo.originalPreviousSibling
                ? getElementDisplayName(moveInfo.originalPreviousSibling)
                : null,
              fromSiblingAfter: moveInfo.originalNextSibling
                ? getElementDisplayName(moveInfo.originalNextSibling)
                : null,
            }

        sessionEditsRef.current.set(element, {
          element,
          locator,
          originalStyles: existing?.originalStyles ?? { ...stateRef.current.originalStyles },
          pendingStyles: existing?.pendingStyles ?? { ...stateRef.current.pendingStyles },
          move: newParent
            ? {
                ...fromFields,
                toParentName: getElementDisplayName(newParent),
                toSiblingBefore: element.previousElementSibling
                  ? getElementDisplayName(element.previousElementSibling as HTMLElement)
                  : null,
                toSiblingAfter: element.nextElementSibling
                  ? getElementDisplayName(element.nextElementSibling as HTMLElement)
                  : null,
              }
            : null,
        })
        setSessionEditCount(sessionEditsRef.current.size)
      }
      // Refresh element state without going through selectElement,
      // which would push an extra selection undo entry.
      const { spacing, borderRadius, flex } = getComputedStyles(element)
      const border = getComputedBorderStyles(element)
      const sizing = getComputedSizing(element)
      const color = getComputedColorStyles(element)
      const typography = getComputedTypography(element)
      const elementInfo = getElementInfo(element)

      setState((prev) => ({
        isOpen: true,
        selectedElement: element,
        elementInfo,
        computedSpacing: spacing,
        computedBorderRadius: borderRadius,
        computedBorder: border,
        computedFlex: flex,
        computedSizing: sizing,
        computedColor: color,
        computedTypography: typography,
        originalStyles: prev.originalStyles,
        pendingStyles: prev.pendingStyles,
        editModeActive: prev.editModeActive,
        activeTool: prev.activeTool,
        theme: prev.theme,
        comments: prev.comments,
        activeCommentId: prev.activeCommentId,
      }))
    },
    [pushUndo]
  )

  const setActiveTool = React.useCallback((tool: ActiveTool) => {
    setState((prev) => ({
      ...prev,
      activeTool: tool,
      activeCommentId: null,
    }))
  }, [])

  const setTheme = React.useCallback((theme: Theme) => {
    setState((prev) => ({ ...prev, theme }))
    try { localStorage.setItem('direct-edit-theme', theme) } catch {}
  }, [])

  const addComment = React.useCallback((element: HTMLElement, clickPosition: { x: number; y: number }) => {
    const locator = getElementLocator(element)
    const rect = element.getBoundingClientRect()
    const relativePosition = {
      x: clickPosition.x - rect.left,
      y: clickPosition.y - rect.top,
    }
    const id = `comment-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const comment: Comment = {
      id,
      element,
      locator,
      clickPosition,
      relativePosition,
      text: '',
      createdAt: Date.now(),
      replies: [],
    }
    setState((prev) => ({
      ...prev,
      comments: [...prev.comments, comment],
      activeCommentId: id,
    }))
  }, [])

  const updateCommentText = React.useCallback((id: string, text: string) => {
    setState((prev) => ({
      ...prev,
      comments: prev.comments.map((c) => (c.id === id ? { ...c, text } : c)),
    }))
  }, [])

  const addCommentReply = React.useCallback((id: string, text: string) => {
    setState((prev) => ({
      ...prev,
      comments: prev.comments.map((c) =>
        c.id === id
          ? { ...c, replies: [...c.replies, { text, createdAt: Date.now() }] }
          : c
      ),
    }))
  }, [])

  const deleteComment = React.useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      comments: prev.comments.filter((c) => c.id !== id),
      activeCommentId: prev.activeCommentId === id ? null : prev.activeCommentId,
    }))
  }, [])

  const exportComment = React.useCallback(async (id: string) => {
    const comment = stateRef.current.comments.find((c) => c.id === id)
    if (!comment) return false

    const exportMarkdown = buildCommentExport(comment.locator, comment.text, comment.replies)
    try {
      await navigator.clipboard.writeText(exportMarkdown)
      return true
    } catch {
      return false
    }
  }, [])

  const setActiveCommentId = React.useCallback((id: string | null) => {
    setState((prev) => {
      let comments = prev.comments
      if (prev.activeCommentId && prev.activeCommentId !== id) {
        const active = comments.find((c) => c.id === prev.activeCommentId)
        if (active && active.text === '') {
          comments = comments.filter((c) => c.id !== prev.activeCommentId)
        }
      }
      return { ...prev, comments, activeCommentId: id }
    })
  }, [])

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
    setSessionEditCount(sessionEditsRef.current.size)
    return edits
  }, [saveCurrentToSession])

  const exportAllEdits = React.useCallback(async (): Promise<boolean> => {
    const edits = getSessionEdits()
    if (edits.length === 0) return false
    const text = buildSessionExport(edits)
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      return false
    }
  }, [getSessionEdits])

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
    const { spacing, borderRadius, flex } = getComputedStyles(el)
    const sizing = getComputedSizing(el)
    const color = getComputedColorStyles(el)
    const typography = getComputedTypography(el)
    const border = getComputedBorderStyles(el)
    setState((prev) => ({
      ...prev,
      computedSpacing: spacing,
      computedBorderRadius: borderRadius,
      computedFlex: flex,
      computedSizing: sizing,
      computedColor: color,
      computedTypography: typography,
      computedBorder: border,
      originalStyles: getOriginalInlineStyles(el),
      pendingStyles: {},
    }))
  }, [])

  const removeSessionEdit = React.useCallback((element: HTMLElement) => {
    const sessionEdit = sessionEditsRef.current.get(element)
    if (sessionEdit) {
      revertElementStyles(element, sessionEdit)
    }
    sessionEditsRef.current.delete(element)
    removedSessionEditsRef.current.add(element)
    setSessionEditCount(sessionEditsRef.current.size)
    if (stateRef.current.selectedElement === element) {
      refreshSelectedElement()
    }
  }, [revertElementStyles, refreshSelectedElement])

  const clearSessionEdits = React.useCallback(() => {
    for (const [el, sessionEdit] of sessionEditsRef.current.entries()) {
      revertElementStyles(el, sessionEdit)
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
    setSessionEditCount(0)
    refreshSelectedElement()
  }, [revertElementStyles, refreshSelectedElement])

  const exportEdits = React.useCallback(async () => {
    if (
      !state.selectedElement ||
      !state.elementInfo ||
      !state.pendingStyles ||
      Object.keys(state.pendingStyles).length === 0
    ) {
      return false
    }

    const locator = getElementLocator(state.selectedElement)
    const exportMarkdown = buildEditExport(locator, state.pendingStyles)
    try {
      await navigator.clipboard.writeText(exportMarkdown)
      return true
    } catch {
      return false
    }
  }, [
    state.selectedElement,
    state.elementInfo,
    state.computedSpacing,
    state.computedBorderRadius,
    state.computedBorder,
    state.computedFlex,
    state.computedSizing,
    state.pendingStyles,
  ])

  const sendEditToAgent = React.useCallback(async () => {
    if (
      !state.selectedElement ||
      !state.elementInfo ||
      !state.pendingStyles ||
      Object.keys(state.pendingStyles).length === 0
    ) {
      return false
    }

    const locator = getElementLocator(state.selectedElement)
    const exportMarkdown = buildEditExport(locator, state.pendingStyles)
    const changes = Object.entries(state.pendingStyles).map(([cssProperty, cssValue]) => ({
      cssProperty,
      cssValue,
      tailwindClass: stylesToTailwind({ [cssProperty]: cssValue }),
    }))

    try {
      const result = await postEditToAgent({
        element: {
          tagName: locator.tagName,
          id: locator.id,
          classList: locator.classList,
          domSelector: locator.domSelector,
          targetHtml: locator.targetHtml,
          textPreview: locator.textPreview,
        },
        source: locator.domSource || null,
        reactStack: locator.reactStack,
        changes,
        exportMarkdown,
      })
      return result.ok
    } catch {
      return false
    }
  }, [
    state.selectedElement,
    state.elementInfo,
    state.pendingStyles,
  ])

  const sendCommentToAgent = React.useCallback(async (id: string) => {
    const comment = stateRef.current.comments.find((c) => c.id === id)
    if (!comment) return false

    const exportMarkdown = buildCommentExport(comment.locator, comment.text, comment.replies)

    try {
      const result = await postCommentToAgent({
        element: {
          tagName: comment.locator.tagName,
          id: comment.locator.id,
          classList: comment.locator.classList,
          domSelector: comment.locator.domSelector,
          targetHtml: comment.locator.targetHtml,
          textPreview: comment.locator.textPreview,
        },
        source: comment.locator.domSource || null,
        reactStack: comment.locator.reactStack,
        commentText: comment.text,
        replies: comment.replies,
        exportMarkdown,
      })
      return result.ok
    } catch {
      return false
    }
  }, [])

  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === '.') {
        e.preventDefault()
        toggleEditMode()
        return
      }

      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
        return
      }

      if (e.key === 'C' && e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey && state.editModeActive) {
        const active = document.activeElement
        const isInput = active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement || (active instanceof HTMLElement && active.isContentEditable)
        if (!isInput) {
          e.preventDefault()
          setState((prev) => {
            let comments = prev.comments
            if (prev.activeCommentId) {
              const active = comments.find((c) => c.id === prev.activeCommentId)
              if (active && active.text === '') {
                comments = comments.filter((c) => c.id !== prev.activeCommentId)
              }
            }
            return {
              ...prev,
              comments,
              activeTool: prev.activeTool === 'comment' ? 'select' : 'comment',
              activeCommentId: null,
            }
          })
          return
        }
      }

      if (e.key === 'Escape') {
        if (state.activeCommentId) {
          setState((prev) => {
            let comments = prev.comments
            const active = comments.find((c) => c.id === prev.activeCommentId)
            if (active && active.text === '') {
              comments = comments.filter((c) => c.id !== prev.activeCommentId)
            }
            return { ...prev, comments, activeCommentId: null }
          })
        } else if (state.activeTool === 'comment') {
          setState((prev) => ({ ...prev, activeTool: 'select' }))
        } else if (state.isOpen) {
          closePanel()
        } else if (state.editModeActive) {
          toggleEditMode()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [state.isOpen, state.editModeActive, state.activeCommentId, state.activeTool, closePanel, toggleEditMode, undo])

  const contextValue: DirectEditContextValue = {
    ...state,
    selectElement,
    selectParent,
    selectChild,
    closePanel,
    updateSpacingProperty,
    updateBorderRadiusProperty,
    updateBorderProperty,
    updateBorderProperties,
    updateFlexProperty,
    updateSizingProperty,
    updateColorProperty,
    updateTypographyProperty,
    resetToOriginal,
    exportEdits,
    sendEditToAgent,
    sendCommentToAgent,
    toggleEditMode,
    undo,
    handleMoveComplete,
    setActiveTool,
    setTheme,
    addComment,
    updateCommentText,
    addCommentReply,
    deleteComment,
    exportComment,
    setActiveCommentId,
    sessionEditCount,
    getSessionEdits,
    exportAllEdits,
    clearSessionEdits,
    removeSessionEdit,
  }

  return (
    <PortalContainerProvider>
      <DirectEditContext.Provider value={contextValue}>
        <ThemeApplier />
        {children}
      </DirectEditContext.Provider>
    </PortalContainerProvider>
  )
}

function ThemeApplier() {
  const { theme } = useDirectEdit()
  const container = usePortalContainer()

  React.useEffect(() => {
    if (!container) return
    const host = (container.getRootNode() as ShadowRoot).host as HTMLElement
    if (theme === 'system') {
      host.removeAttribute('data-theme')
    } else {
      host.setAttribute('data-theme', theme)
    }
  }, [container, theme])

  return null
}
