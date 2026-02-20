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
  SessionEdit,
  SessionItem,
} from './types'
import type { MoveInfo } from './use-move'
import { useStyleUpdaters } from './use-style-updaters'
import { useSessionManager } from './use-session-manager'
import { useTextAndComments } from './use-text-and-comments'
import { useAgentComms } from './use-agent-comms'
import { useKeyboardShortcuts } from './use-keyboard-shortcuts'

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
  canSendEditToAgent: (snapshot?: {
    selectedElement: HTMLElement | null
    elementInfo: DirectEditState['elementInfo']
    pendingStyles: Record<string, string>
  }) => boolean
  sendEditToAgent: () => Promise<boolean>
  sendAllSessionItemsToAgent: () => Promise<boolean>
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

  const pushUndo = React.useCallback((entry: UndoEntry) => {
    undoStackRef.current.push(entry)
    if (undoStackRef.current.length > 500) {
      undoStackRef.current = undoStackRef.current.slice(-500)
    }
    if (entry.type === 'edit' || entry.type === 'move' || entry.type === 'textEdit') {
      removedSessionEditsRef.current.delete(entry.element)
    }
  }, [])

  const {
    updateSpacingProperty, updateBorderRadiusProperty, updateBorderProperty,
    updateBorderProperties, updateRawCSS, updateFlexProperty, toggleFlexLayout,
    updateSizingProperty, updateColorProperty, updateTypographyProperty,
  } = useStyleUpdaters({ stateRef, pushUndo, setState })

  const {
    syncSessionItemCount, saveCurrentToSession, selectElement, selectParent, selectChild,
    resetToOriginal, undo, handleMoveComplete, getSessionEdits, getSessionItems,
    exportAllEdits, exportEdits, removeSessionEdit, clearSessionEdits,
  } = useSessionManager({
    stateRef, sessionEditsRef, removedSessionEditsRef, undoStackRef,
    pushUndo, setState, setSessionEditCount,
  })

  // Save current element to session when selected element or pending styles change
  React.useEffect(() => {
    if (!state.selectedElement) return
    saveCurrentToSession()
  }, [state.selectedElement, state.pendingStyles, saveCurrentToSession])

  const {
    finalizeTextEditing, toggleEditMode, startTextEditing, commitTextEditing,
    addComment, updateCommentText, addCommentReply, deleteComment, exportComment, setActiveCommentId,
  } = useTextAndComments({
    stateRef, sessionEditsRef, removedSessionEditsRef,
    pushUndo, syncSessionItemCount, setState,
  })

  // Sync session item count when comments change
  React.useEffect(() => {
    syncSessionItemCount(state.comments)
  }, [state.comments, syncSessionItemCount])

  // Click-outside listener for text editing
  React.useEffect(() => {
    const editingElement = state.textEditingElement
    if (!editingElement) return
    const activeEditingElement = editingElement

    function handleMouseDown(e: MouseEvent) {
      const target = e.target
      if (!(target instanceof Node)) return
      if (!activeEditingElement.contains(target)) {
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

  const {
    canSendEditToAgent, sendEditToAgent, sendCommentToAgent, sendAllSessionItemsToAgent,
  } = useAgentComms({ stateRef, sessionEditsRef, getSessionItems })

  const closePanel = React.useCallback(() => {
    setState((prev) => ({
      ...prev,
      isOpen: false,
    }))
  }, [])

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

  useKeyboardShortcuts({
    stateRef, toggleEditMode, toggleFlexLayout, undo,
    commitTextEditing, startTextEditing, closePanel, setState,
  })

  const stateContextValue = React.useMemo<DirectEditStateContextValue>(() => ({
    ...state,
    sessionEditCount,
  }), [state, sessionEditCount])

  const actionsContextValue = React.useMemo<DirectEditActionsContextValue>(() => ({
    selectElement, selectParent, selectChild, closePanel,
    updateSpacingProperty, updateBorderRadiusProperty, updateBorderProperty,
    updateBorderProperties, updateRawCSS, updateFlexProperty, toggleFlexLayout,
    updateSizingProperty, updateColorProperty, updateTypographyProperty,
    resetToOriginal, exportEdits, canSendEditToAgent, sendEditToAgent,
    sendAllSessionItemsToAgent, sendCommentToAgent, toggleEditMode, undo,
    handleMoveComplete, setActiveTool, setTheme, setBorderStyleControlPreference,
    addComment, updateCommentText, addCommentReply, deleteComment, exportComment,
    setActiveCommentId, getSessionEdits, getSessionItems, exportAllEdits,
    clearSessionEdits, removeSessionEdit, startTextEditing, commitTextEditing,
  }), [
    selectElement, selectParent, selectChild, closePanel,
    updateSpacingProperty, updateBorderRadiusProperty, updateBorderProperty,
    updateBorderProperties, updateRawCSS, updateFlexProperty, toggleFlexLayout,
    updateSizingProperty, updateColorProperty, updateTypographyProperty,
    resetToOriginal, exportEdits, canSendEditToAgent, sendEditToAgent,
    sendAllSessionItemsToAgent, sendCommentToAgent, toggleEditMode, undo,
    handleMoveComplete, setActiveTool, setTheme, setBorderStyleControlPreference,
    addComment, updateCommentText, addCommentReply, deleteComment, exportComment,
    setActiveCommentId, getSessionEdits, getSessionItems, exportAllEdits,
    clearSessionEdits, removeSessionEdit, startTextEditing, commitTextEditing,
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
