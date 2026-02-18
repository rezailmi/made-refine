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
  BorderStyleControlPreference,
  Comment,
  SessionEdit,
  SessionItem,
} from './types'
import type { MoveInfo } from './use-move'
import {
  getAllComputedStyles,
  getComputedStyles,
  getComputedBorderStyles,
  getComputedColorStyles,
  getComputedBoxShadow,
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
  colorPropertyToCSSMap,
  getComputedTypography,
  buildElementContext,
  buildEditExport,
  buildCommentExport,
  buildSessionExport,
  getElementDisplayName,
  getElementLocator,
  stylesToTailwind,
  collapseExportShorthands,
  isTextElement,
} from './utils'
import { formatColorValue } from './ui/color-utils'
import { sendEditToAgent as postEditToAgent, sendCommentToAgent as postCommentToAgent } from './mcp-client'

export interface DirectEditActionsContextValue {
  selectElement: (element: HTMLElement) => void
  selectParent: () => void
  selectChild: () => void
  closePanel: () => void
  updateSpacingProperty: (key: SpacingPropertyKey, value: CSSPropertyValue) => void
  updateBorderRadiusProperty: (key: BorderRadiusPropertyKey, value: CSSPropertyValue) => void
  updateBorderProperty: (key: BorderPropertyKey, value: BorderProperties[BorderPropertyKey]) => void
  updateBorderProperties: (changes: Array<[BorderPropertyKey, BorderProperties[BorderPropertyKey]]>) => void
  updateRawCSS: (properties: Record<string, string>) => void
  updateFlexProperty: (key: FlexPropertyKey, value: string) => void
  toggleFlexLayout: () => void
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
  setBorderStyleControlPreference: (preference: BorderStyleControlPreference) => void
  addComment: (element: HTMLElement, clickPosition: { x: number; y: number }) => void
  updateCommentText: (id: string, text: string) => void
  addCommentReply: (id: string, text: string) => void
  deleteComment: (id: string) => void
  exportComment: (id: string) => Promise<boolean>
  canSendEditToAgent: () => boolean
  sendEditToAgent: () => Promise<boolean>
  sendCommentToAgent: (id: string) => Promise<boolean>
  setActiveCommentId: (id: string | null) => void
  getSessionEdits: () => SessionEdit[]
  getSessionItems: () => SessionItem[]
  exportAllEdits: () => Promise<boolean>
  clearSessionEdits: () => void
  removeSessionEdit: (element: HTMLElement) => void
  startTextEditing: (element: HTMLElement) => void
  commitTextEditing: () => void
}

export interface DirectEditStateContextValue extends DirectEditState {
  sessionEditCount: number
}

export interface DirectEditContextValue extends DirectEditStateContextValue, DirectEditActionsContextValue {}

const DirectEditStateContext = React.createContext<DirectEditStateContextValue | null>(null)
const DirectEditActionsContext = React.createContext<DirectEditActionsContextValue | null>(null)

export function useDirectEditState(): DirectEditStateContextValue {
  const context = React.useContext(DirectEditStateContext)
  if (!context) {
    throw new Error('useDirectEditState must be used within a DirectEditProvider')
  }
  return context
}

export function useDirectEditActions(): DirectEditActionsContextValue {
  const context = React.useContext(DirectEditActionsContext)
  if (!context) {
    throw new Error('useDirectEditActions must be used within a DirectEditProvider')
  }
  return context
}

export function useDirectEdit(): DirectEditContextValue {
  const state = useDirectEditState()
  const actions = useDirectEditActions()
  return React.useMemo(() => ({ ...state, ...actions }), [state, actions])
}

interface DirectEditProviderProps {
  children: React.ReactNode
}

const BORDER_STYLE_CONTROL_PREFERENCE_KEY = 'direct-edit-border-style-control'

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
    computedBoxShadow: null,
    computedTypography: null,
    originalStyles: {},
    pendingStyles: {},
    editModeActive: false,
    activeTool: 'select',
    theme: 'system',
    borderStyleControlPreference: 'icon',
    comments: [],
    activeCommentId: null,
    textEditingElement: null,
  })

  // Read all persisted preferences on mount (SSR-safe, single setState)
  React.useEffect(() => {
    try {
      const updates: Partial<DirectEditState> = {}
      const theme = localStorage.getItem('direct-edit-theme')
      if (theme === 'light' || theme === 'dark' || theme === 'system') {
        updates.theme = theme
      }
      const borderPref = localStorage.getItem(BORDER_STYLE_CONTROL_PREFERENCE_KEY)
      if (borderPref === 'label' || borderPref === 'icon') {
        updates.borderStyleControlPreference = borderPref
      }
      if (Object.keys(updates).length > 0) {
        setState((prev) => ({ ...prev, ...updates }))
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

  const getExportableComments = React.useCallback((comments: Comment[]): Comment[] => {
    return comments.filter((comment) => comment.text.trim().length > 0)
  }, [])

  const syncSessionItemCount = React.useCallback((comments = stateRef.current.comments) => {
    setSessionEditCount(sessionEditsRef.current.size + getExportableComments(comments).length)
  }, [getExportableComments])

  const pushUndo = React.useCallback((entry: UndoEntry) => {
    undoStackRef.current.push(entry)
    if (undoStackRef.current.length > 500) {
      undoStackRef.current = undoStackRef.current.slice(-500)
    }
    if (entry.type === 'edit' || entry.type === 'move' || entry.type === 'textEdit') {
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
      textEditingElement: null,
    }))

  }, [pushUndo, saveCurrentToSession])

  const finalizeTextEditing = React.useCallback((editingElement: HTMLElement) => {
    const newText = editingElement.textContent ?? ''
    const existing = sessionEditsRef.current.get(editingElement)
    const originalText = existing?.textEdit?.originalText
      ?? editingElement.getAttribute('data-direct-edit-original-text')
      ?? newText
    const previousText = existing?.textEdit?.newText ?? originalText

    editingElement.removeAttribute('contenteditable')
    editingElement.removeAttribute('data-direct-edit-original-text')
    editingElement.style.outline = ''
    editingElement.style.outlineOffset = ''
    editingElement.blur()

    if (newText !== previousText) {
      pushUndo({ type: 'textEdit', element: editingElement, originalText, previousText })
      removedSessionEditsRef.current.delete(editingElement)

      if (newText === originalText) {
        // Reverted to original - remove textEdit from session
        if (existing) {
          if (Object.keys(existing.pendingStyles).length > 0 || existing.move) {
            sessionEditsRef.current.set(editingElement, { ...existing, textEdit: null })
          } else {
            sessionEditsRef.current.delete(editingElement)
          }
        }
      } else {
        const current = stateRef.current
        const locator = existing?.locator ?? getElementLocator(editingElement)
        const originalStyles = existing?.originalStyles
          ?? (current.selectedElement === editingElement ? { ...current.originalStyles } : {})
        const pendingStyles = existing?.pendingStyles
          ?? (current.selectedElement === editingElement ? { ...current.pendingStyles } : {})
        sessionEditsRef.current.set(editingElement, {
          element: editingElement,
          locator,
          originalStyles,
          pendingStyles,
          move: existing?.move ?? null,
          textEdit: { originalText, newText },
        })
      }
      syncSessionItemCount()
    }

    setState((prev) => (prev.textEditingElement ? { ...prev, textEditingElement: null } : prev))
  }, [pushUndo, syncSessionItemCount])

  const closePanel = React.useCallback(() => {
    setState((prev) => ({
      ...prev,
      isOpen: false,
    }))
  }, [])

  const toggleEditMode = React.useCallback(() => {
    const current = stateRef.current
    if (current.editModeActive && current.textEditingElement) {
      finalizeTextEditing(current.textEditingElement)
    }

    setState((prev) => ({
      ...prev,
      editModeActive: !prev.editModeActive,
      activeTool: prev.editModeActive ? 'select' : prev.activeTool,
      activeCommentId: prev.editModeActive ? null : prev.activeCommentId,
    }))
  }, [finalizeTextEditing])

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

  const updateSpacingProperty = React.useCallback(
    (key: SpacingPropertyKey, value: CSSPropertyValue) => {
      const el = stateRef.current.selectedElement
      if (!el) return

      const cssProperty = propertyToCSSMap[key]
      const cssValue = formatPropertyValue(value)

      const previousValue = el.style.getPropertyValue(cssProperty) || null
      pushUndo({ type: 'edit', element: el, properties: [{ cssProperty, previousValue }] })

      el.style.setProperty(cssProperty, cssValue)

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
    [pushUndo]
  )

  const updateBorderRadiusProperty = React.useCallback(
    (key: BorderRadiusPropertyKey, value: CSSPropertyValue) => {
      const el = stateRef.current.selectedElement
      if (!el) return

      const cssProperty = borderRadiusPropertyToCSSMap[key]
      const cssValue = formatPropertyValue(value)

      const previousValue = el.style.getPropertyValue(cssProperty) || null
      pushUndo({ type: 'edit', element: el, properties: [{ cssProperty, previousValue }] })

      el.style.setProperty(cssProperty, cssValue)

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
    [pushUndo]
  )

  const updateBorderProperty = React.useCallback(
    (key: BorderPropertyKey, value: BorderProperties[BorderPropertyKey]) => {
      const el = stateRef.current.selectedElement
      if (!el) return

      const cssProperty = borderPropertyToCSSMap[key]
      const cssValue = typeof value === 'string' ? value : formatPropertyValue(value)

      const previousValue = el.style.getPropertyValue(cssProperty) || null
      pushUndo({ type: 'edit', element: el, properties: [{ cssProperty, previousValue }] })

      el.style.setProperty(cssProperty, cssValue)

      const border = getComputedBorderStyles(el)
      const color = getComputedColorStyles(el)

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
    [pushUndo]
  )

  const updateBorderProperties = React.useCallback(
    (changes: Array<[BorderPropertyKey, BorderProperties[BorderPropertyKey]]>) => {
      const el = stateRef.current.selectedElement
      if (!el || changes.length === 0) return

      const properties: Array<{ cssProperty: string; previousValue: string | null }> = []
      const pendingUpdates: Record<string, string> = {}

      for (const [key, value] of changes) {
        const cssProperty = borderPropertyToCSSMap[key]
        const cssValue = typeof value === 'string' ? value : formatPropertyValue(value)

        const previousValue = el.style.getPropertyValue(cssProperty) || null
        properties.push({ cssProperty, previousValue })

        el.style.setProperty(cssProperty, cssValue)
        pendingUpdates[cssProperty] = cssValue
      }

      pushUndo({ type: 'edit', element: el, properties })

      const border = getComputedBorderStyles(el)
      const color = getComputedColorStyles(el)
      const boxShadow = getComputedBoxShadow(el)

      setState((prev) => ({
        ...prev,
        computedBorder: border,
        computedColor: color,
        computedBoxShadow: boxShadow,
        pendingStyles: {
          ...prev.pendingStyles,
          ...pendingUpdates,
        },
      }))
    },
    [pushUndo]
  )

  const updateRawCSS = React.useCallback(
    (properties: Record<string, string>) => {
      const el = stateRef.current.selectedElement
      if (!el || Object.keys(properties).length === 0) return

      const undoProperties: Array<{ cssProperty: string; previousValue: string | null }> = []
      const pendingUpdates: Record<string, string> = {}

      for (const [cssProperty, cssValue] of Object.entries(properties)) {
        const previousValue = el.style.getPropertyValue(cssProperty) || null
        undoProperties.push({ cssProperty, previousValue })
        el.style.setProperty(cssProperty, cssValue)
        pendingUpdates[cssProperty] = cssValue
      }

      pushUndo({ type: 'edit', element: el, properties: undoProperties })

      const border = getComputedBorderStyles(el)
      const color = getComputedColorStyles(el)
      const boxShadow = getComputedBoxShadow(el)

      setState((prev) => ({
        ...prev,
        computedBorder: border,
        computedColor: color,
        computedBoxShadow: boxShadow,
        pendingStyles: {
          ...prev.pendingStyles,
          ...pendingUpdates,
        },
      }))
    },
    [pushUndo]
  )

  const updateFlexProperty = React.useCallback(
    (key: FlexPropertyKey, value: string) => {
      const el = stateRef.current.selectedElement
      if (!el) return

      const cssProperty = flexPropertyToCSSMap[key]

      const previousValue = el.style.getPropertyValue(cssProperty) || null
      pushUndo({ type: 'edit', element: el, properties: [{ cssProperty, previousValue }] })

      el.style.setProperty(cssProperty, value)

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
    [pushUndo]
  )

  const toggleFlexLayout = React.useCallback(() => {
    const current = stateRef.current
    const element = current.selectedElement
    if (!element) return

    const flexProps = ['display', 'flex-direction', 'justify-content', 'align-items'] as const
    const properties = flexProps.map((cssProperty) => ({
      cssProperty,
      previousValue: element.style.getPropertyValue(cssProperty) || null,
    }))

    pushUndo({ type: 'edit', element, properties })

    const isCurrentlyFlex = current.elementInfo?.isFlexContainer ?? false

    if (isCurrentlyFlex) {
      for (const cssProperty of flexProps) {
        element.style.removeProperty(cssProperty)
      }
    } else {
      element.style.setProperty('display', 'flex')
    }

    const computed = getAllComputedStyles(element)
    const elementInfo = getElementInfo(element)

    const newPending = { ...current.pendingStyles }
    if (isCurrentlyFlex) {
      for (const cssProperty of flexProps) {
        delete newPending[cssProperty]
      }
    } else {
      newPending['display'] = 'flex'
    }

    setState((prev) => ({
      ...prev,
      computedFlex: computed.flex,
      computedSpacing: computed.spacing,
      computedBorderRadius: computed.borderRadius,
      computedSizing: computed.sizing,
      elementInfo,
      pendingStyles: newPending,
    }))
  }, [pushUndo])

  const updateSizingProperty = React.useCallback(
    (key: SizingPropertyKey, value: SizingValue) => {
      const el = stateRef.current.selectedElement
      if (!el) return

      const cssProperty = sizingPropertyToCSSMap[key]
      const cssValue = sizingValueToCSS(value)

      const previousValue = el.style.getPropertyValue(cssProperty) || null
      pushUndo({ type: 'edit', element: el, properties: [{ cssProperty, previousValue }] })

      el.style.setProperty(cssProperty, cssValue)

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
    [pushUndo]
  )

  const updateColorProperty = React.useCallback(
    (key: ColorPropertyKey, value: ColorValue) => {
      const el = stateRef.current.selectedElement
      if (!el) return

      const cssProperty = colorPropertyToCSSMap[key]
      const cssValue = formatColorValue(value)

      const previousValue = el.style.getPropertyValue(cssProperty) || null
      pushUndo({ type: 'edit', element: el, properties: [{ cssProperty, previousValue }] })

      el.style.setProperty(cssProperty, cssValue)

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
    [pushUndo]
  )

  const updateTypographyProperty = React.useCallback(
    (key: TypographyPropertyKey, value: CSSPropertyValue | string) => {
      const el = stateRef.current.selectedElement
      if (!el) return

      const cssProperty = typographyPropertyToCSSMap[key]
      const cssValue = typeof value === 'string' ? value : formatPropertyValue(value)

      if (key === 'textVerticalAlign') {
        const prevDisplay = el.style.getPropertyValue('display') || null
        const prevAlignItems = el.style.getPropertyValue('align-items') || null
        pushUndo({
          type: 'edit',
          element: el,
          properties: [
            { cssProperty: 'display', previousValue: prevDisplay },
            { cssProperty: 'align-items', previousValue: prevAlignItems },
          ],
        })

        const computed = window.getComputedStyle(el)
        const isInline = computed.display === 'inline' || computed.display === 'inline-block'
        const displayValue = isInline ? 'inline-flex' : 'flex'
        el.style.setProperty('display', displayValue)
        el.style.setProperty('align-items', cssValue)
      } else {
        const previousValue = el.style.getPropertyValue(cssProperty) || null
        pushUndo({ type: 'edit', element: el, properties: [{ cssProperty, previousValue }] })

        el.style.setProperty(cssProperty, cssValue)
      }

      setState((prev) => {
        let displayValue = 'flex'
        if (key === 'textVerticalAlign' && el) {
          const computed = window.getComputedStyle(el)
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
    [pushUndo]
  )

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
        textEditingElement: null,
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

  const setBorderStyleControlPreference = React.useCallback((preference: BorderStyleControlPreference) => {
    setState((prev) => ({ ...prev, borderStyleControlPreference: preference }))
    try { localStorage.setItem(BORDER_STYLE_CONTROL_PREFERENCE_KEY, preference) } catch {}
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

  React.useEffect(() => {
    syncSessionItemCount(state.comments)
  }, [state.comments, syncSessionItemCount])

  const exportComment = React.useCallback(async (id: string) => {
    const comment = stateRef.current.comments.find((c) => c.id === id)
    if (!comment) return false

    const exportMarkdown = buildCommentExport(comment.locator, comment.text, comment.replies)
    try {
      await navigator.clipboard.writeText(`implement the visual edits\n\n${exportMarkdown}`)
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

  const startTextEditing = React.useCallback((element: HTMLElement) => {
    if (!isTextElement(element)) return
    if (stateRef.current.textEditingElement) return

    // Determine original text: prefer existing session edit's original
    const existing = sessionEditsRef.current.get(element)
    const originalText = existing?.textEdit?.originalText ?? (element.textContent ?? '')
    element.setAttribute('data-direct-edit-original-text', originalText)

    element.setAttribute('contenteditable', 'true')
    element.style.outline = '1px solid #0D99FF'
    element.style.outlineOffset = '0px'
    element.focus()

    // Select all text for easy replacement
    const selection = window.getSelection()
    if (selection) {
      const range = document.createRange()
      range.selectNodeContents(element)
      selection.removeAllRanges()
      selection.addRange(range)
    }

    setState((prev) => ({ ...prev, textEditingElement: element }))
  }, [])

  const commitTextEditing = React.useCallback(() => {
    const editingElement = stateRef.current.textEditingElement
    if (!editingElement) return

    finalizeTextEditing(editingElement)
  }, [finalizeTextEditing])

  // Click-outside listener for text editing
  React.useEffect(() => {
    const editingElement = state.textEditingElement
    if (!editingElement) return

    function handleMouseDown(e: MouseEvent) {
      if (!editingElement!.contains(e.target as Node)) {
        commitTextEditing()
      }
    }

    // Delay to avoid catching the double-click that started editing
    const rafId = requestAnimationFrame(() => {
      document.addEventListener('mousedown', handleMouseDown, true)
    })

    return () => {
      cancelAnimationFrame(rafId)
      document.removeEventListener('mousedown', handleMouseDown, true)
    }
  }, [state.textEditingElement, commitTextEditing])

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

  const canSendEditToAgent = React.useCallback(() => {
    const current = stateRef.current
    if (!current.selectedElement || !current.elementInfo) return false
    const sessionEdit = sessionEditsRef.current.get(current.selectedElement)
    const hasPendingStyles = Object.keys(current.pendingStyles).length > 0
    const hasTextEdit = Boolean(sessionEdit?.textEdit)
    const hasMove = Boolean(sessionEdit?.move)
    return hasPendingStyles || hasTextEdit || hasMove
  }, [])

  const sendEditToAgent = React.useCallback(async () => {
    const current = stateRef.current
    if (!current.selectedElement || !current.elementInfo) return false
    const sessionEdit = sessionEditsRef.current.get(current.selectedElement)
    if (!canSendEditToAgent()) return false

    const locator = getElementLocator(current.selectedElement)
    const exportMarkdown = sessionEdit?.move
      ? buildSessionExport([{
          ...sessionEdit,
          locator,
          pendingStyles: { ...current.pendingStyles },
          textEdit: sessionEdit.textEdit,
        }], [])
      : buildEditExport(locator, current.pendingStyles, sessionEdit?.textEdit)
    const collapsedStyles = collapseExportShorthands(current.pendingStyles)
    const changes = Object.entries(collapsedStyles).map(([cssProperty, cssValue]) => ({
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
        textChange: sessionEdit?.textEdit ?? null,
        exportMarkdown,
      })
      return result.ok
    } catch {
      return false
    }
  }, [canSendEditToAgent])

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

  // Toggle edit mode: plain Cmd/Ctrl + Period
  // Uses capture phase so it fires before any stopPropagation() in the host app (e.g. Tauri webview)
  // Uses e.code for layout independence (fallback to e.key for virtual keyboards)
  React.useEffect(() => {
    function handleToggle(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && (e.code === 'Period' || e.key === '.')) {
        e.preventDefault()
        toggleEditMode()
      }
    }
    window.addEventListener('keydown', handleToggle, true)
    return () => window.removeEventListener('keydown', handleToggle, true)
  }, [toggleEditMode])

  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const s = stateRef.current

      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        if (s.textEditingElement) return // let browser handle contenteditable undo
        e.preventDefault()
        undo()
        return
      }

      if (e.key === 'C' && e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey && s.editModeActive) {
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

      if (e.key === 'A' && e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey && s.editModeActive && s.selectedElement) {
        const active = document.activeElement
        const isInput = active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement || (active instanceof HTMLElement && active.isContentEditable)
        if (!isInput) {
          e.preventDefault()
          toggleFlexLayout()
          return
        }
      }

      if (e.key === 'Enter' && s.editModeActive && !s.textEditingElement && s.selectedElement) {
        const active = document.activeElement
        const isInput = active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement || (active instanceof HTMLElement && active.isContentEditable)
        if (!isInput && isTextElement(s.selectedElement)) {
          e.preventDefault()
          startTextEditing(s.selectedElement)
          return
        }
      }

      if (e.key === 'Escape') {
        if (s.textEditingElement) {
          commitTextEditing()
          return
        }
        if (s.activeCommentId) {
          setState((prev) => {
            let comments = prev.comments
            const active = comments.find((c) => c.id === prev.activeCommentId)
            if (active && active.text === '') {
              comments = comments.filter((c) => c.id !== prev.activeCommentId)
            }
            return { ...prev, comments, activeCommentId: null }
          })
        } else if (s.activeTool === 'comment') {
          setState((prev) => ({ ...prev, activeTool: 'select' }))
        } else if (s.isOpen) {
          closePanel()
        } else if (s.editModeActive) {
          toggleEditMode()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [closePanel, toggleEditMode, toggleFlexLayout, undo, commitTextEditing, startTextEditing])

  const stateContextValue = React.useMemo<DirectEditStateContextValue>(() => ({
    ...state,
    sessionEditCount,
  }), [state, sessionEditCount])

  const actionsContextValue = React.useMemo<DirectEditActionsContextValue>(() => ({
    selectElement,
    selectParent,
    selectChild,
    closePanel,
    updateSpacingProperty,
    updateBorderRadiusProperty,
    updateBorderProperty,
    updateBorderProperties,
    updateRawCSS,
    updateFlexProperty,
    toggleFlexLayout,
    updateSizingProperty,
    updateColorProperty,
    updateTypographyProperty,
    resetToOriginal,
    exportEdits,
    canSendEditToAgent,
    sendEditToAgent,
    sendCommentToAgent,
    toggleEditMode,
    undo,
    handleMoveComplete,
    setActiveTool,
    setTheme,
    setBorderStyleControlPreference,
    addComment,
    updateCommentText,
    addCommentReply,
    deleteComment,
    exportComment,
    setActiveCommentId,
    getSessionEdits,
    getSessionItems,
    exportAllEdits,
    clearSessionEdits,
    removeSessionEdit,
    startTextEditing,
    commitTextEditing,
  }), [
    selectElement,
    selectParent,
    selectChild,
    closePanel,
    updateSpacingProperty,
    updateBorderRadiusProperty,
    updateBorderProperty,
    updateBorderProperties,
    updateRawCSS,
    updateFlexProperty,
    toggleFlexLayout,
    updateSizingProperty,
    updateColorProperty,
    updateTypographyProperty,
    resetToOriginal,
    exportEdits,
    canSendEditToAgent,
    sendEditToAgent,
    sendCommentToAgent,
    toggleEditMode,
    undo,
    handleMoveComplete,
    setActiveTool,
    setTheme,
    setBorderStyleControlPreference,
    addComment,
    updateCommentText,
    addCommentReply,
    deleteComment,
    exportComment,
    setActiveCommentId,
    getSessionEdits,
    getSessionItems,
    exportAllEdits,
    clearSessionEdits,
    removeSessionEdit,
    startTextEditing,
    commitTextEditing,
  ])

  return (
    <PortalContainerProvider>
      <DirectEditStateContext.Provider value={stateContextValue}>
        <DirectEditActionsContext.Provider value={actionsContextValue}>
          <ThemeApplier />
          {children}
        </DirectEditActionsContext.Provider>
      </DirectEditStateContext.Provider>
    </PortalContainerProvider>
  )
}

function ThemeApplier() {
  const { theme } = useDirectEditState()
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
